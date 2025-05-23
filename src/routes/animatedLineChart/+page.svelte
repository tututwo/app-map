<script>
import LineChart from "$components/lineChartBrush/lineChartAnimated.svelte";
import Figure from "$components/Figure.svelte";

// Sample datasets
const dataset1 = [
  { date: "2001-01-01T00:00:00.000Z", close: 70 },
  { date: "2003-01-01T00:00:00.000Z", close: 40 },
  { date: "2005-01-01T00:00:00.000Z", close: 120 },
  { date: "2007-01-01T00:00:00.000Z", close: 40 },
  { date: "2009-01-01T00:00:00.000Z", close: 30 },
  { date: "2011-01-01T00:00:00.000Z", close: 50 },
  { date: "2013-01-01T00:00:00.000Z", close: 20 },
  { date: "2015-01-01T00:00:00.000Z", close: 90 },
  { date: "2017-01-01T00:00:00.000Z", close: 120 },
  { date: "2019-01-01T00:00:00.000Z", close: 110 },
  { date: "2021-01-01T00:00:00.000Z", close: 80 },
  { date: "2023-01-01T00:00:00.000Z", close: 40 },
  { date: "2025-01-01T00:00:00.000Z", close: 20 },
];

const dataset2 = [
  { date: "2001-01-01T00:00:00.000Z", close: 30 },
  { date: "2003-01-01T00:00:00.000Z", close: 80 },
  { date: "2005-01-01T00:00:00.000Z", close: 60 },
  { date: "2007-01-01T00:00:00.000Z", close: 90 },
  { date: "2009-01-01T00:00:00.000Z", close: 70 },
  { date: "2011-01-01T00:00:00.000Z", close: 100 },
  { date: "2013-01-01T00:00:00.000Z", close: 85 },
  { date: "2015-01-01T00:00:00.000Z", close: 45 },
  { date: "2017-01-01T00:00:00.000Z", close: 65 },
  { date: "2019-01-01T00:00:00.000Z", close: 55 },
  { date: "2021-01-01T00:00:00.000Z", close: 95 },
  { date: "2023-01-01T00:00:00.000Z", close: 75 },
  { date: "2025-01-01T00:00:00.000Z", close: 50 },
];

// Filtered dataset (2010-2020)
const dataset3 = [
  { date: "2011-01-01T00:00:00.000Z", close: 50 },
  { date: "2013-01-01T00:00:00.000Z", close: 20 },
  { date: "2015-01-01T00:00:00.000Z", close: 90 },
  { date: "2017-01-01T00:00:00.000Z", close: 120 },
  { date: "2019-01-01T00:00:00.000Z", close: 110 },
];

let currentDataset = $state(dataset1);
let datasetName = $state("Dataset 1");
let isAnimating = $state(false);

function switchToDataset1() {
  if (!isAnimating) {
    currentDataset = dataset1;
    datasetName = "Dataset 1";
  }
}

function switchToDataset2() {
  if (!isAnimating) {
    currentDataset = dataset2;
    datasetName = "Dataset 2";
  }
}

function switchToFiltered() {
  if (!isAnimating) {
    currentDataset = dataset3;
    datasetName = "Filtered (2010-2020)";
  }
}

function randomizeValues() {
  if (!isAnimating) {
    currentDataset = currentDataset.map((d) => ({
      ...d,
      close: Math.floor(Math.random() * 100) + 20,
    }));
    datasetName = "Randomized Values";
  }
}

// Animation settings
let animationDuration = $state(1);
let animationEase = $state("power2.inOut");
let staggerDelay = $state(0.02);
</script>

<div class="p-8">
  <h1 class="mb-4 text-2xl font-bold">Animated Line Chart Demo</h1>

  <div class="mb-6 space-x-4">
    <button
      onclick={switchToDataset1}
      class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
      disabled={isAnimating}
    >
      Dataset 1
    </button>
    <button
      onclick={switchToDataset2}
      class="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
      disabled={isAnimating}
    >
      Dataset 2
    </button>
    <button
      onclick={switchToFiltered}
      class="rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50"
      disabled={isAnimating}
    >
      Filtered (2010-2020)
    </button>
    <button
      onclick={randomizeValues}
      class="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50"
      disabled={isAnimating}
    >
      Randomize Values
    </button>
  </div>

  <p class="mb-4 text-gray-600">
    Current: {datasetName}
    {#if isAnimating}
      <span class="ml-2 text-sm text-blue-500">(Animating...)</span>
    {/if}
  </p>

  <div class="h-96 w-full border border-gray-200">
    <Figure>
      <LineChart
        data={currentDataset}
        chartBackgroundColor="white"
        enableBrushing={false}
        xTickPosition="bottom"
        yTickPosition="left"
        showChartBorder={true}
        showXGridlines={true}
        showYGridlines={true}
        gridLineColor="hsla(0, 0%, 80%, 1)"
        yTickCount={3}
        circleRadius={5}
        circleHoverRadius={8}
        lineColor="hsla(0, 0%, 20%, 1)"
        circleColor="hsla(0, 0%, 20%, 1)"
        circleHoverColor="hsla(0, 0%, 10%, 1)"
        margin={{ top: 40, right: 40, bottom: 50, left: 50 }}
        enableAnimation={true}
        {animationDuration}
        {animationEase}
        {staggerDelay}
        onAnimationStart={() => (isAnimating = true)}
        onAnimationComplete={() => (isAnimating = false)}
      />
      {#snippet figcaption()}
        Animated line chart demonstrating smooth transitions between datasets.
      {/snippet}
    </Figure>
  </div>

  <!-- Animation Controls -->
  <div class="mt-6 space-y-4 border-t pt-4">
    <h3 class="text-lg font-semibold">Animation Settings</h3>

    <div class="flex items-center space-x-4">
      <label class="w-32">Duration:</label>
      <input
        type="range"
        bind:value={animationDuration}
        min="0.3"
        max="3"
        step="0.1"
        class="w-64"
      />
      <span class="text-sm text-gray-600">{animationDuration}s</span>
    </div>

    <div class="flex items-center space-x-4">
      <label class="w-32">Stagger Delay:</label>
      <input type="range" bind:value={staggerDelay} min="0" max="0.1" step="0.01" class="w-64" />
      <span class="text-sm text-gray-600">{staggerDelay}s</span>
    </div>

    <div class="flex items-center space-x-4">
      <label class="w-32">Easing:</label>
      <select bind:value={animationEase} class="rounded border px-3 py-1">
        <option value="power2.inOut">Power2 InOut</option>
        <option value="power3.inOut">Power3 InOut</option>
        <option value="elastic.out">Elastic Out</option>
        <option value="bounce.out">Bounce Out</option>
        <option value="linear">Linear</option>
      </select>
    </div>
  </div>
</div>
