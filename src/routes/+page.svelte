<!-- @ts-nocheck -->

<script lang="ts">
import { invalidate } from "$app/navigation";
import { page } from "$app/state";
import MetricData from "$data/sideMetricData.csv";
import { onMount } from "svelte";
import { Pointer, CircleHelp } from "lucide-svelte";

// Loading components
import LoadingOverlay from "$components/loadingPage/LoadingOverlay.svelte";
import LoadingProgress from "$components/loadingPage/LoadingProgress.svelte";
import LoadingError from "$components/loadingPage/LoadingError.svelte";

// Custom UI
import CountySearch from "$components/map/countySearch.svelte";
import Sidebar from "$components/sideSection/Sidebar.svelte";
import ChartTooltip from "$components/chart/Tooltip.svelte";
import Tooltip from "$components/Tooltip.svelte";
import Figure from "$components/chart/Figure.svelte";

import PercentageBar from "$components/sideSection/percentageBar.svelte";
import { dataFilters } from "$lib/filters.svelte.js";

// Reusable UI components
import { Button } from "bits-ui";
import * as RadioGroup from "$components/ui/radio-group/index.js";
import { Label } from "$components/ui/label/index.js";

// Visualizations
import LineChartBrush from "$components/lineChartBrush/LineChartBrush.svelte";
import StackedBar from "$components/bar/stackedBar.svelte";

// Map
import MapLibreMap from "$components/map/maplibre-map.svelte";

import { createSideMetricData } from "$lib/utils/sideMetricTransformation";
import { getAccessibleTextColor } from "$lib/utils/accessibleTextColor";

let yearRange = $state<[number, number]>([2003, 2011]);
let selectedLocation = $state("All locations");
let highlightedGroup = $state<string | null>(null);

let mapData = $state<any[]>([]);
let lineChartData = $state<{ year: number; close: number }[]>([]);
let stackedBarData = $state<
  { year: number; negative: number; neutral: number; positive: number }[]
>([]);

// Add displayName state after geoid
let geoid = $state("00000");
let displayName = $state<string | null>("All locations"); // Track display name

// Track if we should disable geolocator
let shouldDisableGeolocatorTracking = $state(false);

// Loading states
let isMapDataLoading = $state(true);
let isLineChartDataLoading = $state(true);
let isStackedBarDataLoading = $state(true);
let hasLoadingError = $state(false);
let hasLoadingTimeout = $state(false);

// Track initial load
let isInitialLoad = $state(true);
let loadingTimeoutId: number | null = null;

// Loading items for progress component
let loadingItems = $derived([
  { name: "Map Data", isLoading: isMapDataLoading },
  { name: "Church Closure Trends", isLoading: isLineChartDataLoading },
  { name: "Church Status Distribution", isLoading: isStackedBarDataLoading },
]);

