<script lang="ts" module>
import { addProtocol } from "maplibre-gl";
import { protocol } from "$lib/explore/locate";

// One reader for the page: the map and the Focus lookup share each archive's header and directories.
addProtocol("pmtiles", protocol.tile);
</script>

<script lang="ts">
import { onMount } from "svelte";
import {
  CircleLayer,
  FillLayer,
  GeoJSONSource,
  LineLayer,
  MapLibre,
  VectorTileSource,
} from "svelte-maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import type {
  ErrorEvent,
  ExpressionSpecification,
  Map as MapInstance,
  MapLayerMouseEvent,
  VectorTileSource as VectorSource,
} from "maplibre-gl";
import Tooltip from "$components/chart/Tooltip.svelte";
import {
  loadCounts,
  loadShard,
  shardOf,
  shardsOf,
  valueAt,
  type Counts,
  type Shard,
} from "$lib/explore/metrics";
import { archiveUrl, frameOf } from "$lib/explore/locate";
import {
  COLORS,
  LEVEL_NOUNS,
  NO_DATA_COLOR,
  TILES,
  colorIndexOf,
  fmt,
  unitFor,
  type Level,
  type LngLat,
} from "$lib/explore/model";
import zctaShardBounds from "$lib/generated/zcta-shard-bounds.json";
import { loadTopology } from "$lib/map/static-assets";
import {
  featureBounds,
  topologyToFeatureCollection,
  type CountyFeatureCollection,
} from "$lib/map/topology";

// Keep worker code intact: Vite's class-field helpers cannot survive MapLibre's function serialization.
setWorkerUrl(workerUrl);

let {
  selected,
  focus,
  onpick,
  level,
  yearWindow,
  breaks,
  religion,
  zoom = $bindable(3.5),
}: {
  /** GEOID of the Selection, a Unit of `level`. */
  selected: string | null;
  /** Where the user is looking; the Selection is the Unit of `level` around it. */
  focus: LngLat | null;
  /** A click says where to look, and names the Unit under it when that Unit is of `level`. */
  onpick: (pick: { at: LngLat; geoid?: string }) => void;
  level: Level;
  /** Index of the Year Window in the Metric cube. */
  yearWindow: number;
  /** The page owns the legend, so it names the breaks of every Level that can be on screen. */
  breaks: Record<Level, number[]>;
  religion: string;
  /** The page reads it to show the legend of whichever level is drawn at this zoom. */
  zoom?: number;
} = $props();

const NATIONAL_BOUNDS: [[number, number], [number, number]] = [
  [-125, 24],
  [-66, 50],
];
// Counts never ride in tiles or GeoJSON properties (ADR-0002). Each feature's colour class arrives as
// feature-state, so this one expression serves every Level, Year Window and Type.
const fillColor = [
  "match",
  ["coalesce", ["feature-state", "cls"], -1],
  ...COLORS.flatMap((color, index) => [index, color]),
  NO_DATA_COLOR,
] as unknown as ExpressionSpecification;
const STATE_SOURCE = "explore-states";
const TILE_SOURCE = "explore-tiles";
// Ids seen on the map belong to the states or to the chosen Level, which tells a ZIP from a county.
const levelOf = (id: string): Level => (id.length === 2 ? "state" : level);
let geometry = $state.raw<CountyFeatureCollection>();
let map = $state.raw<MapInstance>();
let container = $state<HTMLElement>();
let hovered = $state<string | null>(null);
let hoveredCount = $state<number | null>(null);
// States are GeoJSON; every other Level is a tile archive, mounted while it is the chosen Level.
const tiles = $derived(level === "state" ? null : TILES[level]);
const tileUrl = $derived(tiles && `pmtiles://${archiveUrl(tiles.archive)}`);
const revealZoom = $derived(tiles?.revealZoom ?? 0);
let tileSource = $state.raw<VectorSource>();
let notice = $state<string | null>(null);
let pointer = $state({ x: 0, y: 0 });
let mapLoaded = $state(false);
let error = $state<string | null>(null);
let active = false;

const mapData = $derived<CountyFeatureCollection>({
  type: "FeatureCollection",
  features:
    geometry?.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, geoid: String(feature.id) },
    })) ?? [],
});
const focusData = $derived<GeoJSON.FeatureCollection>({
  type: "FeatureCollection",
  features: focus
    ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: focus } }]
    : [],
});
// Below its Reveal zoom a tiled Level keeps the state level on screen, never an empty map.
const stateMaxZoom = $derived(tiles ? revealZoom : 24);

async function loadGeometry() {
  try {
    const topology = await loadTopology();
    if (active) geometry = topologyToFeatureCollection(topology, "states");
  } catch (cause) {
    if (active)
      error = cause instanceof Error ? cause.message : "State boundaries could not be loaded.";
  }
}

