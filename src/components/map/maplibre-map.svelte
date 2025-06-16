<script lang="ts">
// CRITICAL: Import and apply the patch BEFORE anything else
import { patchMapLibreGL } from "$lib/maplibre-patch";

import { cubicOut } from "svelte/easing";
import * as d3 from "d3";

import MapLibre from "$components/map/maplibreLib/MapLibre.svelte";
import DeckGLOverlay from "$components/map/maplibreLib/DeckGLOverlay.svelte";
import FullScreenControl from "$components/map/maplibreLib/controls/FullScreenControl.svelte";
import GeolocateControl from "$components/map/maplibreLib/controls/GeolocateControl.svelte";
import NavigationControl from "./maplibreLib/controls/NavigationControl.svelte";
import CustomControl from "./maplibreLib/controls/CustomControl.svelte";

import Tooltip from "$components/chart/Tooltip.svelte";
import MapTooltipCard from "./tooltipContent/mapTooltipCard.svelte";

import { zoomToWhichCounty } from "../../data/calculateStateViews";
import usmap from "../../data/counties-10m.json";
// @ts-ignore
import { topoToGeo, toDeckGLColor } from "../../lib/utils";

import { GeoJsonLayer } from "@deck.gl/layers";
import type { Map } from "maplibre-gl";

// --- Style constants ---
const US_MAP_CENTER = [-98.5795, 39.8283];
const US_MAP_ZOOM = 3.5;
const HIGHLIGHT_BORDER_COLOR = [0, 0, 0, 255];
const DEFAULT_BORDER_COLOR = [234, 234, 234, 250];
const HIGHLIGHT_BORDER_WIDTH = 3.5;
const DEFAULT_BORDER_WIDTH = 1;

const usMapGeoData: {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    geometry: { type: "Polygon"; coordinates: [number, number][] };
    properties: Record<string, any>;
  }[];
} = topoToGeo(usmap);

let {
  selectedMapColorKey,
  selectedMapColorDomain = [],
  selectedMapColorRange = ["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"],
  data = [],
  geoid = $bindable(),
  hideControls = false,
} = $props();

const colorKey = "closure";

// --- Map State (Source of Truth) ---
let mapInstance = $state<Map | undefined>(undefined);
let mapCenter = $state<[number, number]>(US_MAP_CENTER as [number, number]);
let mapZoom = $state(US_MAP_ZOOM);
let mapBearing = $state(0);
let mapPitch = $state(0);

// --- Interaction State (Source of Truth) ---
let hoveredCountyId = $state<string | null>(null);

// --- Data Processing (Derived State) ---
const mapData = $derived(new Map(data.map((d) => [d.geoid, d])));
const geoData = $derived.by(() => {
  const features = usMapGeoData.features.map((feature) => {
    const countyData = mapData.get(feature.id);
    return { ...feature, properties: { ...feature.properties, ...countyData } };
  });
  return { ...usMapGeoData, features };
});

const colorScale = $derived.by(() => {
  if (!selectedMapColorKey || data.length === 0) return () => "#ccc";
  return d3.scaleQuantize().domain(selectedMapColorDomain).range(selectedMapColorRange);
});

// --- Tooltip State (Derived State) ---
let tooltipPosition = $state<{ x: number; y: number } | null>(null);
let hoveredCountyData = $derived(hoveredCountyId ? mapData.get(hoveredCountyId) : null);
let isTooltipOpen = $derived(!!hoveredCountyData);

let mapContainerElement = $state<HTMLElement | null>(null);

// --- CORRECTED: Using $derived.by for multi-line logic ---
const highlightedFeature = $derived.by(() => {
  const highlightId = hoveredCountyId || geoid;
  const feature = highlightId ? geoData.features.find((f) => f.id === highlightId) : null;

  // The logic inside remains the same: always return a valid FeatureCollection.
  return {
    type: "FeatureCollection",
    features: feature ? [feature] : [],
  };
});

