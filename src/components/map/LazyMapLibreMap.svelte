<script lang="ts">
import type { MapDatum } from "$lib/dashboard/data";
import { initialMapCaptureState, type MapCaptureState } from "$lib/map/capture";
import { onMount } from "svelte";

type MapComponent = typeof import("./maplibre-map.svelte").default;

type Props = {
  selectedMapColorKey?: string;
  selectedMapColorDomain?: readonly number[];
  selectedMapColorRange?: readonly string[];
  data?: MapDatum[];
  geoid?: string;
  displayName?: string | null;
  shouldDisableGeolocatorTracking?: boolean;
  captureState?: MapCaptureState;
  hideControls?: boolean;
  selectedQuantile?: number;
  quantileHighlightEnabled?: boolean;
};

let {
  selectedMapColorKey,
  selectedMapColorDomain,
  selectedMapColorRange,
  data,
  geoid = $bindable("00000"),
  displayName = $bindable<string | null>(null),
  shouldDisableGeolocatorTracking = $bindable(false),
  captureState = $bindable<MapCaptureState>(initialMapCaptureState()),
  hideControls,
  selectedQuantile,
  quantileHighlightEnabled,
}: Props = $props();

let MapComponent = $state<MapComponent>();

onMount(() => {
  let active = true;
  const revision = captureState.revision + 1;
  captureState = { state: "loading", revision };

  void import("./maplibre-map.svelte")
    .then(({ default: component }) => {
      if (active) MapComponent = component;
    })
    .catch((error) => {
      if (!active) return;

      captureState = {
        state: "error",
        revision,
        message: error instanceof Error ? error.message : "The map module could not be loaded",
      };
    });

  return () => {
    active = false;
    captureState = initialMapCaptureState();
  };
});
</script>

{#if MapComponent}
  <MapComponent
    {selectedMapColorKey}
    {selectedMapColorDomain}
    {selectedMapColorRange}
    {data}
    bind:geoid
    bind:displayName
    bind:shouldDisableGeolocatorTracking
    bind:captureState
    {hideControls}
    {selectedQuantile}
    {quantileHighlightEnabled}
  />
{:else if captureState.state === "error"}
  <div
    class="flex h-full min-h-[200px] w-full items-center justify-center bg-red-50 p-4 text-center text-sm text-red-800"
    role="alert"
  >
    Map unavailable: {captureState.message}
  </div>
{:else}
  <div class="h-full min-h-[200px] w-full bg-gray-50" aria-hidden="true"></div>
{/if}