onMount(() => {
  active = true;
  void loadGeometry();
  return () => {
    active = false;
  };
});

export function zoomIn() {
  map?.zoomIn();
}
export function zoomOut() {
  map?.zoomOut();
}
export function reset() {
  map?.fitBounds(NATIONAL_BOUNDS, { padding: 35, duration: 650, bearing: 0, pitch: 0 });
}

function retry() {
  // The wrapper clears its map context before child-layer teardown; reload runtime failures safely.
  window.location.reload();
}

function handleMapError(event: ErrorEvent) {
  const details = event as ErrorEvent & { tile?: unknown; sourceId?: string; layer?: unknown };
  if (details.sourceId === STATE_SOURCE) {
    error = `State layer could not be loaded: ${event.error.message}`;
    return;
  }
  if (details.sourceId === TILE_SOURCE && !details.tile) {
    // The state view still works, so this stays a notice rather than the blocking error.
    notice = `${LEVEL_NOUNS[level].one} boundaries could not be loaded.`;
    return;
  }
  if (details.tile || details.sourceId || details.layer || map?.getStyle()) return;
  error = `Map style could not be loaded: ${event.error.message}`;
}

function hover(event: MapLayerMouseEvent) {
  const feature = event.features?.[0];
  hovered = feature?.properties.geoid ?? null;
  hoveredCount = hovered ? countOf(hovered) : null;
  pointer = { x: event.point.x, y: event.point.y };
}

// Shards on the map, for the current Type. Plain Maps on purpose: reactive ones would make the paint
// effect depend on its own bookkeeping.
const loaded = new Map<string, { shard: Shard; counts: Counts }>();
// The colour class each feature wears right now, per Shard. Neighbouring Year Windows leave most places
// in the same class, so a window change only touches the features whose class moved.
const painted = new Map<string, Int8Array>();

function countOf(geoid: string) {
  const lvl = levelOf(geoid);
  const entry = loaded.get(`${lvl}/${shardOf(lvl, geoid)}`);
  const row = entry?.shard.row.get(geoid);
  return entry && row !== undefined ? valueAt(entry.counts, row, yearWindow) : null;
}

function paint(lvl: Level, key: string, { geoids }: Shard, counts: Counts) {
  const source = lvl === "state" ? STATE_SOURCE : TILE_SOURCE;
  if (!map?.getSource(source)) return;
  let classes = painted.get(key);
  if (!classes) painted.set(key, (classes = new Int8Array(geoids.length).fill(-1)));
  const sourceLayer = lvl === "state" ? undefined : TILES[lvl].sourceLayer;
  for (let row = 0; row < geoids.length; row++) {
    const cls = colorIndexOf(valueAt(counts, row, yearWindow), breaks[lvl]);
    if (cls === classes[row]) continue;
    classes[row] = cls;
    map.setFeatureState({ source, sourceLayer, id: geoids[row] }, { cls });
  }
}

/** Load what the view needs and paint it. Shard files are cached, so this is cheap to call on any change. */
function refresh() {
  if (!mapLoaded || !map || !geometry) return;
  const target = map;
  const wanted = religion;
  const jobs: [Level, string][] = [["state", "us"]];
  if (level !== "state" && target.getSource(TILE_SOURCE) && target.getZoom() >= revealZoom) {
    const shards = shardsOf(level);
    if (shards.length === 1) jobs.push([level, shards[0]]);
    else {
      // A Shard is a state (tracts, block groups) or a two-digit ZIP prefix, so the Shards whose bounding
      // boxes meet the viewport are the ones to load. No tile has to load first, so counts arrive
      // alongside the boundaries they colour; MapLibre applies feature-state to tiles that load later.
      const view = target.getBounds();
      const boxes: [string, number[]][] =
        level === "zcta"
          ? Object.entries(zctaShardBounds)
          : geometry.features.map((feature) => [String(feature.id), featureBounds(feature).flat()]);
      for (const [shard, [west, south, east, north]] of boxes)
        if (
          west <= view.getEast() &&
          east >= view.getWest() &&
          south <= view.getNorth() &&
          north >= view.getSouth() &&
          shards.includes(shard)
        )
          jobs.push([level, shard]);
    }
  }
  for (const [lvl, shard] of jobs) {
    Promise.all([loadShard(lvl, shard), loadCounts(lvl, shard, wanted)]).then(
      ([rows, counts]) => {
        // A Type or map chosen while this was in flight owns the picture now.
        if (wanted !== religion || target !== map) return;
        loaded.set(`${lvl}/${shard}`, { shard: rows, counts });
        paint(lvl, `${lvl}/${shard}`, rows, counts);
        notice = null;
      },
      () => {
        // A failed file is dropped from the cache, so the next move retries it.
        if (wanted === religion) notice = "Counts could not be loaded. Move the map to retry.";
      }
    );
  }
}

