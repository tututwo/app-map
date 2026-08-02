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
  captureState = initialMapCaptureState();

  void import("./maplibre-map.svelte").then(({ default: component }) => {
    if (active) MapComponent = component;
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
{:else}
  <div class="h-full min-h-[200px] w-full bg-gray-50" aria-hidden="true"></div>
{/if}