// --- ARCHITECTURE: Layers are now derived state, not a single monolithic object ---
const baseLayer = $derived(
  new GeoJsonLayer({
    id: "GeoJsonLayer-base",
    data: geoData,
    beforeId: "waterway",
    stroked: true,
    filled: true,
    pickable: true,
    autoHighlight: false,
    getFillColor: (d: any) => {
      const countyData = d.properties;
      if (!selectedMapColorKey) return toDeckGLColor("#ccc", 200);
      let color: string = colorScale(countyData[selectedMapColorKey]) as any;
      return toDeckGLColor(color || "#cccccc");
    },
    getLineColor: DEFAULT_BORDER_COLOR,
    getLineWidth: DEFAULT_BORDER_WIDTH,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 0.5,
    onClick: (info: any) => {
      if (info.object) geoid = info.object.id;
    },
    onHover: (info: any) => {
      hoveredCountyId = info.object ? info.object.id : null;
      tooltipPosition = info.object ? { x: info.x, y: info.y } : null;
    },
    updateTriggers: {
      getFillColor: [selectedMapColorKey, selectedMapColorRange],
    },
    transitions: {
      getFillColor: {
        type: "interpolation",
        duration: 300,
        easing: cubicOut,
      },
    },
  })
);

const highlightLayer = $derived(
  new GeoJsonLayer({
    id: "GeoJsonLayer-highlight",
    data: highlightedFeature,
    filled: false,
    stroked: true,
    getLineColor: HIGHLIGHT_BORDER_COLOR,
    getLineWidth: HIGHLIGHT_BORDER_WIDTH,
    lineWidthUnits: "pixels",
  })
);

const layers = $derived([baseLayer, highlightLayer]);

// --- Side Effects ---
function flyToCounty(countyZoomData: {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}) {
  if (!mapInstance) return;

  // Stop any existing animation before starting a new one
  mapInstance.stop();

  const flyToOptions: maplibregl.FlyToOptions = {
    center: [countyZoomData.longitude, countyZoomData.latitude],
    zoom: countyZoomData.zoom * 0.88,
    bearing: countyZoomData.bearing ?? mapBearing,
    pitch: countyZoomData.pitch ?? mapPitch,
    duration: 1300, // You can adjust animation duration
    essential: true, // Ensures animation runs even with prefers-reduced-motion
  };

  mapInstance.flyTo(flyToOptions);
}

function handleMouseLeave() {
  hoveredCountyId = null;
  tooltipPosition = null;
}

// Correct use of $effect for a side effect
$effect(() => {
  // A special case for the US view
  if (geoid === "00000") {
    if (mapInstance) {
      mapInstance.stop(); // Stop current animation
      mapInstance.flyTo({
        center: US_MAP_CENTER,
        zoom: US_MAP_ZOOM,
        bearing: 0,
        pitch: 0,
        essential: true,
      });
    }
  } else if (zoomToWhichCounty[geoid]) {
    flyToCounty(zoomToWhichCounty[geoid]);
  }
});
</script>

<figure
  bind:this={mapContainerElement}
  class="relative h-full w-full"
  class:hide-map-controls={hideControls}
  onmouseleave={handleMouseLeave}
>
  <MapLibre
    class="h-full min-h-[200px] w-full"
    style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    minZoom={2}
    maxZoom={8}
    bind:pitch={mapPitch}
    bind:bearing={mapBearing}
    bind:zoom={mapZoom}
    bind:center={mapCenter}
    bind:map={mapInstance}
  >
    <NavigationControl showCompass={false} position="top-left" />
    <CustomControl position="top-left">
      <button
        aria-label="Fly to the center of the map"
        class="flex! size-[29px] items-center justify-center rounded-md"
        style="background-image: url(https://static.thenounproject.com/png/619932-200.png); background-size: 24px; background-position: center; background-repeat: no-repeat;"
        onclick={() => {
          geoid = "00000";
        }}
      ></button>
    </CustomControl>
    <FullScreenControl position="top-left" />
    <GeolocateControl position="top-left" {mapZoom} />

    <DeckGLOverlay interleaved {layers} />
  </MapLibre>

  <Tooltip
    x={tooltipPosition?.x ?? 0}
    y={tooltipPosition?.y ?? 0}
    open={isTooltipOpen}
    alignOffset={10}
    boundary={mapContainerElement}
    preferredSide="right"
    sideOffset={30}
    showArrow={false}
  >
    {#if hoveredCountyData}
      <MapTooltipCard
        data={hoveredCountyData}
        autoGenerate={true}
        excludeFields={["geoid", "name", "reopening"]}
      />
    {/if}
  </Tooltip>
</figure>

<style>
.hide-map-controls :global(.maplibregl-control-container) {
  display: none;
}
</style>
