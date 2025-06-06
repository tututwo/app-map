<script lang="ts">
import { onMount } from "svelte";
import * as d3 from "d3";
import { MapLibre } from "svelte-maplibre-gl";
import { DeckGLOverlay } from "svelte-maplibre-gl/deckgl";

// Import and apply the patch BEFORE importing anything else that uses MapLibre
import { patchMapLibreGL } from "./utils";

// Apply the patch immediately
patchMapLibreGL();

// Your existing imports...
import usmap from "../../data/counties-10m.json";
// @ts-ignore
import real_data from "../../data/real_data.csv";
import { topoToGeo, processCSVData, toDeckGLColor } from "../../lib/utils";
import { GeoJsonLayer } from "@deck.gl/layers";

const colorKey = "close_4_0005_r_100k";
const colors = ["#E9F6FF", "#BCDDF9", "#88A5EA", "#B389DD", "#CA5D99"];
const colorScale = d3
  .scaleQuantize()
  .domain(d3.extent(real_data, (d) => d[colorKey]))
  .range(colors);

const { realData, getCountyData } = processCSVData(real_data);

let map = $state<MapLibre>();

let layers = $state([
  new GeoJsonLayer({
    id: "GeoJsonLayer",
    data: topoToGeo(usmap),
    stroked: true,
    filled: true,
    pointType: "circle+text",
    pickable: true,
    getFillColor: (d) => {
      const countyData = realData.get(d.id);
      return countyData ? toDeckGLColor(colorScale(countyData[colorKey])) : toDeckGLColor("#ccc");
    },
    getLineColor: [234, 234, 234, 255],
    getLineWidth: 1,
    lineWidthMinPixels: 0.5,
    lineWidthMaxPixels: 2,
    lineWidthUnits: "pixels",
    getPointRadius: 4,
    getTextSize: 12,
  }),
]);

const mapProps = {
  class: "h-full min-h-[300px] w-full",
  style: "https://geoserveis.icgc.cat/contextmaps/icgc_delimitacio_gris.json",
  zoom: 3.5,
  pitch: 0,
  minZoom: 2,
  bearing: 0,
  center: [-98.5795, 39.8283],
  preserveDrawingBuffer: true, // This should now work!
} as any;

$effect(() => {
  if (map) {
    const canvas = map.getCanvas();
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

    if (gl) {
      const preserveBuffer = gl.getContextAttributes()?.preserveDrawingBuffer;
      console.log("✅ Final preserveDrawingBuffer check:", preserveBuffer);

      if (preserveBuffer) {
        console.log("🎉 SUCCESS! preserveDrawingBuffer is now enabled");

        // Test canvas capture
        setTimeout(() => {
          try {
            const dataURL = canvas.toDataURL("image/png");
            console.log("📸 Canvas capture test:", dataURL.length > 1000 ? "SUCCESS" : "FAILED");
          } catch (error) {
            console.error("❌ Canvas capture failed:", error);
          }
        }, 1000);
      } else {
        console.log("❌ preserveDrawingBuffer is still false - patch didn't work");
      }
    }
  }
});
</script>

<MapLibre bind:map {...mapProps}>
  <DeckGLOverlay interleaved {layers} />
</MapLibre>