$effect(() => {
  void religion;
  loaded.clear(); // the tooltip must never read the previous Type's counts
});

$effect(() => {
  // The tile source joins the map a microtask after a Level change, so its arrival repaints too.
  void [level, yearWindow, religion, breaks, tileSource];
  // A Level change swaps the tile source, and the feature-state of the old one goes with it.
  for (const key of painted.keys())
    if (!key.startsWith(`${level}/`) && !key.startsWith("state/")) painted.delete(key);
  refresh();
});

// The point of the last click on the chosen Level's own Units.
let clicked: LngLat | null = null;
function pick(event: MapLayerMouseEvent) {
  const geoid = event.features?.[0]?.properties.geoid;
  const at: LngLat = [event.lngLat.lng, event.lngLat.lat];
  // Below a Reveal zoom the states stand in for the Level: a click there only says where to look.
  const own = typeof geoid === "string" && (geoid.length === 2) === (level === "state");
  clicked = own ? at : null;
  onpick({ at, geoid: own ? geoid : undefined });
}

// The camera frames the Selection when a search, a Level change or a link chose it. A click on a Unit
// never moves the camera: the user picked that view. A state is always framed whole.
let settled: string | undefined;
$effect(() => {
  if (!mapLoaded || !map || !geometry) return;
  const key = `${level}|${focus}|${selected}`;
  if (key === settled) return;
  settled = key;
  const target = map;
  const move = { duration: 650, bearing: 0, pitch: 0 };
  if (focus && level !== "state") {
    const [at, lvl] = [focus, level];
    // The URL keeps five decimals of the clicked point.
    const byClick = clicked?.every((value, axis) => Math.abs(value - at[axis]) < 1e-4);
    clicked = null;
    if (byClick) return;
    target.stop();
    const room = Math.min(90, target.getContainer().clientWidth / 6);
    void frameOf(lvl, at)
      .catch(() => null)
      .then((bounds) => {
        if (settled !== key || target !== map) return;
        if (bounds)
          target.fitBounds(bounds, { ...move, padding: room, maxZoom: TILES[lvl].maxZoom - 1 });
        else target.easeTo({ ...move, center: at, zoom: TILES[lvl].focusZoom });
      });
    return;
  }
  // A link from before the Focus names a Unit only: frame its state, or the country for a ZIP.
  const id = level === "zcta" ? null : selected?.slice(0, 2);
  const feature = geometry.features.find((candidate) => String(candidate.id) === id);
  target.stop();
  target.fitBounds(feature ? featureBounds(feature) : NATIONAL_BOUNDS, {
    ...move,
    padding: 45,
    maxZoom: 8,
  });
});
</script>

<figure
  bind:this={container}
  class="state-map"
  aria-label="Reported closures by {LEVEL_NOUNS[level]
    .one}. With the keyboard, use Find a place to say where to look and View by to choose what is reported there."
  data-state-map={error ? "error" : mapLoaded && geometry ? "ready" : "loading"}
  data-selected-state={selected ?? ""}
