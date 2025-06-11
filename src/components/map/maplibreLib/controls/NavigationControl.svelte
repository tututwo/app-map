<script lang="ts">
// https://maplibre.org/maplibre-gl-js/docs/API/classes/NavigationControl/

import { onDestroy } from "svelte";
import maplibregl from "maplibre-gl";
import { getMapContext } from "../contexts.svelte.js";

interface Props extends maplibregl.NavigationControlOptions {
  position?: maplibregl.ControlPosition;
}
let { position, ...options }: Props = $props();

const mapCtx = getMapContext();
if (!mapCtx.map) throw new Error("Map instance is not initialized.");

let control: maplibregl.NavigationControl | null = null;
$effect(() => {
  control && mapCtx.map?.removeControl(control);
  control = new maplibregl.NavigationControl($state.snapshot(options));
  mapCtx.map?.addControl(control, position);
});

onDestroy(() => {
  if (control) {
    mapCtx.map?.removeControl(control);
  }
});
</script>

<style>
:global(.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon) {
  background-size: 25px;
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXBsdXMtaWNvbiBsdWNpZGUtcGx1cyI+PHBhdGggZD0iTTUgMTJoMTQiLz48cGF0aCBkPSJNMTIgNXYxNCIvPjwvc3ZnPg==) !important;
  z-index: 100000000;
}
:global(.maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon) {
  background-size: 25px;
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLW1pbnVzLWljb24gbHVjaWRlLW1pbnVzIj48cGF0aCBkPSJNNSAxMmgxNCIvPjwvc3ZnPg==) !important;
  z-index: 100000000;
}
</style>