// Check if all data is loaded
let isAllDataLoaded = $derived(
  !isMapDataLoading && !isLineChartDataLoading && !isStackedBarDataLoading
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMapData(from: number, to: number) {
  // wait for the brush transition animation to finish
  // otherwise it lags
  await sleep(300);
  isMapDataLoading = true;
  try {
    const response = await fetch(`/api/map_data?from=${from}&to=${to}`);
    if (!response.ok) throw new Error("Failed to fetch map data");
    mapData = await response.json();
    isMapDataLoading = false;
  } catch (error) {
    console.error("Error fetching map data:", error);
    isMapDataLoading = false;
    hasLoadingError = true;
  }
}

$effect(() => {
  fetchMapData(yearRange[0], yearRange[1]);
});

async function fetchLineChartData(geoidParam?: string) {
  isLineChartDataLoading = true;
  try {
    const url = `/api/line_chart_data?geoid=${geoidParam}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch line chart data");
    lineChartData = await response.json();
    isLineChartDataLoading = false;
  } catch (error) {
    console.error("Error fetching line chart data:", error);
    isLineChartDataLoading = false;
    hasLoadingError = true;
    // Keep existing data on error
  }
}

$effect(() => {
  // Fetch line chart data when geoid changes
  // If geoid is "00000" (default), fetch aggregated data for all locations
  const geoidToFetch = geoid === "00000" ? "" : geoid;
  fetchLineChartData(geoidToFetch);
});

async function fetchStackedBarData(geoidParam?: string) {
  isStackedBarDataLoading = true;
  try {
    const url = `/api/stacked_bar_chart_data?geoid=${geoidParam}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch stacked bar data");
    stackedBarData = await response.json();
    isStackedBarDataLoading = false;
  } catch (error) {
    console.error("Error fetching stacked bar data:", error);
    isStackedBarDataLoading = false;
    hasLoadingError = true;
    // Keep existing data on error
  }
}

$effect(() => {
  // Fetch stacked bar data when geoid changes
  // If geoid is "00000" (default), fetch aggregated data for all locations
  const geoidToFetch = geoid === "00000" ? "" : geoid;
  fetchStackedBarData(geoidToFetch);
});

// Event handlers
function handleLocationChange(e: { target: { value: string } }) {
  selectedLocation = e.target.value;
}
let selectedQuantile = $state(0);
function highlightGroup(range: string, i: number) {
  // Toggle off if clicking the same button
  if (highlightedGroup === range) {
    highlightedGroup = null;
    selectedQuantile = -1;
  } else {
    highlightedGroup = range;
    selectedQuantile = i;
  }
}

const lineChartMargin = { top: 25, right: 10, bottom: 20, left: 40 };
const stackedBarMargin = { top: 10, right: 0, bottom: 10, left: 35 };
let selectedMapMetric = $state(dataFilters.metrics[0].value);
let selectedMapMetricString = $derived(String(selectedMapMetric));
let selectedMapColorKey = $derived(dataFilters.metrics[selectedMapMetric].colorKey);
let selectedMapColorDomain = $derived(dataFilters.metrics[selectedMapMetric].colorDomain);
let selectedMapColorRange = $derived(dataFilters.metrics[selectedMapMetric].colorRange);
// Data ranges for the legend with corrected colors and widths
// Usage in your Svelte component:
let dataRanges = $derived.by(() => {
  const selectedMetric = dataFilters.metrics[selectedMapMetric];

  return selectedMetric.legendText.map((label, index) => ({
    label,
    color: selectedMetric.colorRange[index],
    // Use AAA compliant text color determination
    textColor: getAccessibleTextColor(selectedMetric.colorRange[index], "normal"),
  }));
});

// ----------------------------------------------------------------
// ----------------------Metric Section----------------------
// ----------------------------------------------------------------
let selectedSideMetricData = $derived(MetricData.filter((d) => d.geoid === geoid));
// Usage example:
const fieldConfigs = [
  {
    id: "median-rent",
    field: "n_med_rent",
    title: "Median rent (USD)",
    type: "currency",
    range: [200, 10000],
    labels: ["200", "10k"],
    average: 1200,
  },
  {
    id: "renters-percent",
    field: "p_renter",
    title: "Percent of people who are renters",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 36,
  },
  {
    id: "poverty-level",
    field: "p_poverty",
    title: "Percent below the federal poverty level",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 12,
    averageLabel: "US Average",
  },
];

let statistics = $derived(createSideMetricData(selectedSideMetricData[0], fieldConfigs));

// Add an effect to sync displayName with default geoid
$effect(() => {
  if (geoid === "00000" && !displayName) {
    displayName = "All locations";
  }
});

function resetToAllLocations() {
  geoid = "00000";
  displayName = "All locations";
}

function handleLocationSourceChange(fromGeolocator: boolean) {
  if (!fromGeolocator) {
    shouldDisableGeolocatorTracking = true;
  }
}

// Set up loading timeout
onMount(() => {
  // Set a timeout for initial load (10 seconds)
  loadingTimeoutId = window.setTimeout(() => {
    if (!isAllDataLoaded && isInitialLoad) {
      hasLoadingTimeout = true;
    }
  }, 10000);

  // Clean up on unmount
  return () => {
    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
    }
  };
});

// Watch for when all data is loaded
$effect(() => {
  if (isAllDataLoaded && isInitialLoad) {
    isInitialLoad = false;
    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
    }
  }
});

// Retry function for error handling
function retryDataFetch() {
  hasLoadingError = false;
  hasLoadingTimeout = false;

  // Re-fetch all data
  fetchMapData(yearRange[0], yearRange[1]);
  const geoidToFetch = geoid === "00000" ? "" : geoid;
  fetchLineChartData(geoidToFetch);
  fetchStackedBarData(geoidToFetch);
}
</script>

