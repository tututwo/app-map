<script>
import Figure from "$components/Figure.svelte";
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

<div class="dashboard-content">
  <!-- Your existing charts and demographics content -->
  <h2>Closed Churches in Fayette, Illinois (2003-2011)</h2>
  
  <!-- Line chart section -->
  <div class="chart-container">
      <!-- Your SVG charts go here -->
  </div>
  
  <!-- Demographics and other content -->
  <div class="demographics">
      <!-- Your demographics table -->
  </div>
</div>

<button onclick={exportToPDF}>Export PDF</button>