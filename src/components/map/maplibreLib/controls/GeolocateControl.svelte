<script lang="ts">
// https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/

import { onDestroy } from "svelte";
import maplibregl from "maplibre-gl";
import { getMapContext } from "../contexts.svelte.js";
import { resetEventListener } from "../utils.js";
import type { Listener, Event } from "../types.js";

type GeolocateEvent = Event<maplibregl.GeolocateControl> & object;

interface Props extends maplibregl.GeolocateControlOptions {
  // Position on the map where the control placed
  position?: maplibregl.ControlPosition;
  // Automatically call trigger() to start locating the user
  autoTrigger?: boolean;
  control?: maplibregl.GeolocateControl;
  // Events
  // https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/#events
  ontrackuserlocationend?: Listener<GeolocateEvent>;
  ontrackuserlocationstart?: Listener<GeolocateEvent>;
  onuserlocationlostfocus?: Listener<GeolocateEvent>;
  onuserlocationfocus?: Listener<GeolocateEvent>;
  ongeolocate?: Listener<GeolocateEvent & GeolocationPosition>;
  onerror?: Listener<GeolocateEvent & GeolocationPositionError>;
  onoutofmaxbounds?: Listener<GeolocateEvent & GeolocationPosition>;
}
let {
  position,
  control = $bindable(),
  autoTrigger = false,
  ontrackuserlocationend,
  ontrackuserlocationstart,
  onuserlocationlostfocus,
  onuserlocationfocus,
  ongeolocate,
  onerror,
  onoutofmaxbounds,
  ...options
}: Props = $props();

const mapCtx = getMapContext();
if (!mapCtx.map) throw new Error("Map instance is not initialized.");

$effect(() => {
  control && mapCtx.map?.removeControl(control);
  control = new maplibregl.GeolocateControl(options);
  mapCtx.map?.addControl(control, position);
});

$effect(() => {
  if (autoTrigger) {
    if (mapCtx.map?.loaded()) {
      control?.trigger();
    } else {
      mapCtx.map?.once("load", () => {
        control?.trigger();
      });
    }
  }
});

$effect(() => resetEventListener(control, "trackuserlocationstart", ontrackuserlocationstart));
$effect(() => resetEventListener(control, "trackuserlocationend", ontrackuserlocationend));
$effect(() => resetEventListener(control, "userlocationlostfocus", onuserlocationlostfocus));
$effect(() => resetEventListener(control, "userlocationfocus", onuserlocationfocus));
$effect(() => resetEventListener(control, "geolocate", ongeolocate));
$effect(() => resetEventListener(control, "error", onerror));
$effect(() => resetEventListener(control, "outofmaxbounds", onoutofmaxbounds));

onDestroy(() => {
  if (control) {
    mapCtx.map?.removeControl(control);
  }
});
</script>

<style>
:global(.maplibregl-ctrl button.maplibregl-ctrl-geolocate .maplibregl-ctrl-icon) {
  background-size: 20px;
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLW1hcC1waW5uZWQtaWNvbiBsdWNpZGUtbWFwLXBpbm5lZCI+PHBhdGggZD0iTTE4IDhjMCAzLjYxMy0zLjg2OSA3LjQyOS01LjM5MyA4Ljc5NWExIDEgMCAwIDEtMS4yMTQgMEM5Ljg3IDE1LjQyOSA2IDExLjYxMyA2IDhhNiA2IDAgMCAxIDEyIDAiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjgiIHI9IjIiLz48cGF0aCBkPSJNOC43MTQgMTRoLTMuNzFhMSAxIDAgMCAwLS45NDguNjgzbC0yLjAwNCA2QTEgMSAwIDAgMCAzIDIyaDE4YTEgMSAwIDAgMCAuOTQ4LTEuMzE2bC0yLTZhMSAxIDAgMCAwLS45NDktLjY4NGgtMy43MTIiLz48L3N2Zz4=) !important;
  z-index: 100000000;
}
</style>