>
  <svelte:boundary>
    <MapLibre
      class="h-full min-h-[300px] w-full"
      style="/maps/yale-light.json"
      autoloadGlobalCss={false}
      center={[-98.5795, 39.8283]}
      bind:zoom
      minZoom={2}
      maxZoom={tiles?.maxZoom ?? 8}
      bind:map
      cursor={hovered ? "pointer" : ""}
      onload={() => {
        mapLoaded = true;
      }}
      onerror={handleMapError}
      onmovestart={() => {
        hovered = null;
      }}
      onmoveend={refresh}
      onwebglcontextlost={() => {
        error = "The map's graphics context was lost.";
      }}
    >
      <!-- First and always mounted: the Selection's stroke sits right under it, above the basemap's
           roads, and stays there when a Level change remounts the tile layers. -->
      <GeoJSONSource id="explore-focus" data={focusData}>
        <CircleLayer
          id="focus-dot"
          paint={{
            "circle-radius": 5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#111827",
            "circle-stroke-width": 2.5,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id={STATE_SOURCE} data={mapData} promoteId="geoid">
        <FillLayer
          id="state-fill"
          beforeId="waterway"
          maxzoom={stateMaxZoom}
          paint={{
            "fill-color": fillColor,
            "fill-opacity": 0.85,
            "fill-outline-color": "#ffffff",
          }}
          onclick={pick}
          onmousemove={hover}
          onmouseleave={() => {
            hovered = null;
          }}
        />
        <LineLayer
          id="state-hover"
          beforeId="waterway"
          maxzoom={stateMaxZoom}
          filter={["==", ["get", "geoid"], hovered ?? ""]}
          paint={{ "line-color": "#16406a", "line-width": 1.5 }}
        />
        <!-- The Selection's stroke has to survive the darkest class: a white casing under a dark line. -->
        <LineLayer
          id="state-selected-casing"
          beforeId="focus-dot"
          filter={["==", ["get", "geoid"], selected ?? ""]}
          paint={{ "line-color": "#ffffff", "line-width": 6 }}
        />
        <LineLayer
          id="state-selected"
          beforeId="focus-dot"
          filter={["==", ["get", "geoid"], selected ?? ""]}
          paint={{ "line-color": "#111827", "line-width": 2.5 }}
        />
      </GeoJSONSource>
      {#if tiles && tileUrl}
        {#key level}
          <VectorTileSource
            id={TILE_SOURCE}
            bind:source={tileSource}
            url={tileUrl}
            promoteId={{ [tiles.sourceLayer]: "geoid" }}
          >
            <FillLayer
              id="tile-fill"
              sourceLayer={tiles.sourceLayer}
              beforeId="waterway"
              minzoom={revealZoom}
              paint={{
                "fill-color": fillColor,
                "fill-opacity": 0.85,
                // Outlines only help once places are several pixels wide; earlier they wash the map white.
                "fill-outline-color": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  tiles.outlineZoom,
                  "rgba(255,255,255,0)",
                  tiles.outlineZoom + 2,
                  "rgba(255,255,255,0.8)",
                ],
              }}
              onclick={pick}
              onmousemove={hover}
              onmouseleave={() => {
                hovered = null;
              }}
            />
            <LineLayer
              id="tile-hover"
              sourceLayer={tiles.sourceLayer}
              beforeId="waterway"
              minzoom={revealZoom}
              filter={["==", ["get", "geoid"], hovered ?? ""]}
              paint={{ "line-color": "#16406a", "line-width": 1.5 }}
            />
            <LineLayer
              id="tile-selected-casing"
              sourceLayer={tiles.sourceLayer}
              beforeId="focus-dot"
              minzoom={revealZoom}
              filter={["==", ["get", "geoid"], selected ?? ""]}
              paint={{ "line-color": "#ffffff", "line-width": 6 }}
            />
            <LineLayer
              id="tile-selected"
              sourceLayer={tiles.sourceLayer}
              beforeId="focus-dot"
              minzoom={revealZoom}
              filter={["==", ["get", "geoid"], selected ?? ""]}
              paint={{ "line-color": "#111827", "line-width": 2.5 }}
            />
          </VectorTileSource>
        {/key}
      {/if}
    </MapLibre>

    {#if error}
      <div class="map-message" role="alert">
        <p>Map unavailable: {error}</p>
        <button onclick={retry}>Retry map</button>
      </div>
    {:else if !mapLoaded || !geometry}
      <div class="map-message pointer-events-none" role="status">Loading state map…</div>
    {:else if notice || zoom < revealZoom}
      <p class="map-hint" role="status">
        {notice ??
          `Showing states. Search for a place or click the map to see ${LEVEL_NOUNS[level].many} there.`}
      </p>
    {/if}

    {#snippet failed(cause)}
      <div class="map-message" role="alert">
        <p>
          Map unavailable: {cause instanceof Error ? cause.message : "Unable to start the map."}
        </p>
        <button onclick={retry}>Retry map</button>
      </div>
    {/snippet}
  </svelte:boundary>

  <Tooltip
    x={pointer.x}
    y={pointer.y}
    open={!!hovered && !error}
    boundary={container}
    preferredSide="right"
    sideOffset={18}
  >
    <div class="py-1">
      <strong
        >{hovered
          ? (unitFor(hovered, hovered.length === 2 ? "state" : level)?.name ?? hovered)
          : ""}</strong
      >
      <p>Reported closures: {fmt(hoveredCount)}</p>
      <p class="text-xs text-gray-600">
        {hovered && hovered.length > 2 ? `GEOID ${hovered} · ` : ""}Preliminary source output
      </p>
    </div>
  </Tooltip>
</figure>

<style>
.state-map {
  position: relative;
  height: 100%;
  width: 100%;
  margin: 0;
}
.map-message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
  background: #f3f5f7ed;
  color: #334155;
  text-align: center;
  font-size: 0.875rem;
}
.map-hint {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  translate: -50%;
  margin: 0;
  border: 1px solid #d9dde2;
  border-radius: 0.25rem;
  padding: 0.45rem 0.9rem;
  background: #ffffffed;
  color: #334155;
  font-size: 0.8125rem;
  pointer-events: none;
}
.map-message button {
  border: 1px solid #00356b;
  border-radius: 0.25rem;
  padding: 0.4rem 0.9rem;
  color: #00356b;
  background: white;
  cursor: pointer;
}
</style>
