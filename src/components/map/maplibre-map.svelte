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
  displayName = $bindable(),
  hideControls = false,
  selectedQuantile = -1,
  quantileHighlightEnabled = false,
} = $props();

let isAtUSView = $derived(geoid === "00000");

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

// Calculate which values fall into the selected quantile
const quantileThresholds = $derived.by(() => {
  if (!selectedMapColorKey || selectedQuantile < 0 || !quantileHighlightEnabled) return null;

  const scale = d3.scaleQuantize().domain(selectedMapColorDomain).range(selectedMapColorRange);

  const thresholds = scale.thresholds();
  const min = selectedMapColorDomain[0];
  const max = selectedMapColorDomain[1];

  // Calculate the range for the selected quantile
  if (selectedQuantile === 0) {
    return [min, thresholds[0]];
  } else if (selectedQuantile === thresholds.length) {
    return [thresholds[thresholds.length - 1], max];
  } else {
    return [thresholds[selectedQuantile - 1], thresholds[selectedQuantile]];
  }
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

// Add state to track if location was set by geolocator
let wasSetByGeolocator = $state(false);
let shouldDisableGeolocatorTracking = $state(false);

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

      const value = countyData[selectedMapColorKey];
      let color: string = colorScale(value) as any;

      // Check if this county should be highlighted based on quantile selection
      if (quantileThresholds && value !== undefined && value !== null) {
        const [min, max] = quantileThresholds;
        const isInSelectedQuantile = value >= min && value <= max;

        if (isInSelectedQuantile) {
          // Keep the original color for selected quantile
          return toDeckGLColor(color || "#cccccc");
        } else {
          // Dim non-selected counties
          return toDeckGLColor(color || "#cccccc", 20); // Lower opacity
        }
      }

      return toDeckGLColor(color || "#cccccc");
    },
    getLineColor: DEFAULT_BORDER_COLOR,
    getLineWidth: DEFAULT_BORDER_WIDTH,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 0.5,
    onClick: (info: any) => {
      if (info.object) {
        // User clicked on map - not from geolocator
        wasSetByGeolocator = false;
        shouldDisableGeolocatorTracking = true;

        geoid = info.object.id;
        const countyData = mapData.get(info.object.id);
        displayName = countyData?.name || info.object.id;
      }
    },
    onHover: (info: any) => {
      hoveredCountyId = info.object ? info.object.id : null;
      tooltipPosition = info.object ? { x: info.x, y: info.y } : null;
    },
    updateTriggers: {
      getFillColor: [
        selectedMapColorKey,
        selectedMapColorRange,
        selectedQuantile,
        quantileHighlightEnabled,
        quantileThresholds,
      ],
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

// Add callback for geolocator updates
function handleGeolocatorUpdate(
  newGeoid: string,
  newDisplayName: string,
  fromGeolocator: boolean = false
) {
  if (fromGeolocator) {
    wasSetByGeolocator = true;
    shouldDisableGeolocatorTracking = false;
  }
}
</script>

<figure
  bind:this={mapContainerElement}
  class="relative h-full w-full"
  class:hide-map-controls={hideControls}
  class:at-us-view={isAtUSView}
  class:hide-geolocator-dot={!wasSetByGeolocator}
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
          // User clicked reset - not from geolocator
          wasSetByGeolocator = false;
          shouldDisableGeolocatorTracking = true;

          geoid = "00000";
          displayName = "All locations";
        }}
      ></button>
    </CustomControl>
    <FullScreenControl position="top-left" />
    <GeolocateControl
      position="top-left"
      {mapZoom}
      bind:geoid
      bind:displayName
      bind:shouldDisableTracking={shouldDisableGeolocatorTracking}
      onLocationUpdate={handleGeolocatorUpdate}
    />

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
        {selectedMapColorKey}
        selectedMapColorKeyBackgroundColor={selectedMapColorRange[4]}
      />
    {/if}
  </Tooltip>
</figure>

<style>
.hide-map-controls :global(.maplibregl-control-container) {
  display: none;
}
.at-us-view
  :global(
    .maplibregl-user-location-dot.maplibregl-marker.maplibregl-marker-anchor-center.__web-inspector-hide-shortcut__
  ) {
  display: none !important;
}

/* Hide geolocator dot when not actively tracking */
.hide-geolocator-dot :global(.maplibregl-user-location-dot) {
  display: none !important;
}
</style>
