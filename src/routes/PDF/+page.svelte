<!-- @param 
 
<!-- For Line Chart, we need to know:
@from:
@to 
-->

<!-- For map, we need to know:
@from:
@to 
-->
<script lang="ts">
import { resolveRoute } from "$app/paths";
import { isNationalGeoid } from "$lib/domain/countyGeoid";
import { tick } from "svelte";
import { Download, FileText, X } from "lucide-svelte";

import type { PageData } from "./$types";
import { Button } from "bits-ui";
import Figure from "$components/chart/Figure.svelte";

import LineChartBrush from "$components/lineChartBrush/LineChartBrush.svelte";

import SideMetricsPanel from "$components/sideSection/SideMetricsPanel.svelte";
import DataSection from "$components/pdf/PDFSection.svelte";

import { demographicMetricConfigs, socialDeterminantMetricConfigs } from "$lib/config/sideMetrics";
import {
  createLegendRows,
  createMapMetricPresentations,
  getMapMetricValue,
  mapMetricDefinitions,
  quantileIndexOf,
} from "$lib/config/mapMetrics";
import { countyDisplayName, dashboardSearch } from "$lib/dashboard/presentation";
import { initialMapCaptureState, type MapCaptureState } from "$lib/map/capture";
import { pageImageOffsets } from "$lib/pdf/paginate";
import { createSideMetricData } from "$lib/utils/sideMetricTransformation";
// State management for PDF export
let mainContent = $state<HTMLElement | null>(null);
let isExporting = $state(false);
let exportError = $state<string | null>(null);
let closureMapCaptureState = $state<MapCaptureState>(initialMapCaptureState());
let closureRateMapCaptureState = $state<MapCaptureState>(initialMapCaptureState());
let persistenceMapCaptureState = $state<MapCaptureState>(initialMapCaptureState());
let mapCaptureStates = $derived([
  closureMapCaptureState,
  closureRateMapCaptureState,
  persistenceMapCaptureState,
]);
let allMapsReady = $derived(mapCaptureStates.every(({ state }) => state === "ready"));
let mapPreparationError = $derived(
  mapCaptureStates.find(
    (state): state is Extract<MapCaptureState, { state: "error" }> => state.state === "error"
  )?.message ?? null
);
let visibleExportError = $derived(
  exportError ?? (mapPreparationError ? `Map rendering failed: ${mapPreparationError}` : null)
);

let { data }: { data: PageData } = $props();
let yearRange = $derived<[number, number]>([data.params.from, data.params.to]);
let geoid = $derived(data.params.geoid);
let mapData = $derived(data.results.map?.ok ? data.results.map.data : []);
let lineChartData = $derived(data.results.line?.ok ? data.results.line.data : []);
const emptyMapColorDomain = [0, 1] as const;
let mapMetricPresentations = $derived(createMapMetricPresentations(mapData));
let countyName = $derived(countyDisplayName(mapData, geoid) ?? "the United States");

const lineChartMargin = { top: 30, right: 10, bottom: 20, left: 40 };

let dataRanges = $derived.by(() => {
  return mapMetricDefinitions.map((definition, metricIndex) => {
    const presentation = mapMetricPresentations[metricIndex];
    if (!presentation) return [];

    const value = getMapMetricValue(
      mapData.find((d) => d.geoid === geoid),
      definition
    );
    const quantileIndex = quantileIndexOf(presentation, value);

    return createLegendRows(presentation).map((row, i) => ({
      // only attach popupValue on the matching bucket
      ...(value !== undefined && i === quantileIndex && { popupValue: value.toFixed(2) }),
      range: row.label,
      color: row.color,
      textColor: row.textColor,
    }));
  });
});

const introText = $state(
  "Intro text goes here. consectetur adipiscing elit. Quisque maximus risus laoreet lacus venenatis, nec ultrices odio sodales. Phasellus nulla dui, faucibus id rhoncus quis."
);

function waitForBrowserPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function reloadReport() {
  window.location.reload();
}

