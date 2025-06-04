<script lang="ts">
import { onMount } from "svelte";
import * as d3 from "d3";
import MapLibre from "$components/maplibreLib/MapLibre.svelte";
import DeckGLOverlay from "$components/maplibreLib/DeckGLOverlay.svelte";

import { zoomToWhichCounty } from "../../data/calculateStateViews";
// GEOJSON DATA
// import countyGeojson from "../data/counties.json"
import usmap from "../../data/counties-10m.json";
// @ts-ignore
import real_data from "../../data/real_data.csv";
import { topoToGeo, processCSVData, toDeckGLColor } from "../../lib/utils";

// COMPONENTS
import TopoJSONLayer from "./TopoJSONLayer";
import { GeoJsonLayer } from "@deck.gl/layers";
import * as topojson from "topojson-client";

const colorKey = "close_4_0005_r_100k";
const colors = ["#E9F6FF", "#BCDDF9", "#88A5EA", "#B389DD", "#CA5D99"];

// Initial map view state
let mapCenter = $state([-98.5795, 39.8283]);
let mapZoom = $state(3.5);
let mapBearing = $state(0);
let mapPitch = $state(0);

// State for hovered and clicked features
let hoveredCountyId = $state<string | null>(null);
let clickedCountyId = $state<string | null>(null);

// --- Style constants for borders ---
const HIGHLIGHT_BORDER_COLOR = [0, 0, 0, 255]; // Black, fully opaque
const DEFAULT_BORDER_COLOR = [234, 234, 234, 255]; // Light gray
const HIGHLIGHT_BORDER_WIDTH = 3.5; // Thicker border for highlight
const DEFAULT_BORDER_WIDTH = 1; // Default border width
// --- Create $derived values for Deck.gl updateTriggers ---
// This makes the dependency explicit for Svelte and ensures a new array reference
// is created when the underlying $state variables change.
const lineAndWidthTriggers = $derived([clickedCountyId, hoveredCountyId]);
// If fill color also depends on reactive state that changes often, create a trigger for it too.
// const fillTriggers = $derived([/* dependencies for getFillColor */]);

const colorScale = d3
  .scaleQuantize()
  .domain(d3.extent(real_data, (d) => d[colorKey])) // Data range (can be adjusted based on your data)
  .range(colors);

const { realData, getCountyData } = processCSVData(real_data);
// Function to update map view state
function flyToCounty(countyZoomData: {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}) {
  mapCenter = [countyZoomData.longitude, countyZoomData.latitude];
  mapZoom = countyZoomData.zoom;
  if (countyZoomData.bearing !== undefined) {
    mapBearing = countyZoomData.bearing;
  }
  if (countyZoomData.pitch !== undefined) {
    mapPitch = countyZoomData.pitch;
  }
}
let layers = $derived([
  new GeoJsonLayer({
    id: "GeoJsonLayer",
    data: topoToGeo(usmap), // Assuming topoToGeo(usmap) is stable or cheap to recompute
    beforeId: "road_path",
    stroked: true,
    filled: true,
    pickable: true,
    autoHighlight: false, // Manual control over border highlighting

    getFillColor: (d: any) => {
      const countyFeatureId = d.id || d.properties?.GEOID; // Adjust to your actual ID property
      const countyData = realData.get(countyFeatureId); // If realData is $state, this is reactive
      return countyData
        ? toDeckGLColor(colorScale(parseFloat(countyData[colorKey])))
        : toDeckGLColor("#cccccc");
    },

    getLineColor: (d: any) => {
      const countyFeatureId = d.id || d.properties?.GEOID;
      // These comparisons use the current values of $state variables from the outer scope
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
          clickedCountyId = null; // Toggle off
        } else {
          clickedCountyId = countyFeatureId; // Select new
          // Fly to the county
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
    },

    // updateTriggers will now receive new arrays with the current values
    // each time 'layers' is re-derived, which Deck.gl can then diff.
    updateTriggers: {
      getLineColor: [clickedCountyId, hoveredCountyId],
      getLineWidth: [clickedCountyId, hoveredCountyId],
      // If getFillColor depends on reactive state not captured by its arguments (d),
      // like if colorKey or colorScale themselves were $state variables, add them here.
      // e.g., getFillColor: [colorKey, someOtherReactiveFillParam]
    },
  }),
]);
</script>

<MapLibre
  class="h-full min-h-[300px] w-full"
  style="	https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
  zoom={mapZoom}
  pitch={mapPitch}
  minZoom={2}
  bearing={mapBearing}
  center={mapCenter}
>
  <DeckGLOverlay interleaved {layers} />
</MapLibre>
