<script>
import { onMount } from "svelte";
import { Pointer, CircleHelp, Download, ArrowRight } from "lucide-svelte";
// State management using Svelte 5 runes
let selectedMetric = $state("Number of closed church");
let timeRange = $state({ from: 2003, to: 2011 });
let selectedLocation = $state("All locations");
let highlightedGroup = $state(null);

// Data ranges for the legend with corrected colors and widths
const dataRanges = [
  { label: "1-12", color: "#cfe2f3", width: "70px" },
  { label: "13-24", color: "#9fc5e8", width: "90px" },
  { label: "25-36", color: "#6fa8dc", width: "90px" },
  { label: "37-48", color: "#b4a7d6", width: "90px" },
  { label: "49-60", color: "#d5a6bd", width: "80px" },
];

// Event handlers
function handleLocationChange(e) {
  selectedLocation = e.target.value;
}

function highlightGroup(range) {
  highlightedGroup = range;
}

// Initialize any components on mount
onMount(() => {
  // This would initialize charts, maps, etc.
  console.log("Dashboard mounted");
});
</script>

<div class="flex h-screen">
  <!-- Improved Sidebar with updated width logic -->
  <aside class="flex w-[max(250px,min(15vw,250px))] flex-col bg-[#002654] text-white">
    <div class="flex h-full flex-col p-6">
      <!-- Yale Logo -->
      <div class="mb-14">
        <h1 class="text-4xl font-normal tracking-wide">Yale</h1>
      </div>

      <!-- Main Title -->
      <div class="mb-14">
        <h2 class="text-[32px] leading-tight font-bold">
          Closed<br />Churches<br />in the US
        </h2>
      </div>

      <!-- Location Section -->
      <div class="mb-auto">
        <h3 class="mb-2 text-lg font-normal">Location of interest</h3>
        <p class="mb-3 text-[15px] leading-snug font-light opacity-90">
          Input name or zipcode of a location, leave it blank for the entire country
        </p>

        <input
          type="text"
          placeholder="All locations"
          value={selectedLocation}
          oninput={handleLocationChange}
          class="w-full rounded border-none bg-white p-2.5 text-[15px] text-gray-500 shadow-sm"
        />
      </div>

      <!-- About Section -->
      <div class="mt-auto">
        <h3 class="mb-2 text-lg font-normal">About this project</h3>
        <p class="mb-6 text-[15px] leading-snug font-light opacity-90">
          This project is a collaboration between Yale Center for Geospatial Solutions and Yale
          School of Public Health.
        </p>

        <!-- Divider -->
        <div class="mb-6 h-px w-full bg-white/30"></div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-4">
          <button
            class="flex items-center gap-3 text-[15px] font-light opacity-90 transition-opacity hover:opacity-100"
          >
            <ArrowRight color="white" strokeWidth={1.5} />
            Share to social media
          </button>
          <button
            class="flex items-center gap-3 text-[15px] font-light opacity-90 transition-opacity hover:opacity-100"
          >
            <Download size={24} strokeWidth={1.5} color="white" />
            Download data
          </button>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex h-screen flex-1 flex-col overflow-hidden p-5">
    <!-- Line chart section - 1/5 of height -->
    <section aria-label="Line chart" class="mb-5 h-[20vh] rounded border border-gray-200">
      <header class="flex items-center justify-between border-b border-gray-200 px-5 py-2.5">
        <h2 class="text-base">
          Number of <span class="font-bold">closed churches</span> in
          <span class="font-bold">all locations</span> over time
        </h2>
        <span class="text-xs text-gray-500">Data source: research center data port</span>
      </header>
      <div class="flex h-[calc(20vh-50px)] items-center justify-center">
        <h1 class="text-5xl text-black opacity-80">Line chart</h1>
      </div>
    </section>

    <!-- Controls and charts section - takes remaining height -->
    <div class="grid flex-1 grid-cols-[2fr_1fr] gap-5">
      <!-- Left column - controls and map -->
      <div class="flex h-full flex-col">
        <!-- Time range and controls -->
        <div class="mb-5">
          <!-- Time range -->
          <h3 class="mb-4 text-lg font-medium text-[#00a651]">
            From {timeRange.from} to {timeRange.to}
          </h3>

          <!-- Controls grid with radio buttons and legend -->
          <div class="mb-2 grid grid-cols-2 gap-4">
            <!-- Radio buttons for metrics -->
            <section aria-label="Metrics" class="flex flex-col gap-2.5">
              <label class="flex items-center gap-2 text-sm">
                <div class="relative flex items-center">
                  <input
                    type="radio"
                    name="metric"
                    value="Number of closed church"
                    checked={selectedMetric === "Number of closed church"}
                    onchange={() => (selectedMetric = "Number of closed church")}
                    class="h-4 w-4 appearance-none rounded-full border border-gray-300 checked:border-4 checked:border-black"
                  />
                </div>
                Number of closed church
              </label>

              <label class="flex items-center gap-2 text-sm">
                <div class="relative flex items-center">
                  <input
                    type="radio"
                    name="metric"
                    value="Density of closed church: per 100k population"
                    checked={selectedMetric === "Density of closed church: per 100k population"}
                    onchange={() =>
                      (selectedMetric = "Density of closed church: per 100k population")}
                    class="h-4 w-4 appearance-none rounded-full border border-gray-300 checked:border-4 checked:border-black"
                  />
                </div>
                Density of closed church: per 100k population
                <span
                  class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-xs"
                  ><CircleHelp color="black" strokeWidth={1} /></span
                >
              </label>

              <label class="flex items-center gap-2 text-sm">
                <div class="relative flex items-center">
                  <input
                    type="radio"
                    name="metric"
                    value="Density of closed church: per sqkm"
                    checked={selectedMetric === "Density of closed church: per sqkm"}
                    onchange={() => (selectedMetric = "Density of closed church: per sqkm")}
                    class="h-4 w-4 appearance-none rounded-full border border-gray-300 checked:border-4 checked:border-black"
                  />
                </div>
                Density of closed church: per sqkm
                <span
                  class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-xs"
                  ><CircleHelp color="black" strokeWidth={1} /></span
                >
              </label>
            </section>

            <!-- Improved Legend section to match reference image -->
            <section aria-label="Legend" class="flex flex-col">
              <div class="mb-1">
                <h4 class="mb-1 text-sm">Number of closed church</h4>
                <div class="flex justify-between">
                  {#each dataRanges as range}
                    <button
                      style="background-color: {range.color}; width: {range.width};"
                      class="flex h-8 w-16 cursor-pointer items-center justify-center text-sm"
                      onclick={() => highlightGroup(range.label)}
                      class:ring-2={highlightedGroup === range.label}
                      class:ring-black={highlightedGroup === range.label}
                    >
                      {range.label}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="mt-1 flex items-center justify-center text-xs">
                <span class="mr-1 inline-flex items-center justify-center">
                  <Pointer />
                </span>
                Select a group to highlight
              </div>
            </section>
          </div>
        </div>

        <!-- Map section - takes all remaining height -->
        <section
          aria-label="Map"
          class="flex flex-1 items-center justify-center rounded border border-gray-200"
        >
          <h1 class="text-5xl text-black opacity-80">Map</h1>
        </section>
      </div>

      <!-- Right column - stacked bar and small line charts -->
      <div class="flex h-full flex-col">
        <!-- Stacked bar chart -->
        <section
          aria-label="Stacked bar chart"
          class="mb-5 flex min-h-[185px] items-center justify-center rounded border border-gray-200"
        >
          <h1 class="text-4xl text-black opacity-80">stacked bar</h1>
        </section>

        <!-- Small line charts - fixed height container with scrolling -->
        <div class="relative h-[calc(100%-185px-1.25rem)]">
          <!-- Scrollable container -->
          <div class="absolute inset-0 overflow-y-auto pr-1">
            <!-- Multiple small line charts to demonstrate scrolling -->
            <section
              aria-label="Small line chart 1"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <h1 class="text-2xl text-black opacity-80">small line chart 1</h1>
            </section>

            <section
              aria-label="Small line chart 2"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <h1 class="text-2xl text-black opacity-80">small line chart 2</h1>
            </section>

            <section
              aria-label="Small line chart 3"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <h1 class="text-2xl text-black opacity-80">small line chart 3</h1>
            </section>

            <section
              aria-label="Small line chart 4"
              class="mb-5 flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <h1 class="text-2xl text-black opacity-80">small line chart 4</h1>
            </section>

            <section
              aria-label="Small line chart 5"
              class="flex h-[150px] items-center justify-center rounded border border-gray-200"
            >
              <h1 class="text-2xl text-black opacity-80">small line chart 5</h1>
            </section>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<!-- Add Tailwind directives for custom styling -->
<style global>
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}
</style>
