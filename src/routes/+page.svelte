<script lang="ts">
import { invalidate } from "$app/navigation";
import { isNationalGeoid } from "$lib/domain/countyGeoid";
import { Pointer, CircleHelp } from "lucide-svelte";

import LoadingError from "$components/loadingPage/LoadingError.svelte";

// Custom UI
import CountySearch from "$components/map/countySearch.svelte";
import Sidebar from "$components/sideSection/Sidebar.svelte";
import Tooltip from "$components/Tooltip.svelte";
import Figure from "$components/chart/Figure.svelte";

import SideMetricsPanel from "$components/sideSection/SideMetricsPanel.svelte";
// Reusable UI components
import { Button } from "bits-ui";
import * as RadioGroup from "$components/ui/radio-group/index.js";
import { Label } from "$components/ui/label/index.js";

// Visualizations
import LineChartBrush from "$components/lineChartBrush/LineChartBrush.svelte";
import StackedBar from "$components/bar/stackedBar.svelte";

// Map
import LazyMapLibreMap from "$components/map/LazyMapLibreMap.svelte";

import {
  createLegendRows,
  createMapMetricPresentations,
  mapMetricDefinitions,
  type MapMetricIndex,
} from "$lib/config/mapMetrics";
import { demographicMetricConfigs, socialDeterminantMetricConfigs } from "$lib/config/sideMetrics";
import { createSideMetricData } from "$lib/utils/sideMetricTransformation";
import { createLastGood } from "$lib/dashboard/last-good.svelte";
import { CountySelection } from "$lib/dashboard/county-selection.svelte";
import { countyDisplayName } from "$lib/dashboard/presentation";
import { setDashboardParams } from "$lib/dashboard/navigate";
import type { LineDatum, MapDatum, StackedDatum } from "$lib/dashboard/data";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

const mapState = createLastGood<MapDatum[]>();
const lineState = createLastGood<LineDatum[]>();
const stackedState = createLastGood<StackedDatum[]>();

function syncDashboardResults() {
  if (data.results.map) mapState.update(data.results.map);
  if (data.results.line) lineState.update(data.results.line);
  if (data.results.stacked) stackedState.update(data.results.stacked);
}

syncDashboardResults();
$effect(syncDashboardResults);

let yearRange = $derived<[number, number]>([data.params.from, data.params.to]);
let geoid = $derived(data.params.geoid);
let mapData = $derived(mapState.value ?? []);
let lineChartData = $derived(lineState.value ?? []);
let stackedBarData = $derived(stackedState.value ?? []);

let highlightedGroup = $state<string | null>(null);

const selection = new CountySelection({
  navigate: setDashboardParams,
  settled: () => data.params.geoid,
});

$effect(() => selection.observeSettled(data.params.geoid));

let displayName = $derived(
  selection.nameOverride !== undefined
    ? selection.nameOverride
    : (countyDisplayName(mapData, selection.geoid) ?? "All locations")
);

function updateYearRange(nextRange: [number, number]) {
  void setDashboardParams({ from: nextRange[0], to: nextRange[1] });
}

function updateGeoid(nextGeoid: string) {
  void selection.select(nextGeoid);
}

function updateDisplayName(nextDisplayName: string | null) {
  selection.setDisplayName(nextDisplayName);
}

// The geolocation seam: the map opens an intent per tracking session and
// commits through it, so a newer selection always cancels the older session.
const geolocation = {
  begin: (onAbort: () => void) => selection.newIntent(onAbort),
  commit: (nextGeoid: string, nextDisplayName: string, signal: AbortSignal) => {
    void selection.select(nextGeoid, { fromIntent: signal });
    selection.setDisplayName(nextDisplayName);
  },
};

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
const emptyMapColorDomain = [0, 1] as const;
let mapMetricPresentations = $derived(createMapMetricPresentations(mapData));
let selectedMapMetric = $state<MapMetricIndex>(mapMetricDefinitions[0].value);
let selectedMapMetricString = $derived(String(selectedMapMetric));
let selectedMapDefinition = $derived(mapMetricDefinitions[selectedMapMetric]);
let selectedMapPresentation = $derived(mapMetricPresentations[selectedMapMetric]);
let selectedMapColorKey = $derived(selectedMapDefinition.colorKey);
let selectedMapColorDomain = $derived(selectedMapPresentation?.colorDomain ?? emptyMapColorDomain);
let selectedMapColorRange = $derived(selectedMapDefinition.colorRange);
let dataRanges = $derived(selectedMapPresentation ? createLegendRows(selectedMapPresentation) : []);

// ----------------------------------------------------------------
// ----------------------Metric Section----------------------
// ----------------------------------------------------------------
let sideResult = $derived(data.results.side);
let selectedSideMetricData = $derived(
  !isNationalGeoid(geoid) && sideResult?.ok ? sideResult.data : undefined
);

let statistics = $derived(
  createSideMetricData(selectedSideMetricData, socialDeterminantMetricConfigs)
);

let demographicStatistics = $derived(
  createSideMetricData(selectedSideMetricData, demographicMetricConfigs)
);

let errors = $derived(
  [
    mapState.error,
    lineState.error,
    stackedState.error,
    sideResult && !sideResult.ok ? sideResult : undefined,
  ].filter(Boolean)
);
let dismissedErrorResults = $state.raw<PageData["results"] | null>(null);
let hasLoadingError = $derived(errors.length > 0 && dismissedErrorResults !== data.results);
let hasLoadingTimeout = $derived(errors.some((error) => error?.kind === "timeout"));

function retryDataFetch() {
  dismissedErrorResults = null;
  void invalidate("app:dashboard");
}

function dismissLoadingError() {
  dismissedErrorResults = data.results;
}
</script>

<div class="flex h-screen">
  <!-- Use the Sidebar component -->
  <Sidebar from={yearRange[0]} to={yearRange[1]} {geoid}>
    <CountySearch
      bind:geoid={() => selection.geoid, updateGeoid}
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
        <Figure>
          <LineChartBrush
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
                  selectedMapMetric = Number(v) as MapMetricIndex;
                }}
                name="metric"
                class="flex h-full flex-col justify-between py-2"
              >
                {#each mapMetricDefinitions as metric (metric.value)}
                  {@const id = `metric-${metric.value}`}
                  <div class="flex items-center gap-2 transition-colors">
                    <RadioGroup.Item {id} value={String(metric.value)} />

                    <Label
                      for={id}
                      class="flex w-full cursor-pointer items-center gap-2 text-sm"
                      style={metric.value === selectedMapMetric ? "font-weight:800" : ""}
                    >
                      {metric.label}
                      <Tooltip description={metric.label} class="-ml-1 h-4 w-4">
                        <span
                          class="bg-yale-blue inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-xs"
                        >
                          <CircleHelp strokeWidth={1.5} color="white" />
                        </span>
                      </Tooltip>
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
                {selectedMapDefinition.label}
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
            bind:geoid={() => selection.geoid, updateGeoid}
            bind:displayName={() => displayName, updateDisplayName}
            {geolocation}
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
            <SideMetricsPanel {statistics} {demographicStatistics} />
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
