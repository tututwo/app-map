<script lang="ts" module>
import "maplibre-gl/dist/maplibre-gl.css";
import { addProtocol } from "maplibre-gl";
import { protocol } from "$lib/explore/locate";

// One reader for the page: the map and the Focus lookup share each archive's header and directories.
// The coloured map and its outlines ask for the same tile in the same frame. One request serves both,
// and it is cancelled only once neither wants the tile.
type Tile = Awaited<ReturnType<typeof protocol.tilev4>>;
const pending = new Map<
  string,
  { result: Promise<Tile>; controller: AbortController; users: number }
>();
addProtocol("pmtiles", (params, abort) => {
  if (params.type === "json") return protocol.tilev4(params, abort);
  let entry = pending.get(params.url);
  if (!entry) {
    const controller = new AbortController();
    const result = protocol.tilev4(params, controller);
    const forget = () => {
      if (pending.get(params.url)?.result === result) pending.delete(params.url);
    };
    result.then(forget, forget);
    pending.set(params.url, (entry = { result, controller, users: 0 }));
  }
  const shared = entry;
  shared.users++;
  abort.signal.addEventListener(
    "abort",
    () => {
      if (--shared.users) return;
      // A request that arrives from now on starts afresh instead of sharing a cancelled one.
      if (pending.get(params.url) === shared) pending.delete(params.url);
      shared.controller.abort();
    },
    { once: true }
  );
  // MapLibre moves the bytes to its worker, which leaves nothing for the next source: each gets a copy.
  return shared.result.then((tile) => ({
    ...tile,
    data: tile.data instanceof Uint8Array ? tile.data.slice() : tile.data,
  }));
});
</script>

<script lang="ts">
import { onMount } from "svelte";
import { prefersReducedMotion } from "svelte/motion";
import { fade } from "svelte/transition";
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
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  VectorTileSource as VectorSource,
} from "maplibre-gl";
import Tooltip from "$components/chart/Tooltip.svelte";
import { loadMapValues, type MapValues } from "$lib/explore/metrics";
import { archiveUrl, frameOf, type Bounds } from "$lib/explore/locate";
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
  colors = COLORS,
  zoom = $bindable(3.5),
  still = false,
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
  /** Ten display colors for the existing classes; changing them never reloads counts. */
  colors?: readonly string[];
  /** The page reads it to show the legend of whichever level is drawn at this zoom. */
  zoom?: number;
  /**
   * The Summary's picture: framed on the Selection at once, no gestures, no hover, and no Focus dot, which
   * on a printed page would mark the address someone looked up. It keeps a copy that paper can show.
   * The page prints the basemap's attribution itself: the control never folds on a map nobody moves.
   */
  still?: boolean;
} = $props();

const NATIONAL_BOUNDS: Bounds = [
  [-125, 24],
  [-66, 50],
];
// Counts never ride in tiles or GeoJSON properties (ADR-0002). Each feature's colour class arrives as
// feature-state, so this one expression serves every Level, Year Window and Type. (A global-state lookup
// was measured and rejected: MapLibre 5.19 copies the whole global state into every tile's reply.)
const fillColor = $derived([
  "match",
  ["coalesce", ["feature-state", "cls"], -1],
  ...colors.flatMap((color, index) => [index, color]),
  NO_DATA_COLOR,
] as unknown as ExpressionSpecification);
const STATE_SOURCE = "explore-states";
const TILE_SOURCE = "explore-tiles";
// A filter change makes MapLibre rebuild every tile of its source. Hover and Selection outlines keep
// their own copy of the archive, whose tiles hold only the one or two outlined Units, so moving the
// pointer never rebuilds the coloured tiles.
const OUTLINE_SOURCE = "explore-outlines";
// Ids seen on the map belong to the states or to the chosen Level, which tells a ZIP from a county.
const levelOf = (id: string): Level => (id.length === 2 ? "state" : level);
let geometry = $state.raw<CountyFeatureCollection>();
let map = $state.raw<MapInstance>();
let container = $state<HTMLElement>();
let hovered = $state<string | null>(null);
let hoveredCount = $state<number | null>(null);
/** A click on the hovered Unit would zoom in to it. */
let zoomsIn = $state(false);
// States are GeoJSON; every other Level is a tile archive, mounted while it is the chosen Level.
const tiles = $derived(level === "state" ? null : TILES[level]);
const tileUrl = $derived(tiles && `pmtiles://${archiveUrl(tiles.archive)}`);
const revealZoom = $derived(tiles?.revealZoom ?? 0);
let tileSource = $state.raw<VectorSource>();
let notice = $state<string | null>(null);
let loadingCounts = $state(false);
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
  features:
    focus && !still
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
  map?.zoomIn({ duration: prefersReducedMotion.current ? 0 : 300 });
}
export function zoomOut() {
  map?.zoomOut({ duration: prefersReducedMotion.current ? 0 : 300 });
}
export function reset() {
  map?.fitBounds(NATIONAL_BOUNDS, {
    padding: 35,
    duration: prefersReducedMotion.current ? 0 : 500,
    bearing: 0,
    pitch: 0,
  });
}

