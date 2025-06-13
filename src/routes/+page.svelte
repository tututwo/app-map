<!-- @ts-nocheck -->

<script lang="ts">
import { invalidate } from "$app/navigation";
import { page } from "$app/state";

import { onMount } from "svelte";
import { Pointer, CircleHelp, Download, ArrowRight } from "lucide-svelte";

// Custom UI
import CountySearch from "$components/map/countySearch.svelte";
import Sidebar from "$components/sideSection/Sidebar.svelte";
import Tooltip from "$components/chart/Tooltip.svelte";
import Figure from "$components/chart/Figure.svelte";

import PercentageBar from "$components/sideSection/percentageBar.svelte";
import { dataFilters } from "$lib/filters.svelte.js";

// Reusable UI components
import { Button } from "bits-ui";
import * as RadioGroup from "$components/ui/radio-group/index.js";
import { Label } from "$components/ui/label/index.js";

// Visualizations
import LineChart from "$components/lineChartBrush/lineChart.svelte";
import StackedBar from "$components/bar/stackedBar.svelte";

// Map
import MapLibreMap from "$components/map/maplibre-map.svelte";

// State management using Svelte 5 runes
let { data } = $props();

$inspect(data);
let timeRange = $state({ from: 2003, to: 2011 });
let selectedLocation = $state("All locations");
let highlightedGroup = $state<string | null>(null);

// Data ranges for the legend with corrected colors and widths
const dataRanges = [
  { label: "1-12", color: "#E9F6FF", textColor: "black" },
  { label: "13-24", color: "#BCDDF9", textColor: "black" },
  { label: "25-36", color: "#88A5EA", textColor: "black" },
  { label: "37-48", color: "#B389DD", textColor: "white" },
  { label: "49-60", color: "#CA5D99", textColor: "white" },
];

// Event handlers
function handleLocationChange(e: { target: { value: string } }) {
  selectedLocation = e.target.value;
}
let selectedQuantile = $state(0);
function highlightGroup(range: string, i: number) {
  highlightedGroup = range;
  selectedQuantile = i;
}

// Initialize any components on mount
onMount(() => {
  // This would initialize charts, maps, etc.
  console.log("Dashboard mounted");
});

// Brushable line chart

// Data points
const dataLineChart = [
  { date: "2001-01-01T00:00:00.000Z", close: 70, closed_per_100k: 0.2 },
  { date: "2003-01-01T00:00:00.000Z", close: 40, closed_per_100k: 0.1 },
  { date: "2005-01-01T00:00:00.000Z", close: 120, closed_per_100k: 0.3 },
  { date: "2007-01-01T00:00:00.000Z", close: 40, closed_per_100k: 0.1 },
  { date: "2009-01-01T00:00:00.000Z", close: 30, closed_per_100k: 0.05 },
  { date: "2011-01-01T00:00:00.000Z", close: 50, closed_per_100k: 0.1 },
  { date: "2013-01-01T00:00:00.000Z", close: 20, closed_per_100k: 0.05 },
  { date: "2015-01-01T00:00:00.000Z", close: 90, closed_per_100k: 0.2 },
  { date: "2017-01-01T00:00:00.000Z", close: 120, closed_per_100k: 0.3 },
  { date: "2019-01-01T00:00:00.000Z", close: 110, closed_per_100k: 0.25 },
  { date: "2021-01-01T00:00:00.000Z", close: 80, closed_per_100k: 0.2 },
  { date: "2023-01-01T00:00:00.000Z", close: 40, closed_per_100k: 0.1 },
  { date: "2025-01-01T00:00:00.000Z", close: 20, closed_per_100k: 0.05 },
];

const initialBrushSelection = [
  new Date("2003-01-01T00:00:00.000Z"),
  new Date("2011-01-01T00:00:00.000Z"),
];

let currentDataset = $state("original");
// Multiple datasets to demonstrate animations
const datasets: Record<
  string,
  Array<{ year: number; negative: number; neutral: number; positive: number }>
