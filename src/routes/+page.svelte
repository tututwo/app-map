<!-- @ts-nocheck -->
<script lang="ts">
import { onMount } from "svelte";
import { Pointer, CircleHelp, Download, ArrowRight } from "lucide-svelte";

// UI
import LocationInput from "$components/LocationInput.svelte";
import Sidebar from "$components/Sidebar.svelte";
import Tooltip from "$components/Tooltip.svelte";
import { dataFilters } from "$lib/filters.svelte.js";

import Figure from "$components/Figure.svelte";

// Line Chart

import LineChart from "$components/lineChartBrush/lineChart.svelte";

// Map
import MapLibreMap from "$components/map/maplibre-map.svelte";

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

// Brushable line chart

// Data points
const data = [
  { date: "2001-01-01T00:00:00.000Z", close: 70 },
  { date: "2003-01-01T00:00:00.000Z", close: 40 },
  { date: "2005-01-01T00:00:00.000Z", close: 120 },
  { date: "2007-01-01T00:00:00.000Z", close: 40 },
  { date: "2009-01-01T00:00:00.000Z", close: 30 },
  { date: "2011-01-01T00:00:00.000Z", close: 50 },
  { date: "2013-01-01T00:00:00.000Z", close: 20 },
  { date: "2015-01-01T00:00:00.000Z", close: 90 },
  { date: "2017-01-01T00:00:00.000Z", close: 120 },
  { date: "2019-01-01T00:00:00.000Z", close: 110 },
  { date: "2021-01-01T00:00:00.000Z", close: 80 },
  { date: "2023-01-01T00:00:00.000Z", close: 40 },
  { date: "2025-01-01T00:00:00.000Z", close: 20 },
];

const initialBrushSelection = [
  new Date("2003-01-01T00:00:00.000Z"),
  new Date("2011-01-01T00:00:00.000Z"),
];
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
    <!-- ------------------------------------------------------------------ -->
    <!-- Line chart section -->
    <!-- ------------------------------------------------------------------ -->
    <section aria-label="Line chart" class="mb-5 h-[20vh] rounded border border-gray-200">
      <header class="mb-8">
        <h1 class="mb-1 text-2xl font-medium text-gray-900">
          Number of <span class="font-bold">closed churches</span> in
          <span class="font-bold">all locations</span> over time
        </h1>
        <p class="text-right text-sm text-gray-500">Data source: research center data port</p>
      </header>
      <div class="w-fullitems-center flex h-[calc(20vh-50px)] justify-center">
        <Figure>
          <LineChart
            {data}
            {initialBrushSelection}
            xTickPosition="top"
            yTickPosition="left"
            showChartBorder={true}
            showXGridlines={true}
            showYGridlines={true}
            gridLineColor="hsla(0, 0%, 85%, 1)"
            yTickCount={2}
            circleRadius={8}
            circleHoverRadius={6}
            lineColor="hsla(0, 0%, 53%, 1)"
            circleColor="hsla(211, 98%, 21%, 1)"
            margin={{ top: 60, right: 40, bottom: 60, left: 60 }}
          />

          {#snippet figcaption()}
            This is a caption for the line chart showing church closures over time.
          {/snippet}
        </Figure>
      </div>
    </section>

    <!-- Controls and charts section - takes remaining height -->
    <div class="grid flex-1 grid-cols-[2fr_1fr] gap-5">
      <!-- ------------------------------------------------------------------ -->
      <!-- ------------------------------------------------------------------ -->
      <!-- Map, controls, and legend section -->
      <!-- ------------------------------------------------------------------ -->
      <!-- ------------------------------------------------------------------ -->
      <div class="flex h-full flex-col">
        <!-- Time range and controls -->
        <div class="mb-5">
          <!-- Time range -->
          <h3 class="mb-4 text-lg font-medium text-[#00a651]">
            From {timeRange.from} to {timeRange.to}
          </h3>

          <!-- Controls grid with radio buttons and legend -->
          <div class="mb-2 grid grid-cols-2 gap-4">
            <!-- ------------------------------------------------------------------ -->
            <!-- Metric Buttons -->
            <!-- ------------------------------------------------------------------ -->
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

            <!-- ------------------------------------------------------------------ -->
            <!-- Legend section -->
            <!-- ------------------------------------------------------------------ -->
            <section aria-label="Legend" class="flex flex-col">
              <div class="mb-1">
                <h4 class="mb-1 text-sm">Number of closed church</h4>
                <div class="flex justify-between">
                  {#each dataRanges as range}
                    <button
                      style="background-color: {range.color};"
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
        <!-- ------------------------------------------------------------------ -->
        <!-- Map section -->
        <!-- ------------------------------------------------------------------ -->
        <section
          aria-label="Map"
          class="flex flex-1 items-center justify-center rounded border border-gray-200"
        >
          <MapLibreMap />
        </section>
      </div>

      <!-- ------------------------------------------------------------------ -->
      <!-- ------------------------------------------------------------------ -->
      <!-- Stacked bar and small line charts -->
      <!-- ------------------------------------------------------------------ -->
      <!-- ------------------------------------------------------------------ -->
      <div class="flex h-full flex-col">
        <!-- ------------------------------------------------------------------ -->
        <!-- Stacked bar chart section -->
        <!-- ------------------------------------------------------------------ -->
        <section
          aria-label="Stacked bar chart"
          class="mb-5 flex min-h-[185px] items-center justify-center rounded border border-gray-200"
        >
          <h1 class="text-4xl text-black opacity-80">stacked bar</h1>
        </section>

        <!-- ------------------------------------------------------------------ -->
        <!-- Small line charts section -->
        <!-- ------------------------------------------------------------------ -->
        <div class="relative h-[calc(100%-185px-1.25rem)]">
          <!-- Scrollable container -->
          <div class="absolute inset-0 overflow-y-auto pr-1">
            <!-- Multiple small line charts to demonstrate scrolling -->
            {#each [1, 2, 3, 4, 5] as chartIndex}
              <section
                aria-label={`Small line chart ${chartIndex}`}
                class="flex h-[200px] items-center justify-center rounded border border-gray-200"
              >
                <Figure>
                  <LineChart
                    {data}
                    chartBackgroundColor="white"
                    enableBrushing={false}
                    xTickPosition="bottom"
                    yTickPosition="left"
                    showChartBorder={true}
                    showXGridlines={true}
                    showYGridlines={true}
                    gridLineColor="hsla(0, 0%, 80%, 1)"
                    yTickCount={3}
                    circleRadius={5}
                    circleHoverRadius={8}
                    lineColor="hsla(0, 0%, 20%, 1)"
                    circleColor="hsla(0, 0%, 20%, 1)"
                    circleHoverColor="hsla(0, 0%, 10%, 1)"
                    margin={{ top: 40, right: 40, bottom: 50, left: 50 }}
                  />

                  {#snippet figcaption()}{/snippet}
                </Figure>
              </section>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
