<script lang="ts">
import { onMount } from "svelte";
import { Pointer, CircleHelp, Download, ArrowRight } from "lucide-svelte";

import MapLibreMap from "$components/map/maplibre-map.svelte";
import LocationInput from "$components/LocationInput.svelte";
import Sidebar from "$components/Sidebar.svelte";
import Tooltip from "$components/Tooltip.svelte";
import { dataFilters } from "$lib/filters.svelte.js";

// State management using Svelte 5 runes
let selectedMetric = $state(dataFilters.metrics[0].label);
let timeRange = $state({ from: 2003, to: 2011 });
let selectedLocation = $state("All locations");
let highlightedGroup = $state<string | null>(null);

// Data ranges for the legend with corrected colors and widths
const dataRanges = [
  { label: "1-12", color: "#cfe2f3", width: "70px" },
  { label: "13-24", color: "#9fc5e8", width: "90px" },
  { label: "25-36", color: "#6fa8dc", width: "90px" },
  { label: "37-48", color: "#b4a7d6", width: "90px" },
  { label: "49-60", color: "#d5a6bd", width: "80px" },
];

// Event handlers
function handleLocationChange(e: { target: { value: string } }) {
  selectedLocation = e.target.value;
}

function highlightGroup(range: string) {
  highlightedGroup = range;
}

// Initialize any components on mount
onMount(() => {
  // This would initialize charts, maps, etc.
  console.log("Dashboard mounted");
});
</script>

<div class="flex h-screen">
  <!-- Use the Sidebar component -->
  <Sidebar>
    <LocationInput
      class="text-gray-800 shadow-sm"
      value={dataFilters.county}
      onSelect={(geoid) => dataFilters.setCounty(geoid)}
    />
  </Sidebar>

  <!-- Main Content -->
  <main class="flex h-screen flex-1 flex-col overflow-hidden p-5">
    <!-- Line chart section - 1/5 of height -->
    <section aria-label="Line chart" class="mb-5 h-[20vh] rounded border border-gray-200">
      <header class="flex items-center justify-between border-b border-gray-200 px-5 py-2.5">
        <h2 class="text-base">
          Number of <span class="font-bold">closed churches</span> in
          <span class="font-bold">all locations</span> over time
        </h2>
        <span class="text-xs text-gray-500">Data source: research center data port</span>
      </header>
      <div class="flex h-[calc(20vh-50px)] items-center justify-center">
        <iframe
          width="100%"
          height="204"
          frameborder="0"
          src="https://observablehq.com/embed/22aee85e25bfbf51?cells=chart"
        ></iframe>
      </div>
    </section>

    <!-- Controls and charts section - takes remaining height -->
    <div class="grid flex-1 grid-cols-[2fr_1fr] gap-5">
      <!-- Left column - controls and map -->
      <div class="flex h-full flex-col">
        <!-- Time range and controls -->
        <div class="mb-5">
          <!-- Time range -->
          <h3 class="mb-4 text-lg font-medium text-[#00a651]">
            From {timeRange.from} to {timeRange.to}
          </h3>

          <!-- Controls grid with radio buttons and legend -->
          <div class="mb-2 grid grid-cols-2 gap-4">
            <!-- Radio buttons for metrics -->
            <section aria-label="Metrics" class="flex flex-col gap-2.5">
              {#each dataFilters.metrics as metric}
                <label class="flex cursor-pointer items-center gap-2 text-sm select-none">
                  <div class="relative flex items-center">
                    <input
                      type="radio"
                      name="metric"
                      value={metric.value}
                      checked={dataFilters.metric === metric.value}
                      onchange={() => dataFilters.setMetric(metric.value)}
                      class="h-4 w-4 appearance-none rounded-full border border-gray-300 checked:border-4 checked:border-black"
                    />
                  </div>
                  {metric.label}
                  {#if metric.description}
                    <Tooltip description={metric.description} class="-ml-1 h-4 w-4">
                      <span
                        class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-200 text-xs"
                      >
                        <CircleHelp fill="var(--color-icy-blue)" strokeWidth={1.5} />
                      </span>
                    </Tooltip>
                  {/if}
                </label>
              {/each}
            </section>

            <!-- Improved Legend section to match reference image -->
            <section aria-label="Legend" class="flex flex-col">
              <div class="mb-1">
                <h4 class="mb-1 text-sm">Number of closed church</h4>
                <div class="flex justify-between">
                  {#each dataRanges as range}
                    <button
                      style="background-color: {range.color}; width: {range.width};"
                      class="flex h-8 w-16 cursor-pointer items-center justify-center text-sm"
                      onclick={() => highlightGroup(range.label)}
                      class:ring-2={highlightedGroup === range.label}
                      class:ring-black={highlightedGroup === range.label}
                    >
                      {range.label}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="mt-1 flex items-center justify-center text-xs">
                <span class="mr-1 inline-flex items-center justify-center">
                  <Pointer />
                </span>
                Select a group to highlight
              </div>
            </section>
          </div>
        </div>

        <!-- Map section - takes all remaining height -->
        <section
          aria-label="Map"
          class="flex flex-1 items-center justify-center rounded border border-gray-200"
        >
          <MapLibreMap />
        </section>
      </div>

      <!-- Right column - stacked bar and small line charts -->
      <div class="flex h-full flex-col">
        <!-- Stacked bar chart -->
        <section
          aria-label="Stacked bar chart"
          class="mb-5 flex min-h-[185px] items-center justify-center rounded border border-gray-200"
        >
          <h1 class="text-4xl text-black opacity-80">stacked bar</h1>
        </section>

        <!-- Small line charts - fixed height container with scrolling -->
        <div class="relative h-[calc(100%-185px-1.25rem)]">
          <!-- Scrollable container -->
          <div class="absolute inset-0 overflow-y-auto pr-1">
            <!-- Multiple small line charts to demonstrate scrolling -->
            <section
              aria-label="Small line chart 1"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <iframe
                width="100%"
                height="100%"
                frameborder="0"
                title="Small line chart 1"
                src="https://observablehq.com/embed/3b899a04e91b1f7a@364?cells=chart"
              ></iframe>
            </section>

            <section
              aria-label="Small line chart 2"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <iframe
                width="100%"
                height="100%"
                frameborder="0"
                title="Small line chart 1"
                src="https://observablehq.com/embed/3b899a04e91b1f7a@364?cells=chart"
              ></iframe>
            </section>

            <section
              aria-label="Small line chart 3"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <iframe
                width="100%"
                height="100%"
                frameborder="0"
                title="Small line chart 1"
                src="https://observablehq.com/embed/3b899a04e91b1f7a@364?cells=chart"
              ></iframe>
            </section>

            <section
              aria-label="Small line chart 4"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <iframe
                width="100%"
                height="100%"
                frameborder="0"
                title="Small line chart 1"
                src="https://observablehq.com/embed/3b899a04e91b1f7a@364?cells=chart"
              ></iframe>
            </section>

            <section
              aria-label="Small line chart 5"
              class="flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <iframe
                width="100%"
                height="100%"
                frameborder="0"
                title="Small line chart 1"
                src="https://observablehq.com/embed/3b899a04e91b1f7a@364?cells=chart"
              ></iframe>
            </section>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