$effect(() => {
  if (prefersReducedMotion.current) map?.stop();
});

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
  if ((details.sourceId === TILE_SOURCE || details.sourceId === OUTLINE_SOURCE) && !details.tile) {
    // The state view still works, so this stays a notice rather than the blocking error.
    notice = `${LEVEL_NOUNS[level].one} boundaries could not be loaded.`;
    return;
  }
  if (details.tile || details.sourceId || details.layer || map?.getStyle()) return;
  error = `Map style could not be loaded: ${event.error.message}`;
}

function hover(event: MapLayerMouseEvent) {
  const feature = event.features?.[0];
  pointer = { x: event.point.x, y: event.point.y };
  const geoid = feature?.properties.geoid ?? null;
  if (geoid === hovered) return;
  hovered = geoid;
  hoveredCount = hovered ? countOf(hovered) : null;
  zoomsIn = !!feature && !!map && clickZooms(map, feature);
}

function unhover() {
  hovered = null;
  zoomsIn = false;
}

// Values on the map, for the current Type. Plain Maps on purpose: reactive ones would make the paint
// effect depend on its own bookkeeping.
const loaded = new Map<Level, MapValues>();
// The colour class each feature wears right now, per Level. Neighbouring Year Windows leave most places
// in the same class, so a window change only touches the features whose class moved.
const painted = new Map<Level, Int8Array>();

function countOf(geoid: string) {
  const lvl = levelOf(geoid);
  const entry = loaded.get(lvl);
  const row = entry?.shard.row.get(geoid);
  return entry && row !== undefined ? entry.values[row] : null;
}

async function paint(lvl: Level, { shard: { geoids }, values }: MapValues, current: () => boolean) {
  const source = lvl === "state" ? STATE_SOURCE : TILE_SOURCE;
  const target = map;
  if (!target?.getSource(source)) return false;
  let classes = painted.get(lvl);
  if (!classes) painted.set(lvl, (classes = new Int8Array(geoids.length).fill(-1)));
  const sourceLayer = lvl === "state" ? undefined : TILES[lvl].sourceLayer;
  let changed = 0;
  for (let row = 0; row < geoids.length; row++) {
    const cls = colorIndexOf(values[row], breaks[lvl]);
    if (cls === classes[row]) continue;
    classes[row] = cls;
    target.setFeatureState({ source, sourceLayer, id: geoids[row] }, { cls });
    // Let input and MapLibre's state upload run between batches of the national slice.
    if (++changed % 4000 === 0 && row + 1 < geoids.length) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!current()) return false;
    }
  }
  return true;
}

/** Load the selected window and paint it. Cached values make this cheap on a map move. */
let refreshId = 0;
function refresh() {
  if (!mapLoaded || !map || !geometry) return;
  const mine = ++refreshId;
  const target = map;
  const wanted = religion;
  const window = yearWindow;
  const jobs: Level[] = ["state"];
  if (level !== "state" && target.getSource(TILE_SOURCE) && target.getZoom() >= revealZoom)
    jobs.push(level);
  for (const lvl of jobs) {
    const sourceId = lvl === "state" ? STATE_SOURCE : TILE_SOURCE;
    const source = target.getSource(sourceId);
    const current = () =>
      mine === refreshId &&
      wanted === religion &&
      window === yearWindow &&
      target === map &&
      source === target.getSource(sourceId);
    if (lvl === level && !loaded.has(lvl)) loadingCounts = true;
    loadMapValues(lvl, wanted, window).then(
      async (values) => {
        // Nationwide loads may finish after View by changes; never paint into a replacement source.
        if (!current() || !(await paint(lvl, values, current)) || !current()) return;
        loaded.set(lvl, values);
        hoveredCount = hovered ? countOf(hovered) : null;
        if (lvl === level) loadingCounts = false;
        if (still) target.triggerRepaint(); // The last batch may have ended after the print capture's idle.
        if (lvl === level || (lvl === "state" && zoom < revealZoom)) notice = null;
      },
      () => {
        // A failed file is dropped from the cache, so the next move retries it.
        if (current()) {
          if (lvl === level) loadingCounts = false;
          notice = "Counts could not be loaded. Move the map to retry.";
        }
      }
    );
  }
}

