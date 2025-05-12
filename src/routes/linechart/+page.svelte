<script>
// @ts-nocheck

import * as d3 from "d3";
let data = [
  { date: "2007-01-01T00:00:00.000Z", close: 25410.070000000007 },
  { date: "2008-01-01T00:00:00.000Z", close: 36186.08 },
  { date: "2009-01-01T00:00:00.000Z", close: 37717.88000000002 },
  { date: "2010-01-01T00:00:00.000Z", close: 66885.14 },
  { date: "2011-01-01T00:00:00.000Z", close: 91729.19000000003 },
  { date: "2012-01-01T00:00:00.000Z", close: 43930.33999999998 },
];
// Use $props rune for component props
let {
  width = 1400,
  height = 800,
  margin = { top: 20, right: 30, bottom: 50, left: 80 },
} = $props();

// State variables
let activePoint = $state(null);
let tooltipX = $state(0);
let tooltipY = $state(0);

// Current brush selection (in date values)
let brushSelection = $state(null);

// References to DOM elements
let brushGroupEl = $state(null);
let chartEl = $state(null);

// Format data with $derived (replaces $: from Svelte 4)
const formattedData = $derived(
  data.map((d) => ({
    date: new Date(d.date),
    year: new Date(d.date).getFullYear(),
    close: +d.close,
  }))
);

// Calculate chart dimensions
const innerWidth = $derived(width - margin.left - margin.right);
const innerHeight = $derived(height - margin.top - margin.bottom);

// Create scales using D3
const xScale = $derived(
  d3
    .scaleTime()
    .domain(d3.extent(formattedData, (d) => d.date))
    .range([0, innerWidth])
);

const yScale = $derived(
  d3
    .scaleLinear()
    .domain([0, d3.max(formattedData, (d) => d.close) * 1.1])
    .range([innerHeight, 0])
);

// Generate path data
const linePath = $derived(
  d3
    .line()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.close))
    .curve(d3.curveMonotoneX)(formattedData)
);

// Generate tick values for axes
const xTicks = $derived(xScale.ticks(formattedData.length));
const yTicks = $derived(yScale.ticks(5));

// Configure time interval for brush snapping (12 hour intervals)
const interval = $derived(d3.timeMonth.every(1));

// Format currency
function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date for display
function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
  }).format(date);
}

// Handle mouse events for tooltips
function showTooltip(event, point) {
  activePoint = point;
  tooltipX = event.clientX + 10;
  tooltipY = event.clientY - 10;
}

function hideTooltip() {
  activePoint = null;
}

// Initialize and manage the D3 brush
// Replace your $effect brush implementation with this improved version
// Improved brush implementation with closest-year snapping
$effect(() => {
  if (!brushGroupEl) return;

  // Create D3 selection for brush group
  const brushGroup = d3.select(brushGroupEl);

  // Use timeYear for yearly data
  const yearInterval = d3.timeYear;

  // Helper function to snap a date to the closest year boundary
  function snapToClosestYear(date) {
    // Get the year boundaries before and after this date
    const floorDate = yearInterval.floor(date);
    const ceilDate = yearInterval.ceil(date);

    // If floor and ceil are the same, return that date
    if (floorDate.getTime() === ceilDate.getTime()) return floorDate;

    // Calculate the distances to each boundary
    const distToFloor = date.getTime() - floorDate.getTime();
    const distToCeil = ceilDate.getTime() - date.getTime();

    // Return the closest boundary
    return distToFloor < distToCeil ? floorDate : ceilDate;
  }

  // Define a move handler function for real-time feedback
  function brushMoved(event) {
    // Skip programmatic events
    if (event.sourceEvent && event.sourceEvent.type === "brush") return;

    if (!event.selection) {
      brushSelection = null;
      return;
    }

    // Convert pixel coordinates to dates without snapping during move
    const [x0, x1] = event.selection;
    const d0 = xScale.invert(x0);
    const d1 = xScale.invert(x1);

    // Update the brush selection state with raw values during brushing
    brushSelection = [d0, d1];
  }

  // Define the end handler with snapping to closest year
  function brushEnded(event) {
    // Skip if not from user interaction
    if (!event.sourceEvent) return;

    if (!event.selection) {
      brushSelection = null;
      return;
    }

    // Convert pixel coordinates to dates
    const [x0, x1] = event.selection;
    let d0 = xScale.invert(x0);
    let d1 = xScale.invert(x1);

    // Snap each edge to the closest year boundary
    d0 = snapToClosestYear(d0);
    d1 = snapToClosestYear(d1);

    // Ensure we don't have an empty selection by enforcing a minimum span
    if (d0.getTime() === d1.getTime()) {
      d1 = yearInterval.offset(d0, 1);
    }

    // Update reactive state with snapped date values
    brushSelection = [d0, d1];

    // Apply snapping animation
    brushGroup
      .transition()
      .duration(200)
      .call(brush.move, [xScale(d0), xScale(d1)]);
  }

  // Define the brush behavior
  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .on("brush", brushMoved)
    .on("end", brushEnded);

  // Apply brush to the group
  brushGroup.call(brush);

  // Clear brush when component unmounts
  return () => {
    brushGroup.on(".brush", null);
  };
});

// Also optimize the filteredData derived value to avoid unnecessary calculations
const filteredData = $derived(() => {
  // If no selection, return all data
  if (!brushSelection) return formattedData;

  // Cache the boundary dates to avoid repeated access
  const [startDate, endDate] = brushSelection;

  // Use faster array method for better performance
  return formattedData.filter((d) => d.date >= startDate && d.date <= endDate);
});