<div class="flex h-screen">
  <!-- Use the Sidebar component -->
  <Sidebar from={yearRange[0]} to={yearRange[1]} {geoid}>
    <CountySearch bind:geoid bind:displayName onLocationSourceChange={handleLocationSourceChange} />
  </Sidebar>

  <!-- Main Content -->
  <main class="flex h-screen flex-1 flex-col overflow-hidden pb-2">
    <!-- ------------------------------------------------------------------ -->
    <!-- Line chart section -->
    <!-- ------------------------------------------------------------------ -->
    <section
      aria-label="Line chart"
      class="mb-2 h-[24vh] rounded px-5 pt-6"
      style="background-color: #EBF6FF;"
    >
      <header class="flex w-full justify-between" style="padding-left: {lineChartMargin.left}px;">
        <h1 class="mb-1 text-2xl font-medium text-gray-900">
          Number of <span class="font-bold">closed churches</span> in
          <span class="font-bold">{displayName || "all locations"}</span> over time
        </h1>
        <p class="mt-2 text-right text-sm text-gray-500">Data source: research center data port</p>
      </header>
      <div class="w-fullitems-center flex h-[calc(20vh-50px)] justify-center">
        <Figure exclude="">
          <LineChartBrush
            key="close"
            margin={lineChartMargin}
            bind:yearRange
            data={lineChartData}
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
            From {yearRange[0]} to {yearRange[1]}
          </h3>

          <!-- Controls grid with radio buttons and legend -->
          <div class="mb-2 grid grid-cols-2 gap-2">
            <!-- ------------------------------------------------------------------ -->
            <!-- Metric Buttons -->
            <!-- ------------------------------------------------------------------ -->
            <section aria-label="Metrics" class="flex flex-col">
              <RadioGroup.Root
                value={selectedMapMetricString}
                onValueChange={(v) => {
                  selectedMapMetric = Number(v) as 0 | 1 | 2;
                }}
                name="metric"
                class="flex h-full flex-col justify-between py-2"
              >
                {#each dataFilters.metrics as metric (metric.value)}
                  {@const id = `metric-${metric.value}`}
                  <div class="flex items-center gap-2 transition-colors">
                    <RadioGroup.Item {id} value={String(metric.value)} />

                    <Label
                      for={id}
                      class="flex w-full cursor-pointer items-center gap-2 text-sm"
                      style={metric.value === selectedMapMetric ? "font-weight:800" : ""}
                    >
                      {metric.label}
                      {#if metric.description}
                        <Tooltip description={metric.description} class="-ml-1 h-4 w-4">
                          <span
                            class="bg-yale-blue inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-xs"
                          >
                            <CircleHelp strokeWidth={1.5} color="white" />
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
              <h4 class="mb-1 text-sm font-medium text-gray-500">
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
                <span class="text-sm text-gray-600">
                  {highlightedGroup ? "Click again to deselect" : "Select a category to highlight"}
                </span>
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
          <MapLibreMap
            {selectedMapColorKey}
            {selectedMapColorDomain}
            {selectedMapColorRange}
            data={mapData}
            bind:geoid
            bind:displayName
            {selectedQuantile}
            quantileHighlightEnabled={highlightedGroup !== null}
          />
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
                {yearRange}
                margin={stackedBarMargin}
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
              />

              {#snippet figcaption()}
                <div class="mx-auto ml-[40px] flex max-w-2xl items-center justify-between">
                  <p class="flex flex-wrap items-center gap-1 text-lg text-gray-800">
                    <span class=" bg-emerald-500 px-2 py-1 font-medium text-white">Reopening</span>
                    <span>,</span>
                    <span class=" bg-[#E9E9E9] px-2 py-1 font-medium text-gray-800">existing</span>
                    <span>and</span>
                    <span class=" bg-blue-900 px-2 py-1 font-medium text-white">closed</span>
                    <span>churches</span>
                  </p>
                  <Tooltip description={"reopening is....; exisiting is....;"} class="mr-6 size-4">
                    <span
                      class="bg-yale-blue inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-xs"
                    >
                      <CircleHelp strokeWidth={1.5} color="white" />
                    </span>
                  </Tooltip>
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
            <h4 class="mt-8 text-lg font-semibold">Demographics</h4>
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

<!-- Loading States -->
{#if isInitialLoad && !isAllDataLoaded}
  <LoadingProgress items={loadingItems} show={true} />
{/if}

<!-- Loading Error -->
<LoadingError
  show={hasLoadingError || hasLoadingTimeout}
  hasTimeout={hasLoadingTimeout}
  onRetry={retryDataFetch}
/>
