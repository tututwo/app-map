<script>
import Figure from "$components/Figure.svelte";
import LineChart from "$components/lineChartBrush/lineChart.svelte";

// Data points
const data = [
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

const initialBrushSelection = [
  new Date("2003-01-01T00:00:00.000Z"),
  new Date("2011-01-01T00:00:00.000Z"),
];
</script>

<div class="mx-auto max-w-7xl rounded-lg bg-white px-4 py-8 shadow-sm sm:px-6 lg:px-8">
  <header class="mb-8">
    <h1 class="mb-1 text-2xl font-medium text-gray-900">
      Number of <span class="font-bold">closed churches</span> in
      <span class="font-bold">all locations</span> over time
    </h1>
    <p class="text-right text-sm text-gray-500">Data source: research center data port</p>
  </header>

  <!-- Chart container with responsive dimensions -->
  <div class="h-[500px] w-full">
    <Figure>
      <LineChart
        {data}
        {initialBrushSelection}
        xTickPosition="top"
        yTickPosition="left"
        showChartBorder={true}
        showXGridlines={true}
        showYGridlines={true}
        gridLineColor="hsla(0, 0%, 85%, 1)"
        yTickCount={5}
        circleRadius={10}
        circleHoverRadius={6}
        lineColor="hsla(0, 0%, 53%, 1)"
        circleColor="hsla(211, 98%, 21%, 1)"
        margin={{ top: 60, right: 40, bottom: 60, left: 60 }}
      />

      {#snippet figcaption()}
        This is a caption for the line chart showing church closures over time.
      {/snippet}
    </Figure>
  </div>

  <!-- Instructions -->
  <div class="mt-10 flex items-center justify-center gap-2 text-sm text-gray-600">
    <svg
      class="h-4 w-4 text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4L10.59 5.41L16.17 11H4V13H16.17L10.59 18.59L12 20L20 12L12 4Z"
        fill="currentColor"
      />
    </svg>
    <span>Slide to select year range</span>
  </div>
</div>
