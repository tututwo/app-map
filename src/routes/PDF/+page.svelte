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
// CRITICAL: Apply MapLibre patch BEFORE importing any components that use MapLibre
import "$lib/maplibre-patch";

import { untrack, tick } from "svelte";
import { Download, FileText, X } from "lucide-svelte";

import type { BarSegment } from "$lib/types";
import { Button } from "bits-ui";
import Figure from "$components/chart/Figure.svelte";

import LineChartBrush from "$components/lineChartBrush/LineChartBrush.svelte";

import PercentageBar from "$components/sideSection/percentageBar.svelte";
import DataSection from "$components/pdf/PDFSection.svelte";

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { onMount } from "svelte";

import counties_geoid from "$data/counties_geoid.csv";
import { dataFilters } from "$lib/filters.svelte.js";
import { getAccessibleTextColor } from "$lib/utils/accessibleTextColor";

import { scaleQuantize } from "d3-scale";
// State management for PDF export
let mainContent = $state<HTMLElement | null>(null);
let isExporting = $state(false);
let exportError = $state<string | null>(null);

// --- ADD THIS ---
let pdfOverrideWidths = $state<Record<string, number>>({});

let yearRange = $state<[number, number]>([2003, 2011]);
let geoid = $state("00000");
let mapData = $state<any[]>([]);
let lineChartData = $state<{ year: number; close: number }[]>([]);

onMount(() => {
  const urlParams = new URLSearchParams(window.location.search);
  yearRange[0] = parseInt(urlParams.get("from") ?? "2003");
  yearRange[1] = parseInt(urlParams.get("to") ?? "2011");
  geoid = urlParams.get("geoid") ?? "00000";
});

const n = 5;

// build a quantize scale that clamps out-of-range values
const whichQuantile = (domain: [number, number]) =>
  scaleQuantize<number, number>()
    .domain(domain)
    .range(Array.from({ length: n }, (_, i) => i + 1)); // [1,2,3,4,5]

async function fetchMapData(from: number, to: number) {
  // wait for the brush transition animation to finish
  // otherwise it lags
  const response = await fetch(`/api/map_data?from=${from}&to=${to}`);
  mapData = await response.json();
}
async function fetchLineChartData(geoidParam?: string) {
  try {
    const url = `/api/line_chart_data?geoid=${geoidParam}`;
    const response = await fetch(url);
    lineChartData = await response.json();
  } catch (error) {
    console.error("Error fetching line chart data:", error);
    // Keep existing data on error
  }
}
$effect(() => {
  fetchMapData(yearRange[0], yearRange[1]);
});

$effect(() => {
  // Fetch line chart data when geoid changes
  // If geoid is "00000" (default), fetch aggregated data for all locations
  const geoidToFetch = geoid === "00000" ? "" : geoid;
  fetchLineChartData(geoidToFetch);
});
const lineChartMargin = { top: 30, right: 10, bottom: 20, left: 40 };

// ----------------------------------------------------------------
// ---------------Legend Data----------------------------
// ----------------------------------------------------------------
const totalChurchesData: BarSegment[] = $state([
  { range: "1-12", color: "bg-pink-200", textColor: "text-black" },
  { range: "13-24", color: "bg-pink-300", textColor: "text-black" },
  {
    range: "25-36",
    color: "bg-pink-400",
    textColor: "text-white",
    popupValue: "25",
    markerText: "US Average",
  }, // This is the one with the specific popup
  { range: "37-48", color: "bg-pink-500", textColor: "text-white" },
  { range: "49-60", color: "bg-pink-600", textColor: "text-white" },
]);

// Removed popupValue from other datasets to match the image's focus
const densityPer100kData: BarSegment[] = $state([
  { range: "0-20", color: "bg-orange-200", textColor: "text-black" },
  { range: "21-40", color: "bg-orange-300", textColor: "text-black" },
  { range: "41-60", color: "bg-orange-400", textColor: "text-white" },
  {
    range: "61-80",
    color: "bg-amber-500",
    textColor: "text-white" /* popupValue: '80%' removed */,
  },
  { range: "81-100", color: "bg-amber-600", textColor: "text-white" },
]);

const densityPerSqkmData: BarSegment[] = $state([
  { range: "1-12", color: "bg-purple-200", textColor: "text-black" },
  { range: "13-24", color: "bg-purple-300", textColor: "text-black" },
  {
    range: "25-36",
    color: "bg-purple-400",
    textColor: "text-white" /* popupValue: '12k' removed */,
  },
  { range: "37-48", color: "bg-purple-500", textColor: "text-white" },
  { range: "49-60", color: "bg-purple-600", textColor: "text-white" },
]);
// Usage in your Svelte component:

let dataRanges = $derived.by(() => {
  let threeMetrics = $state([0, 1, 2]);

  return threeMetrics.map((metric) => {
    const m = dataFilters.metrics[metric];
    const quantize = whichQuantile(m.colorDomain as [number, number]);

    // find the raw value (could be 0, undefined, etc.)
    const rec = mapData.find((d) => d.geoid === geoid);
    const raw = rec?.[m.colorKey];

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
  if (!mainContent) {
    exportError = "Main content not found";
    return;
  }

  isExporting = true; // This will now trigger forceStatic in the children
  exportError = null;

  try {
    // 2. Wait for Svelte to apply the new widths to the components
    await tick();
    // HACK: Wait a brief moment for the browser to paint the changes before capturing.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Capture the canvas now that the DOM is updated
    const canvas = await html2canvas(mainContent, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      ignoreElements: (element) => element.classList.contains("maplibregl-control-container"),
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

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

    pdf.save("closed-churches-fayette-illinois.pdf");
  } catch (error) {
    console.error("PDF export failed:", error);
    exportError = `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  } finally {
    isExporting = false; // This will return the components to their anim
  }
}

// ----------------------------------------------------------------
// ---------------Social Determinants----------------------------
// ----------------------------------------------------------------
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
        <a
          href={`/api/download_data?from=${yearRange[0]}&to=${yearRange[1]}&geoid=${geoid}`}
          target="_blank"
          class="flex items-center text-sm text-gray-700 hover:text-gray-900"
        >
          <Download class="mr-1.5 h-4 w-4" />
          Download data
        </a>
      </div>
      <Button.Root href="/" class="cursor-pointer text-gray-500 hover:text-gray-700">
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
        Closed Churches in {counties_geoid.find((c) => c.geoid === geoid)?.name} ({yearRange[0]}-{yearRange[1]})
      </h1>

      <div class="mb-8 flex h-48 items-center justify-center rounded border border-gray-300">
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
        <!-- <span class="text-5xl font-bold text-gray-400 italic">Line Chart</span> -->
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div class="space-y-8 lg:col-span-2">
          <DataSection
            title="Total number of closed church"
            mapPlaceholderText="Map"
            mapBorderColor="border-blue-500"
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
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
