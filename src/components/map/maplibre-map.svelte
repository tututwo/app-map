<script lang="ts">
import { cubicOut } from "svelte/easing";
import { onMount } from "svelte";
import * as d3 from "d3";

import {
  CustomControl,
  FullScreenControl,
  GeolocateControl,
  MapLibre,
  NavigationControl,
} from "svelte-maplibre-gl";
import { DeckGLOverlay } from "@svelte-maplibre-gl/deckgl";

import Tooltip from "$components/chart/Tooltip.svelte";
import MapTooltipCard from "./tooltipContent/mapTooltipCard.svelte";

import { loadMapAssets, type CountyCameraLookup } from "$lib/map/static-assets";
import { reverseGeocodeCounty } from "$lib/utils/searchCounty2010Census.js";
// @ts-ignore
import { topoToGeo, toDeckGLColor } from "../../lib/utils";

import { GeoJsonLayer } from "@deck.gl/layers";
import type { FeatureCollection, Geometry } from "geojson";
import type { FlyToOptions, Map as MapLibreInstance } from "maplibre-gl";

// --- Style constants ---
const US_MAP_CENTER: [number, number] = [-98.5795, 39.8283];
const US_MAP_ZOOM = 3.5;
const HIGHLIGHT_BORDER_COLOR: [number, number, number, number] = [0, 0, 0, 255];
const DEFAULT_BORDER_COLOR: [number, number, number, number] = [234, 234, 234, 250];
const HIGHLIGHT_BORDER_WIDTH = 3.5;
const DEFAULT_BORDER_WIDTH = 1;

type CountyFeatureCollection = FeatureCollection<Geometry, Record<string, any>>;

let usMapGeoData = $state<CountyFeatureCollection>({
  type: "FeatureCollection",
  features: [],
});
let countyCameras = $state<CountyCameraLookup>({});

onMount(() => {
  let active = true;

  void loadMapAssets()
    .then(({ countiesTopology, countyCameras: loadedCountyCameras }) => {
      if (!active) return;
      usMapGeoData = topoToGeo(countiesTopology) as CountyFeatureCollection;
      countyCameras = loadedCountyCameras;
    })
    .catch((error) => {
      console.error("Failed to load map assets:", error);
    });

  return () => {
    active = false;
  };
});

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
let mapInstance = $state<MapLibreInstance | undefined>(undefined);
let mapCenter = $state<[number, number]>(US_MAP_CENTER as [number, number]);
let mapZoom = $state(US_MAP_ZOOM);
let mapBearing = $state(0);
let mapPitch = $state(0);

// --- Interaction State (Source of Truth) ---
let hoveredCountyId = $state<string | null>(null);

// --- Data Processing (Derived State) ---
const mapData = $derived(new Map(data.map((d) => [d.geoid, d])));

const geoData = $derived.by<CountyFeatureCollection>(() => {
  const features = usMapGeoData.features.map((feature) => {
    const countyData = mapData.get(String(feature.id));
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
const highlightedFeature = $derived.by<CountyFeatureCollection>(() => {
  const highlightId = hoveredCountyId || geoid;
  const feature = highlightId
    ? geoData.features.find((candidate) => String(candidate.id) === highlightId)
    : null;

  // The logic inside remains the same: always return a valid FeatureCollection.
  return {
    type: "FeatureCollection",
    features: feature ? [feature] : [],
  };
});

let wasSetByGeolocator = $state(false);
let geolocationGeneration = 0;
let geolocatorTargetGeoid: string | null = null;
let observedGeoid = geoid;

function cancelGeolocationSelection() {
  geolocationGeneration += 1;
  geolocatorTargetGeoid = null;
  wasSetByGeolocator = false;
}

function selectCounty(nextGeoid: string, nextDisplayName: string) {
  cancelGeolocationSelection();
  geoid = nextGeoid;
  displayName = nextDisplayName;
}

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
        const nextGeoid = String(info.object.id);
        const countyData = mapData.get(nextGeoid);
        selectCounty(nextGeoid, countyData?.name || nextGeoid);
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

  const flyToOptions: FlyToOptions = {
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
  } else if (countyCameras[geoid]) {
    flyToCounty(countyCameras[geoid]);
  }
});

$effect(() => {
  const nextGeoid = geoid;
  if (nextGeoid === observedGeoid) return;

  observedGeoid = nextGeoid;
  if (nextGeoid !== geolocatorTargetGeoid) {
    cancelGeolocationSelection();
  }
});

async function handleGeolocate(event: GeolocationPosition) {
  const requestGeneration = ++geolocationGeneration;
  const geoidAtRequest = geoid;

  wasSetByGeolocator = true;
  mapInstance?.stop();

  const county = await reverseGeocodeCounty(event.coords.latitude, event.coords.longitude);

  if (requestGeneration !== geolocationGeneration || geoid !== geoidAtRequest || !county?.geoid) {
    return;
  }

  geolocatorTargetGeoid = county.geoid;
  observedGeoid = county.geoid;
  geoid = county.geoid;
  displayName = county.displayName;
}
</script>

<figure
  bind:this={mapContainerElement}
  class="relative h-full w-full"
  class:hide-map-controls={hideControls}
  class:at-us-view={isAtUSView}
  class:hide-geolocator-dot={!wasSetByGeolocator || mapZoom > 4}
  onmouseleave={handleMouseLeave}
>
  <MapLibre
    class="h-full min-h-[200px] w-full"
    style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    autoloadGlobalCss={false}
    canvasContextAttributes={{
      preserveDrawingBuffer: true,
      antialias: true,
      stencil: true,
      alpha: true,
    }}
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
          selectCounty("00000", "All locations");
        }}
      ></button>
    </CustomControl>
    <FullScreenControl position="top-left" />
    <GeolocateControl
      position="top-left"
      trackUserLocation={false}
      showUserLocation={true}
      ongeolocate={handleGeolocate}
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

:global(.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon) {
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXBsdXMtaWNvbiBsdWNpZGUtcGx1cyI+PHBhdGggZD0iTTUgMTJoMTQiLz48cGF0aCBkPSJNMTIgNXYxNCIvPjwvc3ZnPg==) !important;
  background-size: 25px;
}

:global(.maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon) {
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLW1pbnVzLWljb24gbHVjaWRlLW1pbnVzIj48cGF0aCBkPSJNNSAxMmgxNCIvPjwvc3ZnPg==) !important;
  background-size: 25px;
}

:global(.maplibregl-ctrl button.maplibregl-ctrl-geolocate .maplibregl-ctrl-icon) {
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLW1hcC1waW5uZWQtaWNvbiBsdWNpZGUtbWFwLXBpbm5lZCI+PHBhdGggZD0iTTE4IDhjMCAzLjYxMy0zLjg2OSA3LjQyOS01LjM5MyA4Ljc5NWExIDEgMCAwIDEtMS4yMTQgMEM5Ljg3IDE1LjQyOSA2IDExLjYxMyA2IDhhNiA2IDAgMCAxIDEyIDAiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjgiIHI9IjIiLz48cGF0aCBkPSJNOC43MTQgMTRoLTMuNzFhMSAxIDAgMCAwLS45NDguNjgzbC0yLjAwNCA2QTEgMSAwIDAgMCAwIDMgMjJoMThhMSAxIDAgMCAwIC45NDgtMS4zMTZsLTItNmExIDEgMCAwIDAtLjk0OS0uNjg0aC0zLjcxMiIvPjwvc3ZnPg==) !important;
  background-size: 20px;
}

:global(.maplibregl-ctrl button.maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon) {
  background-size: 25px !important;
}
</style>
