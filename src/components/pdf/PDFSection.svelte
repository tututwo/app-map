<script lang="ts">
import type { BarSegment } from "$lib/types";
import SegmentedBar from "$components/pdf/segmentedBar.svelte";

let {
  title,
  mapPlaceholderText,
  mapBorderColor = "border-gray-300",
  barData,
  description,
} = $props<{
  title: string;
  mapPlaceholderText: string;
  mapBorderColor?: string;
  barData: BarSegment[];
  description: string;
}>();
</script>

<section class="rounded-lg border border-gray-300 p-6">
  <h2 class="mb-4 text-lg font-semibold text-gray-700">{title}</h2>
  <div class="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
    <div class="border {mapBorderColor} flex h-48 items-center justify-center rounded bg-gray-50">
      <span class="text-4xl font-bold text-gray-400 italic">{mapPlaceholderText}</span>
    </div>
    <div>
      <SegmentedBar data={barData} />
      <p class="mt-12 text-sm text-gray-600">
        {description}
      </p>
    </div>
  </div>
</section>
