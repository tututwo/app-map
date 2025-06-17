<script lang="ts">
// https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/

import { onDestroy } from "svelte";
import maplibregl from "maplibre-gl";
import { getMapContext } from "../contexts.svelte.js";
import { resetEventListener } from "../utils.js";
import type { Listener, Event } from "../types.js";
import { reverseGeocodeCounty } from "$lib/utils/searchCounty2010Census.js";

type GeolocateEvent = Event<maplibregl.GeolocateControl> & object;

interface Props extends maplibregl.GeolocateControlOptions {
  // Position on the map where the control placed
  position?: maplibregl.ControlPosition;
  // Automatically call trigger() to start locating the user
  autoTrigger?: boolean;
  control?: maplibregl.GeolocateControl;
  mapZoom?: number;
  // Events
  // https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/#events
  ontrackuserlocationend?: Listener<GeolocateEvent>;
  ontrackuserlocationstart?: Listener<GeolocateEvent>;
  onuserlocationlostfocus?: Listener<GeolocateEvent>;
  onuserlocationfocus?: Listener<GeolocateEvent>;
  ongeolocate?: Listener<GeolocateEvent & GeolocationPosition>;
  onerror?: Listener<GeolocateEvent & GeolocationPositionError>;
  onoutofmaxbounds?: Listener<GeolocateEvent & GeolocationPosition>;
  geoid?: string;
  displayName?: string | null;
  onLocationUpdate?: (geoid: string, displayName: string) => void;
  shouldDisableTracking?: boolean;
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
  mapZoom,
  geoid = $bindable(),
  displayName = $bindable(),
  onLocationUpdate,
  shouldDisableTracking = $bindable(false),
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

// Track if we're the source of the location change
let isGeolocatorSource = $state(false);

// Add effect to disable tracking when requested
$effect(() => {
  if (shouldDisableTracking && control && control._watchState === "ACTIVE_LOCK") {
    // Trigger the control to go to background state, which removes the dot
    control._updateMarker(); // Update marker position
    control._watchState = "OFF";
    control._geolocateButton.classList.remove("maplibregl-ctrl-geolocate-active");
    control._geolocateButton.classList.remove("maplibregl-ctrl-geolocate-active-error");
    control._geolocateButton.classList.remove("maplibregl-ctrl-geolocate-waiting");
    control._geolocateButton.classList.remove("maplibregl-ctrl-geolocate-background");
    control._geolocateButton.classList.remove("maplibregl-ctrl-geolocate-background-error");

    // Clear the marker
    if (control._userLocationDotMarker) {
      control._userLocationDotMarker.remove();
      control._userLocationDotMarker = null;
    }

    // Clear watch
    if (control._geolocationWatchID !== undefined) {
      navigator.geolocation.clearWatch(control._geolocationWatchID);
      control._geolocationWatchID = undefined;
    }

    isGeolocatorSource = false;
  }
});

async function handleGeolocate(e: GeolocateEvent & GeolocationPosition) {
  // Mark that we're the source of this location change
  isGeolocatorSource = true;

  // Stop any existing map animations first
  if (mapCtx.map) {
    mapCtx.map.stop();
  }

  // Get coordinates from the geolocation event
  const lat = e.coords.latitude;
  const lon = e.coords.longitude;

  // Reverse geocode to get county information
  const countyInfo = await reverseGeocodeCounty(lat, lon);

  if (countyInfo && countyInfo.geoid) {
    // Update the geoid and displayName
    geoid = countyInfo.geoid;
    displayName = countyInfo.displayName;

    // Reset the flag since tracking should continue
    shouldDisableTracking = false;

    // Call the callback if provided
    onLocationUpdate?.(countyInfo.geoid, countyInfo.displayName, true); // true = from geolocator
  }

  // Call the original handler if provided
  ongeolocate?.(e);
}

// Update the effect to use our custom handler
$effect(() => resetEventListener(control, "geolocate", handleGeolocate));

$effect(() => resetEventListener(control, "error", onerror));
$effect(() => resetEventListener(control, "outofmaxbounds", onoutofmaxbounds));

onDestroy(() => {
  if (control) {
    mapCtx.map?.removeControl(control);
  }
});
</script>

{#if mapZoom && mapZoom > 4}
  <style>
  /*
      This global style will only be active when mapZoom > 3.5.
      Svelte handles adding/removing this from the document head automatically.
    */
  :global(div.maplibregl-user-location-dot.maplibregl-marker.maplibregl-marker-anchor-center) {
    display: none !important;
  }
  </style>
{/if}

<style>
:global(.maplibregl-ctrl button.maplibregl-ctrl-geolocate .maplibregl-ctrl-icon) {
  background-size: 20px;
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLW1hcC1waW5uZWQtaWNvbiBsdWNpZGUtbWFwLXBpbm5lZCI+PHBhdGggZD0iTTE4IDhjMCAzLjYxMy0zLjg2OSA3LjQyOS01LjM5MyA4Ljc5NWExIDEgMCAwIDEtMS4yMTQgMEM5Ljg3IDE1LjQyOSA2IDExLjYxMyA2IDhhNiA2IDAgMCAxIDEyIDAiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjgiIHI9IjIiLz48cGF0aCBkPSJNOC43MTQgMTRoLTMuNzFhMSAxIDAgMCAwLS45NDguNjgzbC0yLjAwNCA2QTEgMSAwIDAgMCAzIDIyaDE4YTEgMSAwIDAgMCAuOTQ4LTEuMzE2bC0yLTZhMSAxIDAgMCAwLS45NDktLjY4NGgtMy43MTIiLz48L3N2Zz4=) !important;
  z-index: 100000000;
}
</style>
