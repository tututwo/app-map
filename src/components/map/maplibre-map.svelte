<script lang="ts">
// CRITICAL: Import and apply the patch BEFORE anything else
import { patchMapLibreGL } from "$lib/maplibre-patch";

import { onMount } from "svelte";
import * as d3 from "d3";

import MapLibre from "$components/map/maplibreLib/MapLibre.svelte";
import DeckGLOverlay from "$components/map/maplibreLib/DeckGLOverlay.svelte";
import FullScreenControl from "$components/map/maplibreLib/controls/FullScreenControl.svelte";
import GeolocateControl from "$components/map/maplibreLib/controls/GeolocateControl.svelte";
import NavigationControl from "./maplibreLib/controls/NavigationControl.svelte";
// import AttributionControl from "$components/map/maplibreLib/controls/AttributionControl.svelte";
import CustomControl from "./maplibreLib/controls/CustomControl.svelte";

import Tooltip from "$components/chart/Tooltip.svelte";
import MapTooltipCard from "./tooltipContent/mapTooltipCard.svelte";

import { zoomToWhichCounty } from "../../data/calculateStateViews";
import usmap from "../../data/counties-10m.json";
// @ts-ignore
import { topoToGeo, processCSVData, toDeckGLColor } from "../../lib/utils";

import { GeoJsonLayer } from "@deck.gl/layers";
const US_MAP_CENTER = [-98.5795, 39.8283];
const US_MAP_ZOOM = 3.5;
const usMapGeoData: {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    geometry: {
      type: "Polygon";
      coordinates: [number, number][];
    };
    properties: Record<string, any>;
  }[];
} = topoToGeo(usmap);

let {
  selectedMapColorKey,
  data = [],
  geoid = $bindable(),
  colors = ["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"],
} = $props();

const colorKey = "closure";

// --- Map State ---
let mapCenter = $state<[number, number]>(US_MAP_CENTER as [number, number]);
let mapZoom = $state(US_MAP_ZOOM);
let mapBearing = $state(0);
let mapPitch = $state(0);

// --- Interaction State ---
let hoveredCountyId = $state<string | null>(null);

const mapData = $derived(new Map(data.map((d) => [d.geoid, d])));
// merge mapData into geojson properties
const geoData = $derived.by(() => {
  const features = usMapGeoData.features.map((feature) => {
    const countyData = mapData.get(feature.id);
    return {
      ...feature,
      properties: { ...feature.properties, ...countyData },
    };
  });

  return {
    ...usMapGeoData,
    features,
  };
});

$inspect(geoData);

// --- Tooltip State ---
let tooltipPosition = $state<{ x: number; y: number } | null>(null);
let hoveredCountyData = $derived(hoveredCountyId ? mapData.get(hoveredCountyId) : null);
let isTooltipOpen = $derived(!!hoveredCountyData);

// --- Elements for Adaptive Positioning ---
let mapContainerElement = $state<HTMLElement | null>(null);

// --- Style constants ---
const HIGHLIGHT_BORDER_COLOR = [255, 255, 255, 255]; // Black, fully opaque
const DEFAULT_BORDER_COLOR = [234, 234, 234, 250]; // Light gray
const HIGHLIGHT_BORDER_WIDTH = 5.5; // Thicker border for highlight
const DEFAULT_BORDER_WIDTH = 1; // Default border width

let colorScale = $derived.by(() => {
  console.log("Recalculating colorScale with key:", selectedMapColorKey);
  if (!selectedMapColorKey || data.length === 0) return () => "#ccc";

  const domain = d3.extent(data, (d) => +d[selectedMapColorKey]);
  if (domain[0] === undefined || domain[1] === undefined) return () => "#ccc";

  return d3.scaleQuantize().domain(domain).range(colors);
});

function flyToCounty(countyZoomData: {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}) {
  mapCenter = [countyZoomData.longitude, countyZoomData.latitude];

  mapZoom = countyZoomData.zoom * 0.88;
  if (countyZoomData.bearing !== undefined) {
    mapBearing = countyZoomData.bearing;
  }
  if (countyZoomData.pitch !== undefined) {
    mapPitch = countyZoomData.pitch;
  }
}

function handleMouseLeave() {
  hoveredCountyId = null;
  tooltipPosition = null;
}

const layers = $derived([
  new GeoJsonLayer({
    id: "GeoJsonLayer",
    data: geoData,
    beforeId: "road_path",
    stroked: true,
    filled: true,
    pickable: true,
    autoHighlight: false,

    getFillColor: (d) => {
      const countyData = d.properties;
      if (!selectedMapColorKey) return toDeckGLColor("#ccc");
      let color: string = colorScale(countyData[selectedMapColorKey]) as any;
      if (!color) color = "#cccccc";
      return toDeckGLColor(color);
    },
    getLineColor: (d: any) => {
      const countyFeatureId = d.id;
      if (countyFeatureId === geoid || countyFeatureId === hoveredCountyId) {
        return HIGHLIGHT_BORDER_COLOR;
      }
      return DEFAULT_BORDER_COLOR;
    },
    getLineWidth: (d: any) => {
      const countyFeatureId = d.id;
      if (countyFeatureId === geoid || countyFeatureId === hoveredCountyId) {
        return HIGHLIGHT_BORDER_WIDTH;
      }
      return DEFAULT_BORDER_WIDTH;
    },
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 0.5,
    lineWidthMaxPixels: 5,
    onClick: (info: any) => {
      if (info.object) {
        const countyFeatureId = info.object.id;
        // two way binding: pass the geoid to the parent component
        geoid = countyFeatureId;
      }
    },
    onHover: (info: any) => {
      hoveredCountyId = info.object ? info.object.id : null;
      tooltipPosition = info.object ? { x: info.x, y: info.y } : null;
    },
    updateTriggers: {
      getFillColor: [selectedMapColorKey, colors],
      getLineColor: [geoid, hoveredCountyId],
      getLineWidth: [geoid, hoveredCountyId],
    },
  }),
]);

$effect(() => {
  if (zoomToWhichCounty[geoid]) {
    flyToCounty(zoomToWhichCounty[geoid]);
  } else {
    console.warn(`Zoom data not found for county ID: ${geoid}`);
  }
});

// --- Tooltip State ---
const fayetteStats = $state([
  { label: "Closed church", value: 25 },
  { label: "per 100k", value: 1.6 },
  { label: "per sqkm", value: 0.3 },
]);
</script>

<figure
  bind:this={mapContainerElement}
  class="relative h-full w-full"
  onmouseleave={handleMouseLeave}
>
  <MapLibre
    class="h-full min-h-[200px] w-full"
    style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    minZoom={2}
    bind:zoom={mapZoom}
    bind:pitch={mapPitch}
    bind:bearing={mapBearing}
    bind:center={mapCenter}
  >
    <NavigationControl showCompass={false} position="top-left" />
    <CustomControl position="top-left">
      <button
        aria-label="Fly to the center of the map"
        class="flex! size-[29px] items-center justify-center rounded-md"
        style="background-image: url(https://static.thenounproject.com/png/619932-200.png); background-size: 24px; background-position: center; background-repeat: no-repeat;"
        onclick={() => {
          flyToCounty({
            longitude: US_MAP_CENTER[0],
            latitude: US_MAP_CENTER[1],
            zoom: US_MAP_ZOOM,
          });
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
    sideOffset={15}
    showArrow={false}
  >
    {#if hoveredCountyData}
      <MapTooltipCard data={hoveredCountyData} {colorKey} locationName={hoveredCountyData.name} />
    {/if}
  </Tooltip>
</figure>
