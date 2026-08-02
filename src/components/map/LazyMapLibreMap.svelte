<script lang="ts">
import type { MapDatum } from "$lib/dashboard/data";

type MapComponent = typeof import("./maplibre-map.svelte").default;

type Props = {
  selectedMapColorKey?: string;
  selectedMapColorDomain?: number[];
  selectedMapColorRange?: string[];
  data?: MapDatum[];
  geoid?: string;
  displayName?: string | null;
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
  hideControls,
  selectedQuantile,
  quantileHighlightEnabled,
}: Props = $props();

let MapComponent = $state<MapComponent>();

if (!import.meta.env.SSR) {
  void import("./maplibre-map.svelte").then(({ default: component }) => {
    MapComponent = component;
  });
}
</script>

{#if MapComponent}
  <MapComponent
    {selectedMapColorKey}
    {selectedMapColorDomain}
    {selectedMapColorRange}
    {data}
    bind:geoid
    bind:displayName
    {hideControls}
    {selectedQuantile}
    {quantileHighlightEnabled}
  />
{:else}
  <div class="h-full min-h-[200px] w-full bg-gray-50" aria-hidden="true"></div>
{/if}
