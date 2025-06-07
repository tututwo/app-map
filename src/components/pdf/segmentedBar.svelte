<script lang="ts">
import type { BarSegment } from "$lib/types";

let { data } = $props<{ data: BarSegment[] }>();

// Default text color if not specified, ensuring it's dark for good contrast on unknown light bgs
const defaultTextColor = "text-black";
</script>

<div class="relative z-0 w-full pt-10 pb-8">
  <div class="flex h-10 w-full rounded shadow">
    {#each data as segment, i}
      <div class="flex-1 {segment.color} relative flex items-center justify-center">
        <span class="text-sm font-medium {segment.textColor || defaultTextColor}">
          {segment.range}
        </span>

        {#if segment.popupValue}
          <div class="absolute bottom-full left-1/2 z-10 mb-2.5 -translate-x-1/2">
            <div
              class="rounded-md bg-blue-800 px-3 py-1.5 text-lg font-bold whitespace-nowrap text-white shadow-lg"
            >
              {segment.popupValue}
            </div>

            <div
              class="absolute left-1/2 h-0 w-0 -translate-x-1/2 border-t-8 border-r-8 border-l-8 border-t-blue-800 border-r-transparent border-l-transparent"
            ></div>
          </div>
        {/if}

        {#if segment.markerText}
          <div class="absolute top-full left-1/2 mt-2.5 -translate-x-1/2 text-center">
            <div
              class="absolute bottom-full left-1/2 mb-[-1px] h-0 w-0 -translate-x-1/2 border-r-8 border-b-8 border-l-8 border-r-transparent border-b-black border-l-transparent"
            ></div>
            <span class="text-sm font-semibold whitespace-nowrap text-gray-800">
              {segment.markerText}
            </span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
