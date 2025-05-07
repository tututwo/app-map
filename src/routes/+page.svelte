<script lang="ts">
  import { onMount } from "svelte";
  import { MapLibre, FillExtrusionLayer } from "svelte-maplibre-gl";
  import { DeckGLOverlay } from "svelte-maplibre-gl/deckgl";

  // GEOJSON DATA
  import countyGeojson from "../data/counties.json"

  // COMPONENTS
  import TopoJSONLayer from "../components/map/TopoJSONLayer";
  import { GeoJsonLayer } from "@deck.gl/layers";
  import * as topojson from "topojson-client";
  const colorKey = "n_medincome";

  console.log(countyGeojson)
  let layers = $state([
    new GeoJsonLayer({
      id: "GeoJsonLayer",
      data: countyGeojson,

      stroked: false,
      filled: true,
      pointType: "circle+text",
      pickable: true,

      getFillColor: d => {
 
        return [160, 160, 180, 200]
      },
      getLineWidth: 20,
      getPointRadius: 4,
      getTextSize: 12,
    }),
  ]);
</script>

<MapLibre
  class="h-[100vh] min-h-[300px]"
  style="https://geoserveis.icgc.cat/contextmaps/icgc_delimitacio_gris.json"
  zoom={5}
  pitch={0}
  minZoom={2}
  bearing={0}
  center={[-98.5795, 39.8283]}
>
  <DeckGLOverlay interleaved {layers} />
</MapLibre>
