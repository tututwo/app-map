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
import real_data from "../../data/real_data.csv";
import { topoToGeo, processCSVData, toDeckGLColor } from "../../lib/utils";

import { GeoJsonLayer } from "@deck.gl/layers";
const US_MAP_CENTER = [-98.5795, 39.8283];
const US_MAP_ZOOM = 3.5;
let { selectedMapMetric } = $props();
const colorKey = "close_4_0005_r_100k";
const colors = ["#E9F6FF", "#BCDDF9", "#88A5EA", "#B389DD", "#CA5D99"];

// --- Map State ---
let mapCenter = $state<[number, number]>(US_MAP_CENTER as [number, number]);
let mapZoom = $state(US_MAP_ZOOM);
let mapBearing = $state(0);
let mapPitch = $state(0);

// --- Interaction State ---
let hoveredCountyId = $state<string | null>(null);
let clickedCountyId = $state<string | null>(null);

// --- Tooltip State ---
let tooltipPosition = $state<{ x: number; y: number } | null>(null);
let hoveredCountyData = $derived(hoveredCountyId ? getCountyData(hoveredCountyId) : null);
let isTooltipOpen = $derived(!!hoveredCountyData);

// --- Elements for Adaptive Positioning ---
let mapContainerElement = $state<HTMLElement | null>(null);

// --- Style constants ---
const HIGHLIGHT_BORDER_COLOR = [255, 255, 255, 255]; // Black, fully opaque
const DEFAULT_BORDER_COLOR = [234, 234, 234, 250]; // Light gray
const HIGHLIGHT_BORDER_WIDTH = 5.5; // Thicker border for highlight
const DEFAULT_BORDER_WIDTH = 1; // Default border width

const colorScale = d3
  .scaleQuantize()
  .domain(d3.extent(real_data, (d) => d[colorKey]))
  .range(colors);

// --- Data Processing ---
const geoData = topoToGeo(usmap);
const { realData, getCountyData } = processCSVData(real_data);

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

let layers = $derived([
  new GeoJsonLayer({
    id: "GeoJsonLayer",
    data: geoData,
    beforeId: "road_path",
    stroked: true,
    filled: true,
    pickable: true,
    autoHighlight: false,

    getFillColor: (d: any) => {
      const countyFeatureId = d.id || d.properties?.GEOID;
      const countyData = realData.get(countyFeatureId);
      return countyData
        ? toDeckGLColor(colorScale(parseFloat(countyData[colorKey])))
        : toDeckGLColor("#cccccc");
    },
    getLineColor: (d: any) => {
      const countyFeatureId = d.id || d.properties?.GEOID;
      if (countyFeatureId === clickedCountyId || countyFeatureId === hoveredCountyId) {
        return HIGHLIGHT_BORDER_COLOR;
      }
      return DEFAULT_BORDER_COLOR;
    },
    getLineWidth: (d: any) => {
      const countyFeatureId = d.id || d.properties?.GEOID;
      if (countyFeatureId === clickedCountyId || countyFeatureId === hoveredCountyId) {
        return HIGHLIGHT_BORDER_WIDTH;
      }
      return DEFAULT_BORDER_WIDTH;
    },
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 0.5,
    lineWidthMaxPixels: 5,
    onClick: (info: any) => {
      if (info.object) {
        const countyFeatureId = info.object.id || info.object.properties?.GEOID;
        if (clickedCountyId === countyFeatureId) {
          clickedCountyId = null;
        } else {
          clickedCountyId = countyFeatureId;
          if (zoomToWhichCounty[countyFeatureId]) {
            flyToCounty(zoomToWhichCounty[countyFeatureId]);
          } else {
            console.warn(`Zoom data not found for county ID: ${countyFeatureId}`);
          }
        }
      }
    },
    onHover: (info: any) => {
      hoveredCountyId = info.object ? info.object.id || info.object.properties?.GEOID : null;
      tooltipPosition = info.object ? { x: info.x, y: info.y } : null;
    },
    updateTriggers: {
      getLineColor: [clickedCountyId, hoveredCountyId],
      getLineWidth: [clickedCountyId, hoveredCountyId],
    },
  }),
]);

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
    zoom={mapZoom}
    pitch={mapPitch}
    minZoom={2}
    bearing={mapBearing}
    center={mapCenter}
  >
    <NavigationControl showCompass={false} />
    <CustomControl>
      <button
        aria-label="Fly to the center of the map"
        class="flex! size-[29px] items-center justify-center rounded-md"
        style="background-image: url(https://static.thenounproject.com/png/619932-200.png); background-size: 24px; background-position: center; background-repeat: no-repeat;"
        onclick={() =>
          flyToCounty({
            longitude: US_MAP_CENTER[0],
            latitude: US_MAP_CENTER[1],
            zoom: US_MAP_ZOOM,
          })}
      ></button>
    </CustomControl>
    <FullScreenControl />
    <GeolocateControl />

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
