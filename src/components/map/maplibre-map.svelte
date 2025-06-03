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
const colorScale = d3
  .scaleQuantize()
  .domain(d3.extent(real_data, (d) => d[colorKey])) // Data range (can be adjusted based on your data)
  .range(colors);

const { realData, getCountyData } = processCSVData(real_data);

let layers = $state([
  new GeoJsonLayer({
    id: "GeoJsonLayer",
    data: topoToGeo(usmap),
    beforeId: "waterway",
    stroked: true,
    filled: true,
    pointType: "circle+text",
    pickable: true,

    getFillColor: (d) => {
      const countyData = realData.get(d.id);
      return countyData ? toDeckGLColor(colorScale(countyData[colorKey])) : toDeckGLColor("#ccc");
    },
    // line styles
    getLineColor: [234, 234, 234, 255],
    getLineWidth: 1,
    lineWidthMinPixels: 0.5,
    lineWidthMaxPixels: 2,
    lineWidthUnits: "pixels",
    getPointRadius: 4,
    getTextSize: 12,
  }),
]);
</script>

<MapLibre
  class="h-full min-h-[300px] w-full"
  style="	https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
  zoom={3.5}
  pitch={0}
  minZoom={2}
  bearing={0}
  center={[-98.5795, 39.8283]}
>
  <DeckGLOverlay interleaved {layers} />
</MapLibre>