$effect(() => {
  void [level, religion, yearWindow];
  loaded.clear(); // the tooltip must never read the previous Type or Year Window's counts
  hoveredCount = null;
  loadingCounts = false;
});

$effect(() => {
  // The tile source joins the map a microtask after a Level change, so its arrival repaints too.
  void [level, yearWindow, religion, breaks, tileSource];
  // A Level change swaps the tile source, and the feature-state of the old one goes with it.
  for (const key of painted.keys()) if (key !== level && key !== "state") painted.delete(key);
  refresh();
});

// Paper cannot run WebGL, and a print layout may resize the canvas blank. Whenever the picture is
// complete, keep a copy that prints as an ordinary image.
let printCopy = $state<string>();
function copyForPrint() {
  if (!loadingCounts && map?.areTilesLoaded()) printCopy = map.getCanvas().toDataURL("image/png");
}

const moving = () => (still || prefersReducedMotion.current ? 0 : 1);
// Explore's legend lies over the bottom of the map; whatever the camera frames must clear it.
type Padding = { top: number; right: number; bottom: number; left: number };
function paddingOf(target: MapInstance): Padding {
  const room = Math.min(90, target.getContainer().clientWidth / 6);
  return { top: room, right: room, left: room, bottom: room + (still ? 0 : 110) };
}
/** How far in the camera goes to frame a Unit: a state never past 8, a fine Unit one short of its tiles' end. */
const capOf = (lvl: Level) => (lvl === "state" ? 8 : TILES[lvl].maxZoom - 1);

/** Frame bounds, with a flight that takes longer the further it zooms (capped near 1.3 s). */
function frame(target: MapInstance, bounds: Bounds, maxZoom: number, padding = paddingOf(target)) {
  const fit = target.cameraForBounds(bounds, { padding, maxZoom })?.zoom;
  const dz = fit === undefined ? 0 : Math.abs(fit - target.getZoom());
  target.fitBounds(bounds, {
    padding,
    maxZoom,
    bearing: 0,
    pitch: 0,
    duration: moving() * Math.min(1300, 450 + 90 * dz),
  });
}

/** The bounds a state's own geometry gives, for framing it whole. */
function stateBoundsOf(id: string | undefined): Bounds | null {
  const feature = geometry?.features.find((candidate) => String(candidate.id) === id);
  return feature ? featureBounds(feature) : null;
}

/**
 * The rule a click follows (ADR-0003, amended): a Unit the map shows at less than half the size it
 * could have is framed, so a click from the national view lands on it; nearer in, a click only brings
 * a Unit the edge of the map cuts off into view, and a Unit bigger than the view leaves the camera be.
 */
function clickMove(target: MapInstance, lvl: Level, bounds: Bounds) {
  const padding = paddingOf(target);
  const fit = target.cameraForBounds(bounds, { padding, maxZoom: capOf(lvl) })?.zoom;
  if (fit === undefined) return null;
  const zoom = target.getZoom();
  if (zoom < fit - 1) return "frame";
  if (zoom > fit + 1e-6) return null;
  const { clientWidth: width, clientHeight: height } = target.getContainer();
  const [[west, south], [east, north]] = bounds;
  const [a, b] = [target.project([west, north]), target.project([east, south])];
  const seen =
    a.x >= padding.left &&
    a.y >= padding.top &&
    b.x <= width - padding.right &&
    b.y <= height - padding.bottom;
  return seen ? null : "pan";
}

/** Whether a click on this hovered feature frames it; the tooltip says so. */
function clickZooms(target: MapInstance, feature: MapGeoJSONFeature) {
  const id = feature.properties.geoid;
  if (level === "state") {
    const bounds = stateBoundsOf(typeof id === "string" ? id : undefined);
    return !!bounds && clickMove(target, "state", bounds) === "frame";
  }
  // The drawn shape is cut at its tile's edge, so for a Unit that spans tiles this errs toward "zoom in".
  const { geometry: shape } = feature;
  if (shape.type !== "Polygon" && shape.type !== "MultiPolygon") return false;
  const rings = shape.type === "Polygon" ? shape.coordinates : shape.coordinates.flat();
  const bounds: Bounds = [
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ];
  for (const ring of rings)
    for (const [lng, lat] of ring) {
      bounds[0] = [Math.min(bounds[0][0], lng), Math.min(bounds[0][1], lat)];
      bounds[1] = [Math.max(bounds[1][0], lng), Math.max(bounds[1][1], lat)];
    }
  return Number.isFinite(bounds[0][0]) && clickMove(target, level, bounds) === "frame";
}

