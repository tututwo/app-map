<script lang="ts">
// CRITICAL: Apply MapLibre patch BEFORE importing any components that use MapLibre
import "$lib/maplibre-patch";

import { Download, FileText, X } from "lucide-svelte";
import DataSection from "$components/pdf/PDFSection.svelte";
import type { BarSegment } from "$lib/types";
import { Button } from "bits-ui";
import LineChart from "$components/lineChartBrush/lineChart.svelte";

import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

// State management for PDF export
let mainContent = $state<HTMLElement | null>(null);
let isExporting = $state(false);
let exportError = $state<string | null>(null);

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

const introText = $state(
  "Intro text goes here. consectetur adipiscing elit. Quisque maximus risus laoreet lacus venenatis, nec ultrices odio sodales. Phasellus nulla dui, faucibus id rhoncus quis."
);

async function exportToPDF() {
  if (!mainContent) {
    exportError = "Main content not found";
    return;
  }

  try {
    isExporting = true;
    exportError = null;

    // Wait for maps and other dynamic content to fully load
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const canvas = await html2canvas(mainContent, {
      scale: 2, // Higher quality
      useCORS: true, // Handle external resources
      allowTaint: true, // Allow cross-origin images
      width: mainContent.offsetWidth,
      height: mainContent.offsetHeight,
      backgroundColor: "#ffffff",
      logging: true, // Enable logging for debugging
      foreignObjectRendering: false, // Better compatibility with WebGL
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

    pdf.save("closed-churches-fayette-illinois.pdf");
  } catch (error) {
    console.error("PDF export failed:", error);
    exportError = `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  } finally {
    isExporting = false;
  }
}
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
        <button class="flex items-center text-sm text-gray-700 hover:text-gray-900">
          <Download class="mr-1.5 h-4 w-4" />
          Download data
        </button>
      </div>
      <Button.Root class="cursor-pointer text-gray-500 hover:text-gray-700">
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
        Closed Churches in Fayette, Illinois (2003-2011)
      </h1>

      <div
        class="mb-8 flex h-64 items-center justify-center rounded border border-gray-300 bg-gray-50 sm:h-80"
      >
        <svg>
          <line x1="0" y1="0" x2="100" y2="100" stroke="black" />
        </svg>
        <!-- <span class="text-5xl font-bold text-gray-400 italic">Line Chart</span> -->
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div class="space-y-8 lg:col-span-2">
          <DataSection
            title="Total number of closed church"
            mapPlaceholderText="Map"
            mapBorderColor="border-blue-500"
            barData={totalChurchesData}
            description={introText}
          />
          <DataSection
            title="Density of closed church: per 100k population"
            mapPlaceholderText="Map"
            barData={densityPer100kData}
            description={introText}
          />
          <DataSection
            title="Density of closed church: per sqkm"
            mapPlaceholderText="Map"
            barData={densityPerSqkmData}
            description={introText}
          />
        </div>

        <div class="space-y-8 lg:col-span-1">
          <div class="h-full rounded-lg border border-gray-300 p-6">
            <h2 class="mb-4 text-lg font-semibold text-gray-700">Social determinants</h2>
            <div class="flex h-48 items-center justify-center rounded bg-gray-50">
              <span class="text-2xl font-bold text-gray-400 italic">Right section 1</span>
            </div>
          </div>
          <div class="h-full rounded-lg border border-gray-300 p-6">
            <h2 class="mb-4 text-lg font-semibold text-gray-700">Demographics</h2>
            <div class="flex h-48 items-center justify-center rounded bg-gray-50">
              <span class="text-2xl font-bold text-gray-400 italic">Right section 1</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
