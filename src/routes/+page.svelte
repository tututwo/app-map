<!-- @ts-nocheck -->

<script lang="ts">
import { invalidate } from "$app/navigation";
import { Pointer, CircleHelp } from "lucide-svelte";

import LoadingError from "$components/loadingPage/LoadingError.svelte";

// Custom UI
import CountySearch from "$components/map/countySearch.svelte";
import Sidebar from "$components/sideSection/Sidebar.svelte";
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
import LazyMapLibreMap from "$components/map/LazyMapLibreMap.svelte";

import { createSideMetricData } from "$lib/utils/sideMetricTransformation";
import { getAccessibleTextColor } from "$lib/utils/accessibleTextColor";
import { createLastGood } from "$lib/dashboard/last-good.svelte";
import { setDashboardParams } from "$lib/dashboard/navigate-app";
import type { LineDatum, MapDatum, SideMetricDatum, StackedDatum } from "$lib/dashboard/data";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

const mapState = createLastGood<MapDatum[]>();
const lineState = createLastGood<LineDatum[]>();
const stackedState = createLastGood<StackedDatum[]>();
const sideState = createLastGood<SideMetricDatum>();

function syncDashboardResults() {
  if (data.results.map) mapState.update(data.results.map);
  if (data.results.line) lineState.update(data.results.line);
  if (data.results.stacked) stackedState.update(data.results.stacked);
  if (data.results.side) sideState.update(data.results.side);
}

syncDashboardResults();
$effect(syncDashboardResults);

let yearRange = $derived<[number, number]>([data.params.from, data.params.to]);
let geoid = $derived(data.params.geoid);
let mapData = $derived(mapState.value ?? []);
let lineChartData = $derived(lineState.value ?? []);
let stackedBarData = $derived(stackedState.value ?? []);

let highlightedGroup = $state<string | null>(null);
let pendingGeoid = $state<string | null>(null);
let geoidNavigationGeneration = 0;
let displayNameOverride = $state<{ geoid: string; name: string | null } | null>(null);

let displayNameGeoid = $derived(pendingGeoid ?? geoid);
let displayName = $derived(
  displayNameOverride?.geoid === displayNameGeoid
    ? displayNameOverride.name
    : displayNameGeoid === "00000"
      ? "All locations"
      : (mapData.find((county) => county.geoid === displayNameGeoid)?.name ?? displayNameGeoid)
);

function updateYearRange(nextRange: [number, number]) {
  void setDashboardParams({ from: nextRange[0], to: nextRange[1] });
}

function updateGeoid(nextGeoid: string) {
  const generation = ++geoidNavigationGeneration;
  pendingGeoid = nextGeoid;

  void setDashboardParams({ geoid: nextGeoid }).finally(() => {
    if (generation === geoidNavigationGeneration) pendingGeoid = null;
  });
}

function updateDisplayName(nextDisplayName: string | null) {
  displayNameOverride = { geoid: pendingGeoid ?? geoid, name: nextDisplayName };
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
let selectedSideMetricData = $derived(sideState.value);
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
    averageLabel: "US Average",
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
    title: "Percentage of population living in poverty",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 12,
  },
  {
    id: "mobility-level",
    field: "p_mobility",
    title: "Percentage of population with mobility limitations",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 12,
  },
  {
    id: "community-health-centers",
    field: "n_commhlthcntr",
    title: "Number of community health centers",
    type: "currency",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 12,
  },
];

let statistics = $derived(
  selectedSideMetricData ? createSideMetricData(selectedSideMetricData, fieldConfigs) : []
);
// Demographic stats
const demographicFieldConfigs = [
  {
    id: "black-population",
    field: "n_pop_black",
    title: "Number of individuals identifying as Black",
    type: "number",
    range: [200, 60000],
    labels: ["200", "10k"],
    average: 15000,
    averageLabel: "US Average",
  },
  {
    id: "hispanic-population",
    field: "n_pop_hisp",
    title: "Number of individuals identifying as Hispanic",
    type: "number",
    range: [0, 10000],
    labels: ["0", "10k"],
    average: 1200,
  },
  {
    id: "renter-population-percent",
    field: "p_renter",
    title: "Percentage of population renting",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 36,
  },
];

let demographicStatistics = $derived(
  selectedSideMetricData
    ? createSideMetricData(selectedSideMetricData, demographicFieldConfigs)
    : []
);

let errors = $derived(
  [mapState.error, lineState.error, stackedState.error, sideState.error].filter(Boolean)
);
let errorSignature = $derived(errors.map((error) => `${error?.kind}:${error?.message}`).join("|"));
let dismissedErrorSignature = $state("");
let hasLoadingError = $derived(errorSignature !== "" && errorSignature !== dismissedErrorSignature);
let hasLoadingTimeout = $derived(errors.some((error) => error?.kind === "timeout"));

function retryDataFetch() {
  dismissedErrorSignature = "";
  void invalidate("app:dashboard");
}

function dismissLoadingError() {
  dismissedErrorSignature = errorSignature;
}
</script>

<div class="flex h-screen">
  <!-- Use the Sidebar component -->
  <Sidebar from={yearRange[0]} to={yearRange[1]} {geoid}>
    <CountySearch
      bind:geoid={() => geoid, updateGeoid}
      bind:displayName={() => displayName, updateDisplayName}
    />
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
            bind:yearRange={() => yearRange, updateYearRange}
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
                {#each dataRanges as range, index (range.label)}
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
          <LazyMapLibreMap
            {selectedMapColorKey}
            {selectedMapColorDomain}
            {selectedMapColorRange}
            data={mapData}
            bind:geoid={() => displayNameGeoid, updateGeoid}
            bind:displayName={() => displayName, updateDisplayName}
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
                  <Tooltip description="reopening is....; exisiting is....;" class="mr-6 size-4">
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
            {#each demographicStatistics as stat (stat.id)}
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

<!-- Loading Error -->
<LoadingError
  show={hasLoadingError}
  hasTimeout={hasLoadingTimeout}
  onRetry={retryDataFetch}
  onDismiss={dismissLoadingError}
/>