> = {
  original: [
    { year: 2003, negative: -10, neutral: 20, positive: 4 },
    { year: 2004, negative: -18, neutral: 10, positive: 6 },
    { year: 2005, negative: -4, neutral: 100, positive: 4 },
    { year: 2006, negative: -10, neutral: 40, positive: 6 },
    { year: 2007, negative: -8, neutral: 80, positive: 8 },
    { year: 2008, negative: -4, neutral: 50, positive: 10 },
    { year: 2009, negative: -2, neutral: 60, positive: 12 },
    { year: 2010, negative: -12, neutral: 90, positive: 8 },
    { year: 2011, negative: -4, neutral: 20, positive: 14 },
  ],
  updated: [
    { year: 2003, negative: -5, neutral: 15, positive: 8 },
    { year: 2004, negative: -12, neutral: 18, positive: 10 },
    { year: 2005, negative: -8, neutral: 22, positive: 6 },
    { year: 2006, negative: -15, neutral: 25, positive: 4 },
    { year: 2007, negative: -3, neutral: 18, positive: 12 },
    { year: 2008, negative: -6, neutral: 20, positive: 15 },
    { year: 2009, negative: -10, neutral: 22, positive: 8 },
    { year: 2010, negative: -8, neutral: 19, positive: 10 },
    { year: 2011, negative: -2, neutral: 21, positive: 18 },
  ],
  extended: [
    { year: 2003, negative: -10, neutral: 20, positive: 4 },
    { year: 2004, negative: -18, neutral: 20, positive: 6 },
    { year: 2005, negative: -4, neutral: 20, positive: 4 },
    { year: 2006, negative: -10, neutral: 20, positive: 6 },
    { year: 2007, negative: -8, neutral: 20, positive: 8 },
    { year: 2008, negative: -4, neutral: 20, positive: 10 },
    { year: 2009, negative: -2, neutral: 20, positive: 12 },
    { year: 2010, negative: -12, neutral: 20, positive: 8 },
    { year: 2011, negative: -4, neutral: 20, positive: 14 },
    { year: 2012, negative: -6, neutral: 18, positive: 16 },
    { year: 2013, negative: -3, neutral: 22, positive: 12 },
    { year: 2014, negative: -8, neutral: 24, positive: 10 },
  ],
  reduced: [
    { year: 2005, negative: -4, neutral: 20, positive: 4 },
    { year: 2007, negative: -8, neutral: 20, positive: 8 },
    { year: 2009, negative: -2, neutral: 20, positive: 12 },
    { year: 2011, negative: -4, neutral: 20, positive: 14 },
  ],
};
const statistics = $state([
  {
    id: "college-degree",
    title: "Percent with a collage degree or higher", // Keeping 'collage' typo from image
    currentValueDisplay: "17%",
    currentValue: 17,
    minValue: 0,
    maxValue: 100,
    minLabel: "0%",
    maxLabel: "100%",
    averageValue: 35,
    averageLabel: "US Average",
  },
  {
    id: "median-rent",
    title: "Median rent (USD)",
    currentValueDisplay: "$2039",
    currentValue: 2039,
    minValue: 200,
    maxValue: 10000,
    minLabel: "200",
    maxLabel: "10k",
    averageValue: 5500, // Estimated from image
    // No averageLabel for this one based on image, but line is present
  },
  {
    id: "renters-percent",
    title: "Percent of people who are renters",
    currentValueDisplay: "87%",
    currentValue: 87,
    minValue: 0,
    maxValue: 100,
    minLabel: "0%",
    maxLabel: "100%",
    averageValue: 70, // Estimated from image
  },
  {
    id: "poverty-level",
    title: "Percent below the federal poverty level",
    currentValueDisplay: "17%",
    currentValue: 17,
    minValue: 0,
    maxValue: 100,
    minLabel: "0%",
    maxLabel: "100%",
    averageValue: 30, // Estimated from image
  },
  {
    id: "household-income",
    title: "Median household income (USD)",
    currentValueDisplay: "$30.5k",
    currentValue: 30500,
    minValue: 0,
    maxValue: 80000,
    minLabel: "0",
    maxLabel: "80k",
    averageValue: 45000, // Estimated from image
  },
]);
// Get current data based on selection
const stackedBarData = $derived(datasets[currentDataset]);
const lineChartMargin = { top: 30, right: 10, bottom: 20, left: 40 };

let selectedMapMetric = $state(dataFilters.metrics[0].value);
</script>