let clickId = 0;
async function frameClick(target: MapInstance, lvl: Level, at: LngLat, geoid?: string) {
  const mine = ++clickId;
  const bounds =
    lvl === "state" ? stateBoundsOf(geoid) : await frameOf(lvl, at, geoid).catch(() => null);
  if (mine !== clickId || target !== map || lvl !== level || !bounds) return;
  const move = clickMove(target, lvl, bounds);
  if (move === "frame") frame(target, bounds, capOf(lvl));
  else if (move === "pan") {
    const padding = paddingOf(target);
    const [[west, south], [east, north]] = bounds;
    target.easeTo({
      center: [(west + east) / 2, (south + north) / 2],
      offset: [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2],
      duration: moving() * 450,
    });
  }
}

// The point of the last click, whose camera frameClick has already taken care of.
let clicked: LngLat | null = null;
function pick(event: MapLayerMouseEvent) {
  const target = map;
  if (!target) return;
  const geoid = event.features?.[0]?.properties.geoid;
  const at: LngLat = [event.lngLat.lng, event.lngLat.lat];
  const lvl = level;
  // Below a Reveal zoom the states stand in for the Level: a click there only says where to look.
  const own = typeof geoid === "string" && (geoid.length === 2) === (lvl === "state");
  // Where a Level's Units are specks, the one drawn under the pointer is one guess among many. The Unit
  // that contains the point is the answer (ADR-0003), and the Focus dot then sits inside its outline.
  const sure = own && (lvl === "state" || target.getZoom() >= TILES[lvl].outlineZoom);
  clicked = at;
  onpick({ at, geoid: sure ? geoid : undefined });
  void frameClick(target, lvl, at, sure ? geoid : undefined);
}

// The camera frames the Selection when a search, a Level change or a link chose it; a click moves it
// itself (frameClick). A state is always framed whole.
let settled: string | undefined;
$effect(() => {
  if (!mapLoaded || !map || !geometry) return;
  const key = `${level}|${focus}|${selected}`;
  if (key === settled) return;
  settled = key;
  const target = map;
  // The URL keeps five decimals of the clicked point.
  const byClick =
    !!focus && !!clicked?.every((value, axis) => Math.abs(value - focus[axis]) < 1e-4);
  clicked = null;
  if (byClick) return;
  if (focus && level !== "state") {
    const [at, lvl, id] = [focus, level, selected ?? undefined];
    target.stop();
    void frameOf(lvl, at, id)
      .catch(() => null)
      .then((bounds) => {
        if (settled !== key || target !== map) return;
        if (bounds) frame(target, bounds, capOf(lvl));
        else
          target.easeTo({
            center: at,
            zoom: TILES[lvl].focusZoom,
            bearing: 0,
            pitch: 0,
            duration: moving() * 500,
          });
      });
    return;
  }
  // A link from before the Focus names a Unit only: frame its state, or the country for a ZIP.
  const bounds = stateBoundsOf(level === "zcta" ? undefined : selected?.slice(0, 2));
  target.stop();
  frame(
    target,
    bounds ?? NATIONAL_BOUNDS,
    8,
    still || !bounds ? { top: 45, right: 45, bottom: 45, left: 45 } : undefined
  );
});
</script>

