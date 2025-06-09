<script>
import Figure from "$components/chart/Figure.svelte";
import LineChart from "$components/lineChartBrush/lineChart.svelte";

// Data points
const data = [
  { date: "2003-01-01T00:00:00.000Z", close: 0.15 },
  { date: "2004-01-01T00:00:00.000Z", close: 0.2 },
  { date: "2005-01-01T00:00:00.000Z", close: 0.33 },
  { date: "2006-01-01T00:00:00.000Z", close: 0.12 },
  { date: "2007-01-01T00:00:00.000Z", close: 0.08 },
  { date: "2008-01-01T00:00:00.000Z", close: 0.1 },
  { date: "2009-01-01T00:00:00.000Z", close: 0.06 },
  { date: "2010-01-01T00:00:00.000Z", close: 0.14 },
  { date: "2011-01-01T00:00:00.000Z", close: 0.16 },
];

// No need for brush selection since we're disabling brushing
</script>

<div class="mx-auto max-w-7xl rounded-lg bg-white px-4 py-8 shadow-sm sm:px-6 lg:px-8">
  <header class="mb-8">
    <h1 class="mb-1 text-2xl font-medium text-gray-900">Persistence</h1>
  </header>

  <!-- Chart container with responsive dimensions -->
  <div class="h-[300px] w-full">
    <Figure>
      <LineChart
        {data}
        chartBackgroundColor="white"
        enableBrushing={false}
        xTickPosition="bottom"
        yTickPosition="left"
        showChartBorder={true}
        showXGridlines={true}
        showYGridlines={true}
        gridLineColor="hsla(0, 0%, 80%, 1)"
        yTickCount={5}
        circleRadius={5}
        circleHoverRadius={8}
        lineColor="hsla(0, 0%, 20%, 1)"
        circleColor="hsla(0, 0%, 20%, 1)"
        circleHoverColor="hsla(0, 0%, 10%, 1)"
        margin={{ top: 40, right: 40, bottom: 50, left: 50 }}
      />

      {#snippet figcaption()}
        Persistence values over time from 2003 to 2011.
      {/snippet}
    </Figure>
  </div>
</div>
