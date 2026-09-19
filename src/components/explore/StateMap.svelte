<script lang="ts" module>
import { addProtocol } from "maplibre-gl";
import { Protocol } from "pmtiles";

// One reader for the page: it keeps each archive's directory cached across map instances.
addProtocol("pmtiles", new Protocol().tile);
</script>

<script lang="ts">
import { onMount } from "svelte";
import {
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
} from "maplibre-gl";
import { env } from "$env/dynamic/public";
import Tooltip from "$components/chart/Tooltip.svelte";
import { getBlockGroupMetrics } from "$lib/explore/data.remote";
import {
  LEGENDS,
  NO_DATA_COLOR,
  STATES,
  blockGroupLabel,
  blockGroupManifest,
  fmt,
  type Level,
  type StateMetric,
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
  rows,
  selected,
  onselect,
  level,
  windowKey,
  religion,
  zoom = $bindable(3.5),
}: {
  rows: StateMetric[];
  selected: string | null;
  onselect: (geoid: string) => void;
  level: Level;
  windowKey: string;
  religion: string;
  /** The page reads it to show the legend of whichever level is drawn at this zoom. */
  zoom?: number;
} = $props();

const NATIONAL_BOUNDS: [[number, number], [number, number]] = [
  [-125, 24],
  [-66, 50],
];
const colorBy = (
  value: ExpressionSpecification,
  { breaks, classes }: (typeof LEGENDS)[Level]
): ExpressionSpecification => [
  "case",
  ["==", value, null],
  NO_DATA_COLOR,
  [
    "step",
    value,
    classes[0].color,
    ...breaks.flatMap((threshold, index) => [threshold, classes[index + 1].color]),
  ],
];
const fillColor = colorBy(["get", "closed"], LEGENDS.state);
// Block-group metrics never ride in the tiles (ADR-0002): they arrive per state Shard as feature-state.
const blockGroupColor = colorBy(["feature-state", "closed"], LEGENDS.blockgroup);
const BG_SOURCE = "explore-blockgroups";
const { archive, sourceLayer: BG_LAYER, revealZoom } = blockGroupManifest.geometry;
// Outlines only help once block groups are several pixels wide; earlier they wash the map white.
const OUTLINE_FROM_ZOOM = 9;
const blockGroupUrl = `pmtiles://${new URL(`${env.PUBLIC_TILES_URL ?? "/tiles"}/${archive}`, location.href)}`;
const previewStates =
  blockGroupManifest.states.length < 51
    ? blockGroupManifest.states.map((id) => STATES.find((state) => state.id === id)?.name ?? id)
    : null;

let geometry = $state.raw<CountyFeatureCollection>();
let map = $state.raw<MapInstance>();
let container = $state<HTMLElement>();
let hovered = $state<string | null>(null);
let hoveredCount = $state<number | null>(null);
let notice = $state<string | null>(null);
let pointer = $state({ x: 0, y: 0 });
let mapLoaded = $state(false);
let error = $state<string | null>(null);
let active = false;

const byId = $derived(new Map(rows.map((row) => [row.geoid, row])));
const mapData = $derived<CountyFeatureCollection>({
  type: "FeatureCollection",
  features:
    geometry?.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        geoid: String(feature.id),
        closed: byId.get(String(feature.id))?.closed ?? null,
      },
    })) ?? [],
});
const hoveredRow = $derived(hovered ? byId.get(hovered) : undefined);
// Below the Reveal zoom the block-group view keeps the state level on screen, never an empty map.
const stateMaxZoom = $derived(level === "blockgroup" ? revealZoom : 24);
const hoveredName = $derived(
  geometry?.features.find((feature) => feature.id === hovered)?.properties.name
);

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
    generation += 1;
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
  if (details.sourceId === "explore-states") {
    error = `State layer could not be loaded: ${event.error.message}`;
    return;
  }
  if (details.sourceId === BG_SOURCE && !details.tile) {
    // The state view still works, so this stays a notice rather than the blocking error.
    notice = "Block-group boundaries could not be loaded.";
    return;
  }
  if (details.tile || details.sourceId || details.layer || map?.getStyle()) return;
  error = `Map style could not be loaded: ${event.error.message}`;
}

function hover(event: MapLayerMouseEvent) {
  const feature = event.features?.[0];
  hovered = feature?.properties.geoid ?? null;
  hoveredCount = feature?.state.closed ?? null;
  pointer = { x: event.point.x, y: event.point.y };
}

// A slice is one (window, religion). Every slice change starts a new generation, and a Shard response
// may only touch the map while its generation is still current.
// Plain Sets on purpose: reactive ones would make the slice effect depend on its own bookkeeping.
let generation = 0;
const applied = new Set<string>();
const pending = new Set<string>();