<div class="flex h-screen">
  <!-- Use the Sidebar component -->
  <Sidebar>
    <!-- <LocationInput
      class="text-gray-800 shadow-sm"
      value={dataFilters.county}
      onSelect={(geoid) => dataFilters.setCounty(geoid)}
    /> -->
    <CountySearch />
  </Sidebar>

  <!-- Main Content -->
  <main class="flex h-screen flex-1 flex-col overflow-hidden pb-2">
    <!-- ------------------------------------------------------------------ -->
    <!-- Line chart section -->
    <!-- ------------------------------------------------------------------ -->
    <section
      aria-label="Line chart"
      class="mb-2 h-[18vh] rounded border border-gray-200 px-5"
      style="background-color: hsla(206, 100%, 96%, 1);"
    >
      <header
        class="flex w-full justify-between"
        style="padding-left: {lineChartMargin.left - 15}px;"
      >
        <h1 class="mb-1 text-2xl font-medium text-gray-900">
          Number of <span class="font-bold">closed churches</span> in
          <span class="font-bold">all locations</span> over time
        </h1>
        <p class="mt-2 text-right text-sm text-gray-500">Data source: research center data port</p>
      </header>
      <div class="w-fullitems-center flex h-[calc(18vh-50px)] justify-center">
        <Figure>
          <LineChart
            data={dataLineChart}
            {initialBrushSelection}
            xTickPosition="top"
            yTickPosition="left"
            showChartBorder={true}
            showXGridlines={true}
            showYGridlines={true}
            gridLineColor="hsla(0, 0%, 85%, 1)"
            yTickCount={4}
            circleRadius={6}
            circleHoverRadius={9}
            lineColor="hsla(0, 0%, 53%, 1)"
            circleColor="hsla(211, 98%, 21%, 1)"
            margin={lineChartMargin}
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
        <!-- ------------------------------------------------------------------ -->
        <!-- Metric Buttons and Quantile Buttons -->
        <!-- ------------------------------------------------------------------ -->
        <div class="px-5">
          <!-- Time range -->
          <h3 class="my-2 text-xl font-medium text-[#00a651]">
            From {timeRange.from} to {timeRange.to}
          </h3>

          <!-- Controls grid with radio buttons and legend -->
          <div class="mb-2 grid grid-cols-2 gap-2">
            <!-- ------------------------------------------------------------------ -->
            <!-- Metric Buttons -->
            <!-- ------------------------------------------------------------------ -->
            <section aria-label="Metrics" class="flex flex-col">
              <RadioGroup.Root
                bind:value={selectedMapMetric}
                name="metric"
                class="flex h-full flex-col justify-between py-2"
              >
                {#each dataFilters.metrics as metric (metric.value)}
                  {@const id = `metric-${metric.value}`}
                  <div class="flex items-center gap-2 transition-colors">
                    <RadioGroup.Item {id} value={metric.value} />

                    <Label
                      for={id}
                      class="flex w-full cursor-pointer items-center gap-2 text-sm"
                      style={metric.value === selectedMapMetric ? "font-weight:800" : ""}
                    >
                      {metric.label}
                      {#if metric.description}
                        <Tooltip description={metric.description} class="-ml-1 h-4 w-4">
                          <span
                            class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-200 text-xs"
                          >
                            <CircleHelp strokeWidth={1.5} />
                          </span>
                        </Tooltip>
                      {/if}
                    </Label>
                  </div>
                {/each}
              </RadioGroup.Root>
            </section>

            <!-- ------------------------------------------------------------------ -->
            <!-- Legend section -->
            <!-- ------------------------------------------------------------------ -->

            <section aria-label="Legend" class="flex flex-col space-y-1">
              <h4 class="mb-1 text-sm font-medium text-gray-800">
                {dataFilters.metrics.find((m) => m.value === selectedMapMetric)?.label}
              </h4>
              <div class="flex gap-1.5">
                {#each dataRanges as range, index}
                  <Button.Root
                    style="background-color: {range.color}; {highlightedGroup === range.label
                      ? 'filter: brightness(0.95);'
                      : ''}"
                    class="relative flex h-9 min-w-[2rem] flex-1 items-center justify-center  text-sm  text-gray-700 shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow {highlightedGroup ===
                    range.label
                      ? 'shadow-md ring-2 ring-gray-800 ring-offset-2'
                      : ''}"
                    onclick={() => highlightGroup(range.label, index)}
                  >
                    <span class="relative z-10" style="color: {range.textColor};"
                      >{range.label}</span
                    >
                  </Button.Root>
                {/each}
              </div>

              <div class="flex items-center justify-center gap-2 pt-1">
                <Pointer class="h-4 w-4 text-gray-500" strokeWidth={2} />
                <span class="text-sm text-gray-600">Select a group to highlight</span>
              </div>
            </section>
          </div>
        </div>
        <!-- ------------------------------------------------------------------ -->
        <!-- Map section -->
        <!-- ------------------------------------------------------------------ -->
        <section
          aria-label="Map"
          class="relative flex flex-1 items-center justify-center rounded border border-gray-200"
        >
          <MapLibreMap data={data.geojson} {selectedMapMetric} />
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
          class="mb-5 min-h-[300px] flex-col items-center justify-center border-gray-200"
        >
          <div class="h-full w-full rounded-lg bg-white p-2">
            <Figure visuallyHiddenCaption={false}>
              <StackedBar
                data={stackedBarData}
                keys={["negative", "neutral", "positive"]}
                margin={{ top: 10, right: 0, bottom: 0, left: 35 }}
                colors={{
                  negative: "hsla(211, 98%, 21%, .9)", // Bright blue
                  neutral: "hsla(0, 0%, 87%, .9)", // Light gray
                  positive: "hsla(162, 100%, 38%, .9)", // Green
                }}
                hoverColors={{
                  negative: "hsla(211, 98%, 21%, 1)",
                  neutral: "hsla(0, 0%, 75%, 1)",
                  positive: "hsla(145, 63%, 32%, 1)",
                }}
                chartBackgroundColor="hsla(0, 0%, 100%, 1)"
                gridLineColor="hsla(0, 0%, 90%, 1)"
                showYGridlines={true}
                showXGridlines={false}
                showChartBorder={false}
                barPadding={0.3}
                yTickCount={3}
                yTickPosition="left"
                animationDuration={350}
                animationDelay={30}
              />

              {#snippet figcaption()}
                <div class="mx-auto ml-[40px] max-w-2xl">
                  <p class="flex flex-wrap items-center gap-1 text-lg text-gray-800">
                    <span class="rounded bg-emerald-500 px-2 py-1 font-medium text-white"
                      >Reopening</span
                    >
                    <span>,</span>
                    <span class="rounded bg-[#E9E9E9] px-2 py-1 font-medium text-gray-800"
                      >existing</span
                    >
                    <span>and</span>
                    <span class="rounded bg-blue-900 px-2 py-1 font-medium text-white">closed</span>
                    <span>churches</span>
                  </p>
                </div>
              {/snippet}
            </Figure>
          </div>
        </section>

        <!-- ------------------------------------------------------------------ -->
        <!-- Metircs section -->
        <!-- ------------------------------------------------------------------ -->
        <div class="relative h-[calc(100%)] p-2">
          <!-- Scrollable container -->
          <div class="absolute inset-0 overflow-y-auto pr-1">
            <!-- Social determinants -->
            <h4 class="text-lg font-semibold">Social Determinants</h4>
            {#each statistics as stat (stat.id)}
              <PercentageBar
                title={stat.title}
                currentValueDisplay={stat.currentValueDisplay}
                currentValue={stat.currentValue}
                minValue={stat.minValue}
                maxValue={stat.maxValue}
                minLabel={stat.minLabel}
                maxLabel={stat.maxLabel}
                averageValue={stat.averageValue}
                averageLabel={stat.averageLabel}
                uniqueIdBase={stat.id}
              />
            {/each}
            <h4 class="mt-4 text-lg font-semibold">Demographics</h4>
            {#each statistics as stat (stat.id)}
              <PercentageBar
                title={stat.title}
                currentValueDisplay={stat.currentValueDisplay}
                currentValue={stat.currentValue}
                minValue={stat.minValue}
                maxValue={stat.maxValue}
                minLabel={stat.minLabel}
                maxLabel={stat.maxLabel}
                averageValue={stat.averageValue}
                averageLabel={stat.averageLabel}
                uniqueIdBase={stat.id}
              />
            {/each}
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
