<script lang="ts">
import { Download, FileText, X } from "lucide-svelte";
import DataSection from "$components/pdf/PDFSection.svelte";
import type { BarSegment } from "$lib/types";

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
</script>

<div class="flex min-h-screen items-start justify-center bg-gray-100 p-4 sm:p-8">
  <div class="w-full max-w-6xl rounded-lg bg-white p-6 shadow-xl sm:p-8">
    <header class="mb-6 flex items-center justify-between border-b pb-4">
      <div class="flex items-center space-x-4">
        <button class="flex items-center text-sm text-gray-700 hover:text-gray-900">
          <FileText class="mr-1.5 h-4 w-4" />
          Save as PDF
        </button>
        <button class="flex items-center text-sm text-gray-700 hover:text-gray-900">
          <Download class="mr-1.5 h-4 w-4" />
          Download data
        </button>
      </div>
      <button class="text-gray-500 hover:text-gray-700">
        <X class="h-5 w-5" />
      </button>
    </header>

    <main>
      <h1 class="mb-2 text-2xl font-bold text-gray-800">
        Closed Churches in Fayette, Illinois (2003-2011)
      </h1>

      <div
        class="mb-8 flex h-64 items-center justify-center rounded border border-gray-300 bg-gray-50 sm:h-80"
      >
        <span class="text-5xl font-bold text-gray-400 italic">Line Chart</span>
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
