<script lang="ts">
import type { BarSegment } from "$lib/types";
import SegmentedBar from "./segmentedBar.svelte";
import MapLibreMap from "$components/map/maplibre-map.svelte";
let {
  title,
  mapPlaceholderText,
  mapBorderColor = "border-gray-300",
  legendData,
  description,
  foo, // Added callback prop for event handling
} = $props<{
  title: string;
  mapPlaceholderText: string;
  mapBorderColor?: string;
  legendData: BarSegment[];
  description: string;
  foo?: () => void; // Added type for callback prop
}>();
</script>

<section class="rounded-lg border border-gray-300 p-6">
  <h2 class="mb-4 text-lg font-semibold text-gray-700">{title}</h2>
  <div class="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
    <div class="border {mapBorderColor} flex h-48 items-center justify-center rounded bg-gray-50">
      <!-- <span class="text-4xl font-bold text-gray-400 italic">{mapPlaceholderText}</span> -->
      <MapLibreMap />
    </div>
    <div>
      <SegmentedBar data={legendData} />
      <p class="mt-12 text-sm text-gray-600">
        {description}
      </p>
    </div>
  </div>
</section>
