<script lang="ts">
import { getAccessibleTextColor } from "$lib/utils/accessibleTextColor";
import type { BarSegment } from "$lib/types";
import { cn } from "$lib/utils";
let { data } = $props<{ data: BarSegment[] }>();

// Default text color if not specified, ensuring it's dark for good contrast on unknown light bgs
const defaultTextColor = "text-black";
</script>

<div class="relative z-0 w-full pt-10 pb-8">
  <div class="flex h-6 w-full rounded shadow">
    {#each data as segment}
      <div
        class={cn("relative flex flex-1 items-center justify-center", segment.color)}
        style={`background-color: ${segment.color};`}
      >
        <span
          class={cn("text-sm font-medium", segment.textColor, defaultTextColor)}
          style={`color: ${segment.textColor};`}
        >
          {segment.range}
        </span>

        {#if segment.popupValue !== undefined && segment.popupValue !== null}
          <div class="absolute bottom-full left-1/2 z-10 mb-2.5 -translate-x-1/2">
            <div
              style="background-color: {segment.color}; color: {getAccessibleTextColor(
                segment.color
              )}"
              class="rounded-xs px-3 py-1 text-lg font-bold whitespace-nowrap text-white shadow-lg"
            >
              {segment.popupValue}
            </div>

            <div
              style="border-top-color: {segment.color};"
              class="absolute left-1/2 h-0 w-0 -translate-x-1/2 border-t-8 border-r-8 border-l-8 border-r-transparent border-l-transparent"
            ></div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
