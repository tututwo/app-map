<script lang="ts">
import Figure from "$components/Figure.svelte";
import StackedBar from "$components/bar/stackedBar.svelte";

// Initial data matching the pattern in the image
let currentDataset = $state("original");

// Multiple datasets to demonstrate animations
const datasets: Record<
  string,
  Array<{ year: number; negative: number; neutral: number; positive: number }>
> = {
  original: [
    { year: 2003, negative: -10, neutral: 20, positive: 4 },
    { year: 2004, negative: -18, neutral: 20, positive: 6 },
    { year: 2005, negative: -4, neutral: 20, positive: 4 },
    { year: 2006, negative: -10, neutral: 20, positive: 6 },
    { year: 2007, negative: -8, neutral: 20, positive: 8 },
    { year: 2008, negative: -4, neutral: 20, positive: 10 },
    { year: 2009, negative: -2, neutral: 20, positive: 12 },
    { year: 2010, negative: -12, neutral: 20, positive: 8 },
    { year: 2011, negative: -4, neutral: 20, positive: 14 },
  ],
  updated: [
    { year: 2003, negative: -5, neutral: 15, positive: 8 },
    { year: 2004, negative: -12, neutral: 18, positive: 10 },
    { year: 2005, negative: -8, neutral: 22, positive: 6 },
    { year: 2006, negative: -15, neutral: 25, positive: 4 },
    { year: 2007, negative: -3, neutral: 18, positive: 12 },
    { year: 2008, negative: -6, neutral: 20, positive: 15 },
    { year: 2009, negative: -10, neutral: 22, positive: 8 },
    { year: 2010, negative: -8, neutral: 19, positive: 10 },
    { year: 2011, negative: -2, neutral: 21, positive: 18 },
  ],
  extended: [
    { year: 2003, negative: -10, neutral: 20, positive: 4 },
    { year: 2004, negative: -18, neutral: 20, positive: 6 },
    { year: 2005, negative: -4, neutral: 20, positive: 4 },
    { year: 2006, negative: -10, neutral: 20, positive: 6 },
    { year: 2007, negative: -8, neutral: 20, positive: 8 },
    { year: 2008, negative: -4, neutral: 20, positive: 10 },
    { year: 2009, negative: -2, neutral: 20, positive: 12 },
    { year: 2010, negative: -12, neutral: 20, positive: 8 },
    { year: 2011, negative: -4, neutral: 20, positive: 14 },
    { year: 2012, negative: -6, neutral: 18, positive: 16 },
    { year: 2013, negative: -3, neutral: 22, positive: 12 },
    { year: 2014, negative: -8, neutral: 24, positive: 10 },
  ],
  reduced: [
    { year: 2005, negative: -4, neutral: 20, positive: 4 },
    { year: 2007, negative: -8, neutral: 20, positive: 8 },
    { year: 2009, negative: -2, neutral: 20, positive: 12 },
    { year: 2011, negative: -4, neutral: 20, positive: 14 },
  ],
};

// Get current data based on selection
const data = $derived(datasets[currentDataset]);

// Random data generator for demo
function generateRandomData() {
  const years = [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011];
  return years.map((year) => ({
    year,
    negative: -Math.floor(Math.random() * 20),
    neutral: Math.floor(Math.random() * 10) + 15,
    positive: Math.floor(Math.random() * 15) + 2,
  }));
}

// Update with random data
function randomizeData() {
  datasets.random = generateRandomData();
  currentDataset = "random";
}
</script>

<div class="flex h-screen flex-col bg-gray-50">
  <!-- Header -->
  <header class="border-b bg-white px-6 py-4">
    <h1 class="text-2xl font-bold text-gray-800">Animated Stacked Bar Chart</h1>
    <p class="mt-1 text-sm text-gray-600">
      D3 + Svelte hybrid approach with smooth enter/update/exit animations
    </p>
  </header>

  <!-- Controls -->
  <div class="border-b bg-white px-6 py-4">
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-sm font-medium text-gray-700">Data Controls:</span>

      <button
        onclick={() => (currentDataset = "original")}
        class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {currentDataset === 'original'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
      >
        Original Data
      </button>

      <button
        onclick={() => (currentDataset = "updated")}
        class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {currentDataset === 'updated'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
      >
        Update Values
      </button>

      <button
        onclick={() => (currentDataset = "extended")}
        class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {currentDataset === 'extended'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
      >
        Add Years
      </button>

      <button
        onclick={() => (currentDataset = "reduced")}
        class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {currentDataset === 'reduced'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
      >
        Remove Years
      </button>

      <button
        onclick={randomizeData}
        class="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
      >
        Randomize
      </button>

      <div class="ml-auto text-sm text-gray-600">
        Showing {data.length} years
      </div>
    </div>
  </div>

  <!-- Main content -->
  <main class="flex-1 p-6">
    <div class="mx-auto h-full max-w-6xl">
      <div class="h-full rounded-lg bg-white p-6 shadow-sm">
        <Figure>
          <StackedBar
            {data}
            keys={["negative", "neutral", "positive"]}
            margin={{ top: 40, right: 40, bottom: 60, left: 60 }}
            colors={{
              negative: "hsla(211, 100%, 50%, 1)", // Bright blue
              neutral: "hsla(0, 0%, 85%, 1)", // Light gray
              positive: "hsla(145, 63%, 42%, 1)", // Green
            }}
            hoverColors={{
              negative: "hsla(211, 100%, 40%, 1)",
              neutral: "hsla(0, 0%, 75%, 1)",
              positive: "hsla(145, 63%, 32%, 1)",
            }}
            chartBackgroundColor="hsla(0, 0%, 98%, 1)"
            gridLineColor="hsla(0, 0%, 90%, 1)"
            showYGridlines={true}
            showXGridlines={false}
            showChartBorder={true}
            barPadding={0.1}
            yTickCount={6}
            animationDuration={750}
            animationDelay={30}
          />

          {#snippet figcaption()}
            <p>
              Stacked bar chart showing negative, neutral, and positive values. Try the buttons
              above to see smooth animations!
            </p>
          {/snippet}
        </Figure>
      </div>
    </div>
  </main>
</div>
