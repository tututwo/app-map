<script lang="ts">
// https://maplibre.org/maplibre-gl-js/docs/API/classes/GlobeControl/

import { onDestroy } from "svelte";
import maplibregl from "maplibre-gl";
import { getMapContext } from "../contexts.svelte.js";

interface Props {
  position?: maplibregl.ControlPosition;
}
let { position }: Props = $props();

const mapCtx = getMapContext();
if (!mapCtx.map) throw new Error("Map instance is not initialized.");

let control: maplibregl.GlobeControl | null = null;
$effect(() => {
  control && mapCtx.map?.removeControl(control);
  control = new maplibregl.GlobeControl();
  mapCtx.map?.addControl(control, position);
});

onDestroy(() => {
  if (control) {
    mapCtx.map?.removeControl(control);
  }
});
</script>