function ensureShards() {
  if (!map?.getSource(BG_SOURCE) || !geometry || map.getZoom() < revealZoom) return;
  const token = generation;
  const target = map;
  // A Shard is a state, so the states whose bounding boxes meet the viewport name the Shards. No tile
  // has to load first, so counts arrive alongside the boundaries they colour; MapLibre applies
  // feature-state to tiles that load later.
  const view = target.getBounds();
  const shards = geometry.features
    .filter((feature) => {
      const [[west, south], [east, north]] = featureBounds(feature);
      return (
        west <= view.getEast() &&
        east >= view.getWest() &&
        south <= view.getNorth() &&
        north >= view.getSouth()
      );
    })
    .map((feature) => String(feature.id))
    .filter((id) => blockGroupManifest.states.includes(id));
  for (const shard of shards) {
    if (applied.has(shard) || pending.has(shard)) continue;
    pending.add(shard);
    getBlockGroupMetrics({
      release: blockGroupManifest.release,
      level: "blockgroup",
      boundaryYear: blockGroupManifest.boundaryYear,
      window: windowKey,
      religion,
      shard,
    }).then(
      (counts) => {
        if (token !== generation || !target.getSource(BG_SOURCE)) return;
        for (const [id, closed] of Object.entries(counts))
          target.setFeatureState({ source: BG_SOURCE, sourceLayer: BG_LAYER, id }, { closed });
        pending.delete(shard);
        applied.add(shard);
        notice = null;
      },
      () => {
        if (token !== generation) return;
        // Not marked applied, so the next move retries it.
        pending.delete(shard);
        notice = "Block-group counts could not be loaded. Move the map to retry.";
      }
    );
  }
}

$effect(() => {
  void [level, windowKey, religion];
  if (!mapLoaded || !map || !geometry) return;
  generation += 1;
  applied.clear();
  pending.clear();
  if (map.getSource(BG_SOURCE))
    map.removeFeatureState({ source: BG_SOURCE, sourceLayer: BG_LAYER });
  ensureShards();
});

function select(event: MapLayerMouseEvent) {
  const geoid = event.features?.[0]?.properties.geoid;
  if (typeof geoid === "string") onselect(geoid);
}

$effect(() => {
  if (!mapLoaded || !map || !geometry) return;
  const feature = geometry.features.find((candidate) => String(candidate.id) === selected);
  map.stop();
  map.fitBounds(feature ? featureBounds(feature) : NATIONAL_BOUNDS, {
    padding: 45,
    duration: 650,
    maxZoom: 8,
    bearing: 0,
    pitch: 0,
  });
});
</script>

<figure
  bind:this={container}
  class="state-map"
  aria-label="Source-reported closures by state. Use Find a place to select a state with the keyboard."
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
      maxZoom={level === "blockgroup" ? 15 : 8}
      bind:map
      cursor={hovered ? "pointer" : ""}
      onload={() => {
        mapLoaded = true;
      }}
      onerror={handleMapError}
      onmovestart={() => {
        hovered = null;
      }}
      onmoveend={ensureShards}
      onwebglcontextlost={() => {
        error = "The map's graphics context was lost.";
      }}
    >
      <GeoJSONSource id="explore-states" data={mapData}>
        <FillLayer
          id="state-fill"
          beforeId="waterway"
          maxzoom={stateMaxZoom}
          paint={{
            "fill-color": fillColor,
            "fill-opacity": 0.85,
            "fill-outline-color": "#ffffff",
          }}
          onclick={select}
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
        <LineLayer
          id="state-selected"
          beforeId="waterway"
          filter={["==", ["get", "geoid"], selected ?? ""]}
          paint={{ "line-color": "#111827", "line-width": 3 }}
        />
      </GeoJSONSource>
      {#if level === "blockgroup"}
        <VectorTileSource id={BG_SOURCE} url={blockGroupUrl} promoteId={{ [BG_LAYER]: "geoid" }}>
          <FillLayer
            id="blockgroup-fill"
            sourceLayer={BG_LAYER}
            beforeId="waterway"
            minzoom={revealZoom}
            paint={{
              "fill-color": blockGroupColor,
              "fill-opacity": 0.85,
              "fill-outline-color": [
                "interpolate",
                ["linear"],
                ["zoom"],
                OUTLINE_FROM_ZOOM,
                "rgba(255,255,255,0)",
                OUTLINE_FROM_ZOOM + 2,
                "rgba(255,255,255,0.8)",
              ],
            }}
            onmousemove={hover}
            onmouseleave={() => {
              hovered = null;
            }}
          />
          <LineLayer
            id="blockgroup-hover"
            sourceLayer={BG_LAYER}
            beforeId="waterway"
            minzoom={revealZoom}
            filter={["==", ["get", "geoid"], hovered ?? ""]}
            paint={{ "line-color": "#16406a", "line-width": 1.5 }}
          />
        </VectorTileSource>
      {/if}
    </MapLibre>

    {#if error}
      <div class="map-message" role="alert">
        <p>Map unavailable: {error}</p>
        <button onclick={retry}>Retry map</button>
      </div>
    {:else if !mapLoaded || !geometry}
      <div class="map-message pointer-events-none" role="status">Loading state map…</div>
    {:else if level === "blockgroup" && (notice || zoom < revealZoom)}
      <p class="map-hint" role="status">
        {notice ??
          `Showing states. Zoom in to see block groups.${previewStates ? ` This preview covers ${previewStates.join(", ")}.` : ""}`}
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
      {#if hovered?.length === 12}
        <strong>{blockGroupLabel(hovered)}</strong>
        <p>Reported closures: {fmt(hoveredCount)}</p>
        <p class="text-xs text-gray-600">GEOID {hovered} · Preliminary source output</p>
      {:else}
        <strong>{hoveredName ?? hovered}</strong>
        <p>Reported closures: {fmt(hoveredRow?.closed ?? null)}</p>
        <p class="text-xs text-gray-600">Preliminary source output</p>
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
