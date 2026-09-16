<script lang="ts">
import { onMount } from "svelte";
import { FillLayer, GeoJSONSource, LineLayer, MapLibre } from "svelte-maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import type {
  ErrorEvent,
  ExpressionSpecification,
  Map as MapInstance,
  MapLayerMouseEvent,
} from "maplibre-gl";
import Tooltip from "$components/chart/Tooltip.svelte";
import { BREAKS, CLASSES, NO_DATA_COLOR, fmt, type StateMetric } from "$lib/explore/model";
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
}: {
  rows: StateMetric[];
  selected: string | null;
  onselect: (geoid: string) => void;
} = $props();

const NATIONAL_BOUNDS: [[number, number], [number, number]] = [
  [-125, 24],
  [-66, 50],
];
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const fillColor: ExpressionSpecification = [
  "case",
  ["==", ["get", "closed"], null],
  NO_DATA_COLOR,
  [
    "step",
    ["get", "closed"],
    CLASSES[0].color,
    ...BREAKS.flatMap((threshold, index) => [threshold, CLASSES[index + 1].color]),
  ],
];

let geometry = $state.raw<CountyFeatureCollection>();
let map = $state.raw<MapInstance>();
let container = $state<HTMLElement>();
let hovered = $state<string | null>(null);
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
  if (details.tile || details.sourceId || details.layer || map?.getStyle()) return;
  error = `Map style could not be loaded: ${event.error.message}`;
}

function hover(event: MapLayerMouseEvent) {
  hovered = event.features?.[0]?.properties.geoid ?? null;
  pointer = { x: event.point.x, y: event.point.y };
}

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
      style={MAP_STYLE}
      autoloadGlobalCss={false}
      center={[-98.5795, 39.8283]}
      zoom={3.5}
      minZoom={2}
      maxZoom={8}
      bind:map
      cursor={hovered ? "pointer" : ""}
      onload={() => {
        mapLoaded = true;
      }}
      onerror={handleMapError}
      onmovestart={() => {
        hovered = null;
      }}
      onwebglcontextlost={() => {
        error = "The map's graphics context was lost.";
      }}
    >
      <GeoJSONSource id="explore-states" data={mapData}>
        <FillLayer
          id="state-fill"
          beforeId="waterway"
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
    </MapLibre>

    {#if error}
      <div class="map-message" role="alert">
        <p>Map unavailable: {error}</p>
        <button onclick={retry}>Retry map</button>
      </div>
    {:else if !mapLoaded || !geometry}
      <div class="map-message pointer-events-none" role="status">Loading state map…</div>
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
      <strong>{hoveredName ?? hovered}</strong>
      <p>Reported closures: {fmt(hoveredRow?.closed ?? null)}</p>
      <p class="text-xs text-gray-600">Preliminary source output</p>
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
.map-message button {
  border: 1px solid #00356b;
  border-radius: 0.25rem;
  padding: 0.4rem 0.9rem;
  color: #00356b;
  background: white;
  cursor: pointer;
}
</style>
