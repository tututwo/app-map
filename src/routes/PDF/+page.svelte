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
import { tick } from "svelte";
import { Download, FileText, X } from "lucide-svelte";

import type { PageData } from "./$types";
import { Button } from "bits-ui";
import Figure from "$components/chart/Figure.svelte";

import LineChartBrush from "$components/lineChartBrush/LineChartBrush.svelte";

import PercentageBar from "$components/sideSection/percentageBar.svelte";
import DataSection from "$components/pdf/PDFSection.svelte";

import { demographicMetricConfigs, socialDeterminantMetricConfigs } from "$lib/config/sideMetrics";
import { dataFilters } from "$lib/filters.svelte.js";
import { getAccessibleTextColor } from "$lib/utils/accessibleTextColor";
import { createSideMetricData } from "$lib/utils/sideMetricTransformation";

import { scaleQuantize } from "d3-scale";
// State management for PDF export
let mainContent = $state<HTMLElement | null>(null);
let isExporting = $state(false);
let exportError = $state<string | null>(null);

// --- ADD THIS ---
let pdfOverrideWidths = $state<Record<string, number>>({});

let { data }: { data: PageData } = $props();
let yearRange = $derived<[number, number]>([data.params.from, data.params.to]);
let geoid = $derived(data.params.geoid);
let mapData = $derived(data.results.map?.ok ? data.results.map.data : []);
let lineChartData = $derived(data.results.line?.ok ? data.results.line.data : []);
let countyName = $derived(
  geoid === "00000"
    ? "the United States"
    : (mapData.find((county) => county.geoid === geoid)?.name ?? geoid)
);

const n = 5;

// build a quantize scale that clamps out-of-range values
const whichQuantile = (domain: [number, number]) =>
  scaleQuantize<number, number>()
    .domain(domain)
    .range(Array.from({ length: n }, (_, i) => i + 1)); // [1,2,3,4,5]

const lineChartMargin = { top: 30, right: 10, bottom: 20, left: 40 };

let dataRanges = $derived.by(() => {
  let threeMetrics = $state([0, 1, 2]);

  return threeMetrics.map((metric) => {
    const m = dataFilters.metrics[metric];
    const quantize = whichQuantile(m.colorDomain as [number, number]);

    // find the raw value (could be 0, undefined, etc.)
    const rec = mapData.find((d) => d.geoid === geoid);
    const raw = rec?.[m.colorKey as keyof typeof rec] as number | undefined;

    // if raw is nullish, force it to domain[0]; otherwise leave 0 ↦ 0
    const value = raw ?? m.colorDomain[0];

    // 1..n → subtract 1 for a 0-based index
    const quantileIndex = quantize(value) - 1;

    return m.legendText.map((range, i) => ({
      // only attach popupValue on the matching bucket
      ...(i === quantileIndex && { popupValue: value.toFixed(2) }),

      range,
      color: m.colorRange[i],
      textColor: getAccessibleTextColor(m.colorRange[i], "normal"),
    }));
  });
});

const introText = $state(
  "Intro text goes here. consectetur adipiscing elit. Quisque maximus risus laoreet lacus venenatis, nec ultrices odio sodales. Phasellus nulla dui, faucibus id rhoncus quis."
);

async function exportToPDF() {
  if (import.meta.env.SSR) return;

  if (!mainContent) {
    exportError = "Main content not found";
    return;
  }

  isExporting = true; // This will now trigger forceStatic in the children
  exportError = null;

  try {
    const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

    // 2. Wait for Svelte to apply the new widths to the components
    await tick();
    // HACK: Wait a brief moment for the browser to paint the changes before capturing.
    await new Promise((resolve) => setTimeout(resolve, 100));

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

    const imgWidth = pageWidth - 40;
    const imgHeight = (tempImage.height * imgWidth) / tempImage.width;

    pdf.addImage(imgData, "PNG", 20, 20, imgWidth, Math.min(imgHeight, pageHeight - 40));

    if (imgHeight > pageHeight - 40) {
      let remainingHeight = imgHeight - (pageHeight - 40);
      let yOffset = -(pageHeight - 40);
      while (remainingHeight > 0) {
        pdf.addPage();
        const currentPageHeight = Math.min(remainingHeight, pageHeight - 40);
        pdf.addImage(imgData, "PNG", 20, yOffset, imgWidth, imgHeight);
        remainingHeight -= currentPageHeight;
        yOffset -= pageHeight;
      }
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
  geoid !== "00000" && data.results.side?.ok ? data.results.side.data : undefined
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
          disabled={isExporting}
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
        href={`${resolveRoute("/", {})}?from=${yearRange[0]}&to=${yearRange[1]}&geoid=${geoid}`}
        class="cursor-pointer text-gray-500 hover:text-gray-700"
      >
        <X class="h-5 w-5" />
      </Button.Root>
    </header>

    <!-- Error message -->
    {#if exportError}
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
            <p class="mt-1 text-sm text-red-700">{exportError}</p>
          </div>
        </div>
      </div>
    {/if}

    <main bind:this={mainContent}>
      <h1 class="mb-2 text-2xl font-bold text-gray-800">
        Closed Churches in {countyName} ({yearRange[0]}-{yearRange[1]})
      </h1>

      <div class="mb-8 flex h-48 items-center justify-center rounded border-gray-300">
        <Figure exclude="">
          <LineChartBrush
            key="close"
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
            mapPlaceholderText="Map"
            mapBorderColor="border-blue-100"
            legendData={dataRanges[0]}
            description={introText}
            mapColorKey="closure"
            mapColorRange={["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"]}
            mapColorDomain={[0, 1]}
            {mapData}
            {geoid}
          />
          <DataSection
            title="Rate of closed churches per 10,000 population"
            mapPlaceholderText="Map"
            legendData={dataRanges[1]}
            description={introText}
            mapColorKey="closure_rate_per_10000"
            mapColorRange={["#FAE2C9", "#E9C39B", "#D9A671", "#CB8944", "#B96308"]}
            mapColorDomain={[0, 1]}
            {mapData}
            {geoid}
          />
          <DataSection
            title="Persistence of open churches"
            mapPlaceholderText="Map"
            legendData={dataRanges[2]}
            description={introText}
            mapColorKey="persistence"
            mapColorRange={["#F1E0FD", "#CCADE3", "#A272C5", "#7836A7", "#5C168E"]}
            mapColorDomain={[0, 1]}
            {mapData}
            {geoid}
          />
        </div>

        <div class="space-y-8 lg:col-span-1">
          <div class="relative h-[calc(100%)] p-2">
            <!-- Scrollable container -->
            <div class="absolute inset-0 overflow-y-auto pr-1">
              <!-- Social determinants -->
              <h4 class="text-lg font-semibold">Social Determinants</h4>
              {#if statistics.length === 0 && demographicStatistics.length === 0}
                <p class="mt-2 text-sm text-gray-600">
                  Community and demographic data are unavailable for this location.
                </p>
              {:else}
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
                    overrideWidth={pdfOverrideWidths[stat.id]}
                    forceStatic={isExporting}
                  />
                {/each}
                <h4 class="mt-4 text-lg font-semibold">Demographics</h4>
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
                    overrideWidth={pdfOverrideWidths[stat.id]}
                    forceStatic={isExporting}
                  />
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