<figure
  bind:this={container}
  class="state-map"
  aria-label="Reported closures by {LEVEL_NOUNS[level]
    .one}. With the keyboard, use Find a place to say where to look and View by to choose what is reported there."
  data-state-map={error ? "error" : mapLoaded && geometry ? "ready" : "loading"}
  data-selected-state={selected ?? ""}
  aria-busy={loadingCounts}
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
      interactive={!still}
      attributionControl={still ? false : undefined}
      pixelRatio={still ? Math.max(2, devicePixelRatio) : undefined}
      canvasContextAttributes={still ? { preserveDrawingBuffer: true } : undefined}
      onidle={still ? copyForPrint : undefined}
      onload={() => {
        mapLoaded = true;
      }}
      onerror={handleMapError}
      onmovestart={unhover}
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
          onclick={still ? undefined : pick}
          onmousemove={still ? undefined : hover}
          onmouseleave={unhover}
        />
        <LineLayer
          id="state-hover"
          beforeId="waterway"
          maxzoom={stateMaxZoom}
          filter={["==", ["get", "geoid"], hovered?.length === 2 ? hovered : ""]}
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
              onclick={still ? undefined : pick}
              onmousemove={still ? undefined : hover}
              onmouseleave={unhover}
            />
          </VectorTileSource>
          <!-- Below selectZoom a fine Unit is a speck, and this copy loads no tiles at all. -->
          <VectorTileSource id={OUTLINE_SOURCE} url={tileUrl}>
            <!-- The filter stays fixed until outlines show, so zooming out rebuilds nothing. -->
            <LineLayer
              id="tile-hover"
              sourceLayer={tiles.sourceLayer}
              beforeId="waterway"
              minzoom={tiles.outlineZoom}
              filter={["==", ["get", "geoid"], zoom >= tiles.outlineZoom ? (hovered ?? "") : ""]}
              paint={{ "line-color": "#16406a", "line-width": 1.5 }}
            />
            <LineLayer
              id="tile-selected-casing"
              sourceLayer={tiles.sourceLayer}
              beforeId="focus-dot"
              minzoom={tiles.selectZoom}
              filter={["==", ["get", "geoid"], selected ?? ""]}
              paint={{ "line-color": "#ffffff", "line-width": 6 }}
            />
            <LineLayer
              id="tile-selected"
              sourceLayer={tiles.sourceLayer}
              beforeId="focus-dot"
              minzoom={tiles.selectZoom}
              filter={["==", ["get", "geoid"], selected ?? ""]}
              paint={{ "line-color": "#111827", "line-width": 2.5 }}
            />
          </VectorTileSource>
        {/key}
      {/if}
    </MapLibre>

    {#if error}
      <div in:fade={{ duration: 140 }} class="map-message" role="alert">
        <p>Map unavailable: {error}</p>
        <button class="motion-control" onclick={retry}>Retry map</button>
      </div>
    {:else if !mapLoaded || !geometry}
      <div
        out:fade={{ duration: still ? 0 : 180 }}
        class="map-message pointer-events-none"
        role="status"
      >
        Loading state map…
      </div>
    {:else if notice || loadingCounts || (!still && zoom < revealZoom)}
      <p transition:fade={{ duration: 140 }} class="map-hint" role="status">
        {notice ??
          (loadingCounts
            ? `Loading ${LEVEL_NOUNS[level].one} counts…`
            : `Showing states. Search for a place or click the map to see ${LEVEL_NOUNS[level].many} there.`)}
      </p>
    {/if}

    {#if printCopy}
      <img class="print-copy" src={printCopy} alt="" data-print-copy />
    {/if}

    {#snippet failed(cause)}
      <div class="map-message" role="alert">
        <p>
          Map unavailable: {cause instanceof Error ? cause.message : "Unable to start the map."}
        </p>
        <button class="motion-control" onclick={retry}>Retry map</button>
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
      <p class="text-muted text-xs">
        {hovered && hovered.length > 2 ? `GEOID ${hovered} · ` : ""}Preliminary source output
      </p>
      {#if zoomsIn}
        <p class="text-yale-blue mt-1 text-xs font-semibold">Click to zoom in</p>
      {/if}
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
.state-map :global(.maplibregl-ctrl-attrib) {
  border-radius: 0;
  background: rgb(255 255 255 / 85%);
  color: var(--color-muted);
  font: 11px/18px var(--font-sans);
}
.state-map :global(.maplibregl-ctrl-attrib a) {
  color: inherit;
}
.state-map :global(.maplibregl-ctrl-attrib a:hover) {
  color: var(--color-yale-blue);
}
.state-map :global(.maplibregl-ctrl-attrib-button) {
  opacity: 0.55;
}
.print-copy {
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
@media print {
  .print-copy {
    display: block;
  }
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
  background: #f2f3f5ed;
  color: var(--color-body);
  text-align: center;
  font-size: 0.875rem;
}
.map-hint {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  translate: -50%;
  margin: 0;
  border: 1px solid var(--color-rule);
  padding: 0.45rem 0.9rem;
  background: #ffffffed;
  box-shadow: 0 2px 8px rgb(22 41 66 / 8%);
  color: var(--color-body);
  font-size: 0.8125rem;
  pointer-events: none;
}
.map-message button {
  border: 1px solid #00356b;
  padding: 0.4rem 0.9rem;
  color: #00356b;
  background: white;
  cursor: pointer;
}
</style>
