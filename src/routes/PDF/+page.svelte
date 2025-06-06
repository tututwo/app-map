<script lang="ts">
// CRITICAL: Apply MapLibre patch BEFORE importing any components that use MapLibre
import "$lib/maplibre-patch";

import Figure from "$components/Figure.svelte";
import LineChart from "$components/lineChartBrush/lineChart.svelte";
import MapLibreMap from "$components/map/maplibre-map.svelte";
import { dataFilters } from "$lib/filters.svelte.js";

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

// State management
let dashboardContent = $state<HTMLElement | null>(null);
let isExporting = $state(false);
let exportError = $state<string | null>(null);

// Sample data for the charts
const data = [
  { date: "2003-01-01T00:00:00.000Z", close: 40 },
  { date: "2005-01-01T00:00:00.000Z", close: 120 },
  { date: "2007-01-01T00:00:00.000Z", close: 40 },
  { date: "2009-01-01T00:00:00.000Z", close: 30 },
  { date: "2011-01-01T00:00:00.000Z", close: 50 },
];

const initialBrushSelection = [
  new Date("2003-01-01T00:00:00.000Z"),
  new Date("2011-01-01T00:00:00.000Z"),
];

async function exportToPDF() {
  if (!dashboardContent) {
    exportError = "Dashboard content not found";
    return;
  }

  try {
    isExporting = true;
    exportError = null;

    // Wait a bit for any dynamic content to render
    await new Promise((resolve) => setTimeout(resolve, 500));

    const canvas = await html2canvas(dashboardContent, {
      scale: 2, // Higher quality
      useCORS: true, // Handle external resources
      allowTaint: true, // Allow cross-origin images
      width: dashboardContent.offsetWidth,
      height: dashboardContent.offsetHeight,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "a4");

    // Calculate dimensions to fit A4
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40; // 20pt margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add the image with margins
    pdf.addImage(imgData, "PNG", 20, 20, imgWidth, Math.min(imgHeight, pageHeight - 40));

    // If content is taller than page, add additional pages
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

    pdf.save("closed-churches-dashboard.pdf");
  } catch (error) {
    console.error("PDF export failed:", error);
    exportError = `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  } finally {
    isExporting = false;
  }
}
</script>

<div class="min-h-screen bg-gray-50 p-6">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Church Closures Dashboard</h1>
      <p class="mt-1 text-sm text-gray-600">Export dashboard to PDF</p>
    </div>

    <div class="flex gap-3">
      <button
        onclick={exportToPDF}
        disabled={isExporting}
        class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if isExporting}
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
          Export PDF
        {/if}
      </button>
    </div>
  </div>

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

  <!-- Dashboard content to be exported -->
  <div
    class="dashboard-content rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
    bind:this={dashboardContent}
  >
    <!-- Header -->
    <div class="mb-8 text-center">
      <h2 class="mb-2 text-2xl font-bold text-gray-900">
        Closed Churches in {dataFilters.county || "All Locations"} (2003-2011)
      </h2>
      <p class="text-sm text-gray-600">Data source: Research Center Data Port</p>
    </div>

    <!-- Line chart section -->
    <div class="mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-800">Church Closures Over Time</h3>
      <div class="h-[300px] rounded-lg border border-gray-200 p-4">
        <Figure>
          <LineChart
            {data}
            {initialBrushSelection}
            xTickPosition="bottom"
            yTickPosition="left"
            showChartBorder={true}
            showXGridlines={true}
            showYGridlines={true}
            gridLineColor="hsla(0, 0%, 85%, 1)"
            yTickCount={4}
            circleRadius={6}
            circleHoverRadius={8}
            lineColor="hsla(211, 98%, 21%, 1)"
            circleColor="hsla(211, 98%, 21%, 1)"
            margin={{ top: 40, right: 40, bottom: 60, left: 60 }}
            enableBrushing={false}
          />
          {#snippet figcaption()}
            <p class="mt-2 text-sm text-gray-600">
              Timeline showing the number of church closures from 2003 to 2011
            </p>
          {/snippet}
        </Figure>
      </div>
    </div>

    <!-- Map section -->
    <div class="mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-800">Geographic Distribution</h3>
      <div class="h-[400px] overflow-hidden rounded-lg border border-gray-200">
        <MapLibreMap />
      </div>
    </div>

    <!-- Demographics section -->
    <div class="mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-800">Key Statistics</h3>
      <div class="grid grid-cols-2 gap-6">
        <div class="rounded-lg bg-gray-50 p-4">
          <h4 class="mb-2 font-medium text-gray-900">Total Closures</h4>
          <p class="text-2xl font-bold text-blue-600">285</p>
          <p class="text-sm text-gray-600">Churches closed (2003-2011)</p>
        </div>
        <div class="rounded-lg bg-gray-50 p-4">
          <h4 class="mb-2 font-medium text-gray-900">Peak Year</h4>
          <p class="text-2xl font-bold text-red-600">2005</p>
          <p class="text-sm text-gray-600">Highest closure rate</p>
        </div>
        <div class="rounded-lg bg-gray-50 p-4">
          <h4 class="mb-2 font-medium text-gray-900">Affected Communities</h4>
          <p class="text-2xl font-bold text-green-600">47</p>
          <p class="text-sm text-gray-600">Counties impacted</p>
        </div>
        <div class="rounded-lg bg-gray-50 p-4">
          <h4 class="mb-2 font-medium text-gray-900">Average per Year</h4>
          <p class="text-2xl font-bold text-purple-600">32</p>
          <p class="text-sm text-gray-600">Closures annually</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-gray-200 pt-4 text-center text-sm text-gray-500">
      <p>Generated on {new Date().toLocaleDateString()} | Church Closures Research Project</p>
    </div>
  </div>
</div>