async function exportToPDF() {
  if (import.meta.env.SSR) return;

  if (!mainContent) {
    exportError = "Main content not found";
    return;
  }

  if (!allMapsReady) {
    exportError = "Maps are still preparing. Please try again in a moment.";
    return;
  }

  const readyRevisions = mapCaptureStates.map(({ revision }) => revision);

  isExporting = true; // This will now trigger forceStatic in the children
  exportError = null;

  try {
    const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

    await tick();
    await waitForBrowserPaint();

    if (
      !allMapsReady ||
      mapCaptureStates.some(({ revision }, index) => revision !== readyRevisions[index])
    ) {
      throw new Error("A map changed while the report was being prepared");
    }

    // 3. Capture the canvas now that the DOM is updated
    const imgData = await toJpeg(mainContent, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      filter: (element) => !element.classList?.contains("maplibregl-control-container"),
    });

    const pdf = new jsPDF("p", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // we need to get image dimension
    const tempImage = new Image();
    tempImage.src = imgData;
    await new Promise((resolve) => (tempImage.onload = resolve));

    const PAGE_MARGIN = 20;
    const imgWidth = pageWidth - PAGE_MARGIN * 2;
    const imgHeight = (tempImage.height * imgWidth) / tempImage.width;

    // Draw the full image on every page at a rising negative offset; the page
    // clips to its band, so successive pages show successive slices.
    const [firstOffset, ...continuationOffsets] = pageImageOffsets(
      imgHeight,
      pageHeight,
      PAGE_MARGIN
    );
    pdf.addImage(imgData, "JPEG", PAGE_MARGIN, firstOffset, imgWidth, imgHeight);
    for (const offset of continuationOffsets) {
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", PAGE_MARGIN, offset, imgWidth, imgHeight);
    }

    pdf.save(`${countyName}_${yearRange[0]}-${yearRange[1]}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    exportError = `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  } finally {
    isExporting = false; // This will return the components to their anim
  }
}

let selectedSideMetricData = $derived(
  !isNationalGeoid(geoid) && data.results.side?.ok ? data.results.side.data : undefined
);
let statistics = $derived(
  createSideMetricData(selectedSideMetricData, socialDeterminantMetricConfigs)
);
let demographicStatistics = $derived(
  createSideMetricData(selectedSideMetricData, demographicMetricConfigs)
);
</script>

<div class="flex min-h-screen items-start justify-center bg-gray-100 p-4 sm:p-8">
  <div class="w-full max-w-6xl rounded-lg bg-white p-6 shadow-xl sm:p-8">
    <header class="mb-6 flex items-center justify-between border-b border-gray-300 pb-4">
      <div class="flex items-center space-x-4">
        <button
          onclick={exportToPDF}
          disabled={isExporting || !allMapsReady}
          title={allMapsReady
            ? "Save this report as a PDF"
            : mapPreparationError
              ? "Report maps could not be loaded"
              : "Preparing report maps"}
          class="flex cursor-pointer items-center text-sm text-gray-700 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {#if isExporting}
            <svg class="mr-1.5 h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
                fill="none"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Exporting...
          {:else if mapPreparationError}
            Maps unavailable
          {:else if !allMapsReady}
            Preparing maps...
          {:else}
            <FileText class="mr-1.5 h-4 w-4" />
            Save as PDF
          {/if}
        </button>
        <form method="GET" action="/api/download_data" target="_blank">
          <input type="hidden" name="from" value={yearRange[0]} />
          <input type="hidden" name="to" value={yearRange[1]} />
          <input type="hidden" name="geoid" value={geoid} />
          <button type="submit" class="flex items-center text-sm text-gray-700 hover:text-gray-900">
            <Download class="mr-1.5 h-4 w-4" />
            Download data
          </button>
        </form>
      </div>
      <Button.Root
        href={`${resolveRoute("/", {})}?${dashboardSearch({ from: yearRange[0], to: yearRange[1], geoid })}`}
        class="cursor-pointer text-gray-500 hover:text-gray-700"
      >
        <X class="h-5 w-5" />
      </Button.Root>
    </header>

    <!-- Error message -->
    {#if visibleExportError}
      <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
        <div class="flex">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Export Error</h3>
            <p class="mt-1 text-sm text-red-700">{visibleExportError}</p>
            {#if mapPreparationError}
              <button
                type="button"
                class="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                onclick={reloadReport}
              >
                Reload report
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <main bind:this={mainContent}>
      <h1 class="mb-2 text-2xl font-bold text-gray-800">
        Closed Churches in {countyName} ({yearRange[0]}-{yearRange[1]})
      </h1>

      <div class="mb-8 flex h-48 items-center justify-center rounded border-gray-300">
        <Figure>
          <LineChartBrush
            margin={lineChartMargin}
            {yearRange}
            data={lineChartData}
            disableBrushing={true}
          />

          {#snippet figcaption()}
            This is a caption for the line chart showing church closures over time.
          {/snippet}
        </Figure>
        <!-- <span class="text-5xl font-bold text-gray-400 italic">Line Chart</span> -->
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div class="space-y-8 lg:col-span-2">
          <DataSection
            title="Total number of closed church"
            mapBorderColor="border-blue-100"
            legendData={dataRanges[0]}
            description={introText}
            mapColorKey={mapMetricDefinitions[0].colorKey}
            mapColorRange={mapMetricDefinitions[0].colorRange}
            mapColorDomain={mapMetricPresentations[0]?.colorDomain ?? emptyMapColorDomain}
            {mapData}
            {geoid}
            bind:mapCaptureState={closureMapCaptureState}
          />
          <DataSection
            title="Rate of closed churches per 10,000 population"
            legendData={dataRanges[1]}
            description={introText}
            mapColorKey={mapMetricDefinitions[1].colorKey}
            mapColorRange={mapMetricDefinitions[1].colorRange}
            mapColorDomain={mapMetricPresentations[1]?.colorDomain ?? emptyMapColorDomain}
            {mapData}
            {geoid}
            bind:mapCaptureState={closureRateMapCaptureState}
          />
          <DataSection
            title="Persistence of open churches"
            legendData={dataRanges[2]}
            description={introText}
            mapColorKey={mapMetricDefinitions[2].colorKey}
            mapColorRange={mapMetricDefinitions[2].colorRange}
            mapColorDomain={mapMetricPresentations[2]?.colorDomain ?? emptyMapColorDomain}
            {mapData}
            {geoid}
            bind:mapCaptureState={persistenceMapCaptureState}
          />
        </div>

        <div class="space-y-8 lg:col-span-1">
          <div class="relative h-[calc(100%)] p-2">
            <!-- Scrollable container -->
            <div class="absolute inset-0 overflow-y-auto pr-1">
              <!-- Social determinants -->
              <SideMetricsPanel {statistics} {demographicStatistics} forceStatic={isExporting} />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