// For debugging without causing infinite loops
// Replace $inspect(filteredData()) with this:
$effect(() => {
  // Only log when brushSelection changes
  if (brushSelection) {
    console.log("Filtered data length:", filteredData.length);
    console.log("Selection:", formatDate(brushSelection[0]), "-", formatDate(brushSelection[1]));
  }
});

// Clear brush on button click
function clearBrush() {
  if (brushGroupEl) {
    const brushGroup = d3.select(brushGroupEl);
    brushGroup.call(d3.brushX().move, null);
    brushSelection = null;
  }
}
</script>

<div class="chart-container">
  <h2>Yearly Closing Values (2007-2012)</h2>

  <!-- Render brush selection info if active -->
  {#if brushSelection}
    <div class="brush-info">
      <p>Selected Range: {formatDate(brushSelection[0])} - {formatDate(brushSelection[1])}</p>
      <button onclick={clearBrush} class="clear-brush-btn">Clear Selection</button>
    </div>
  {/if}

  <svg {width} {height}>
    <!-- Chart area with margin -->
    <g transform={`translate(${margin.left},${margin.top})`} bind:this={chartEl}>
      <!-- Y-axis grid lines -->
      {#each yTicks as tick}
        <line x1={0} y1={yScale(tick)} x2={innerWidth} y2={yScale(tick)} class="grid-line" />
      {/each}

      <!-- X-axis -->
      <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} class="axis" />

      <!-- X-axis ticks and labels -->
      {#each formattedData as point}
        <g transform={`translate(${xScale(point.date)},${innerHeight})`}>
          <line y2="6" class="tick" />
          <text y="20" text-anchor="middle" class="tick-label">
            {point.year}
          </text>
        </g>
      {/each}

      <!-- X-axis label -->
      <text x={innerWidth / 2} y={innerHeight + 40} text-anchor="middle" class="axis-label">
        Year
      </text>

      <!-- Y-axis -->
      <line x1={0} y1={0} x2={0} y2={innerHeight} class="axis" />

      <!-- Y-axis ticks and labels -->
      {#each yTicks as tick}
        <g transform={`translate(0,${yScale(tick)})`}>
          <line x2="-6" class="tick" />
          <text x="-10" text-anchor="end" dominant-baseline="middle" class="tick-label">
            {formatCurrency(tick)}
          </text>
        </g>
      {/each}

      <!-- Y-axis label -->
      <text
        transform={`translate(${-margin.left + 12},${innerHeight / 2}) rotate(-90)`}
        text-anchor="middle"
        class="axis-label"
      >
        Closing Value
      </text>

      <!-- Line path -->
      <path d={linePath} class="line" />

      <!-- Data points -->
      {#each formattedData as point}
        <circle
          cx={xScale(point.date)}
          cy={yScale(point.close)}
          r="6"
          class={brushSelection &&
          (point.date < brushSelection[0] || point.date > brushSelection[1])
            ? "data-point data-point-inactive"
            : "data-point"}
          onmouseenter={(e) => showTooltip(e, point)}
          onmouseleave={hideTooltip}
        />
      {/each}

      <!-- D3 Brush container - Svelte binds this element so D3 can use it -->
      <g class="brush-group" bind:this={brushGroupEl}></g>
    </g>
  </svg>

  <!-- Tooltip -->
  {#if activePoint}
    <div class="tooltip" style={`left: ${tooltipX}px; top: ${tooltipY}px;`}>
      <div><strong>Year:</strong> {activePoint.year}</div>
      <div><strong>Value:</strong> {formatCurrency(activePoint.close)}</div>
    </div>
  {/if}

  <!-- Optional: Show statistics for the current selection -->
  {#if brushSelection}
    <div class="selection-stats">
      <h3>Selection Statistics</h3>
      <p>
        Average: {formatCurrency(d3.mean(filteredData(), (d) => d.close))}
      </p>
      <p>
        Min: {formatCurrency(d3.min(filteredData(), (d) => d.close))}
      </p>
      <p>
        Max: {formatCurrency(d3.max(filteredData(), (d) => d.close))}
      </p>
    </div>
  {/if}
</div>

<style>
.chart-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  position: relative;
  max-width: 100%;
  margin: 0 auto;
}

h2,
h3 {
  text-align: center;
  color: #333;
  margin-bottom: 1rem;
}

svg {
  max-width: 100%;
  display: block;
}

.grid-line {
  stroke: #eee;
  stroke-width: 1;
}

.axis {
  stroke: #333;
  stroke-width: 1.5;
}

.tick {
  stroke: #333;
  stroke-width: 1.5;
}

.tick-label {
  font-size: 12px;
  fill: #555;
}

.axis-label {
  font-size: 14px;
  font-weight: bold;
  fill: #333;
}

.line {
  fill: none;
  stroke: #8884d8;
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.data-point {
  fill: #8884d8;
  stroke: white;
  stroke-width: 2;
  cursor: pointer;
  transition: all 0.3s ease;
}

.data-point-inactive {
  fill: #ccc;
  opacity: 0.5;
}

.data-point:hover {
  r: 8;
}

.tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  pointer-events: none;
  z-index: 100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.brush-info {
  text-align: center;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.clear-brush-btn {
  background-color: #8884d8;
  color: white;
  border: none;
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.clear-brush-btn:hover {
  background-color: #7672c0;
}

.selection-stats {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* D3 brush styles */
:global(.brush-group .selection) {
  fill: #8884d8;
  fill-opacity: 0.2;
  stroke: #8884d8;
  stroke-width: 1;
}

:global(.brush-group .handle) {
  fill: #555;
  stroke: #fff;
  stroke-width: 1;
  cursor: ew-resize;
}
</style>
