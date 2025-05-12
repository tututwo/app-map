<script>
// @ts-nocheck

import * as d3 from "d3";
import { untrack } from "svelte";
import { fly, scale } from "svelte/transition";
import { elasticOut } from "svelte/easing";
import { Button } from "bits-ui";

// Data points
let data = [
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

// Use $props rune for component props
let {
  width = 1400,
  height = 800,
  margin = { top: 50, right: 30, bottom: 80, left: 80 },
} = $props();

// State variables
let activePoint = $state(null);
let tooltipX = $state(0);
let tooltipY = $state(0);

// Current brush selection (in date values)
let brushSelection = $state([
  new Date("2003-01-01T00:00:00.000Z"),
  new Date("2011-01-01T00:00:00.000Z"),
]);

// Calculated pixel positions for the brushed area
let brushPixelPositions = $state({
  left: 0,
  right: 0,
  width: 0,
});

// References to DOM elements
let brushGroupEl = $state(null);
let chartEl = $state(null);
let svgContainer = $state(null);

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
    .y((d) => yScale(d.close))(formattedData)
);

// Generate tick values for axes
const xTicks = $derived(xScale.ticks(13)); // Ensure we have a tick for each year
const yTicks = $derived(yScale.ticks(5));

// Format date for display
function formatDate(date) {
  return date.getFullYear().toString();
}

// Format value (simple number)
function formatValue(value) {
  return value.toString();
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

// Create debounce function to limit update frequency
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Memoize the brush functionality
let brush;
let brushGroup;

// Update brush pixel positions for animation
function updateBrushPixelPositions() {
  if (brushSelection && svgContainer) {
    const leftPos = xScale(brushSelection[0]);
    const rightPos = xScale(brushSelection[1]);

    const svgRect = svgContainer.getBoundingClientRect();

    brushPixelPositions = {
      left: leftPos + margin.left,
      right: rightPos + margin.left,
      width: rightPos - leftPos,
      svgLeft: svgRect.left,
      svgTop: svgRect.top,
    };
  }
}

// Improved brush implementation with performance optimization
$effect(() => {
  if (!brushGroupEl) return;

  if (!brush) {
    const yearInterval = d3.timeYear;

    function snapToClosestYear(date) {
      const floorDate = yearInterval.floor(date);
      const ceilDate = yearInterval.ceil(date);
      if (floorDate.getTime() === ceilDate.getTime()) return floorDate;
      const distToFloor = date.getTime() - floorDate.getTime();
      const distToCeil = ceilDate.getTime() - date.getTime();
      return distToFloor < distToCeil ? floorDate : ceilDate;
    }

    const debouncedBrushMove = debounce((selection) => {
      if (!selection) {
        brushSelection = null;
        return;
      }
      const [x0, x1] = selection;
      const d0 = xScale.invert(x0);
      const d1 = xScale.invert(x1);
      brushSelection = [d0, d1];
      updateBrushPixelPositions();
    }, 50);

    function brushEnded(event) {
      if (!event.sourceEvent) return;
      if (!event.selection) {
        brushSelection = null;
        return;
      }
      const [x0, x1] = event.selection;
      let d0 = xScale.invert(x0);
      let d1 = xScale.invert(x1);
      d0 = snapToClosestYear(d0);
      d1 = snapToClosestYear(d1);
      if (d0.getTime() === d1.getTime()) {
        d1 = yearInterval.offset(d0, 1);
      }
      untrack(() => {
        brushSelection = [d0, d1];
        updateBrushPixelPositions();
      });
      brushGroup
        .transition()
        .duration(200)
        .call(brush.move, [xScale(d0), xScale(d1)]);
    }

    brush = d3
      .brushX()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on("brush", (event) => {
        if (event.sourceEvent && event.sourceEvent.type === "brush") return;
        if (event.selection) {
          const [x0, x1] = event.selection;
          brushPixelPositions = {
            left: x0 + margin.left,
            right: x1 + margin.left,
            width: x1 - x0,
            svgLeft: svgContainer?.getBoundingClientRect().left || 0,
            svgTop: svgContainer?.getBoundingClientRect().top || 0,
          };
        }
        debouncedBrushMove(event.selection);
      })
      .on("end", brushEnded);
  }

  brushGroup = d3.select(brushGroupEl);
  brushGroup.call(brush);

  if (brushSelection) {
    untrack(() => {
      brushGroup.call(brush.move, [xScale(brushSelection[0]), xScale(brushSelection[1])]);
      updateBrushPixelPositions();
    });
  }

  return () => {
    brushGroup.on(".brush", null);
  };
});

$effect(() => {
  if (chartEl && brushSelection && svgContainer) {
    updateBrushPixelPositions();
    const handleResize = () => updateBrushPixelPositions();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }
});

const filteredData = $derived(() => {
  if (!brushSelection) return formattedData;
  const [startDate, endDate] = brushSelection;
  return formattedData.filter((d) => {
    return d.date >= startDate && d.date <= endDate;
  });
});

function clearBrush() {
  if (brushGroupEl && brush) {
    brushGroup.call(brush.move, null);
    brushSelection = null;
  }
}

function animateYearPill(node, { duration = 300 }) {
  return {
    duration,
    css: (t) => {
      const eased = elasticOut(t);
      return `transform: scale(${0.8 + 0.2 * eased}); opacity: ${t};`;
    },
  };
}
</script>

<div class="mx-auto max-w-7xl rounded-lg bg-white px-4 py-8 shadow-sm sm:px-6 lg:px-8">
  <header class="mb-8">
    <h1 class="mb-1 text-2xl font-medium text-gray-900">
      Number of <span class="font-bold">closed churches</span> in
      <span class="font-bold">all locations</span> over time
    </h1>
    <p class="text-right text-sm text-gray-500">Data source: research center data port</p>
  </header>

  <div class="relative" bind:this={svgContainer}>
    <svg {width} {height} class="h-auto w-full">
      <!-- Chart area with margin -->
      <g transform={`translate(${margin.left},${margin.top})`} bind:this={chartEl}>
        <!-- Background color -->
        <rect x={0} y={0} width={innerWidth} height={innerHeight} class="fill-blue-50/30" />

        <!-- X-axis grid lines -->
        <g class="x-grid grid">
          {#each xTicks as tick}
            <line
              x1={xScale(tick)}
              y1={0}
              x2={xScale(tick)}
              y2={innerHeight}
              class="stroke-gray-200"
              stroke-width="1"
            />
          {/each}
        </g>

        <!-- Y-axis grid lines -->
        <g class="y-grid grid">
          {#each yTicks as tick}
            <line
              x1={0}
              y1={yScale(tick)}
              x2={innerWidth}
              y2={yScale(tick)}
              class="stroke-gray-200"
              stroke-width="1"
            />
          {/each}
        </g>

        <!-- Gray background for the brushed area -->
        {#if brushSelection}
          <rect
            x={brushPixelPositions.left - margin.left}
            y={0}
            width={brushPixelPositions.width}
            height={innerHeight}
            class="fill-gray-300/0"
            transition:scale={{
              duration: 150,
              opacity: 0.1,
              start: 0.95,
              easing: elasticOut,
            }}
          />
        {/if}

        <!-- X-axis -->
        <line
          x1={0}
          y1={innerHeight}
          x2={innerWidth}
          y2={innerHeight}
          class="stroke-gray-300"
          stroke-width="1"
        />

        <!-- X-axis ticks and labels -->
        {#each formattedData as point}
          <g transform={`translate(${xScale(point.date)},${innerHeight})`}>
            <line y2="6" class="stroke-gray-400" />
            <text y="20" text-anchor="middle" class="fill-gray-600 text-xs">
              {point.year}
            </text>
          </g>
        {/each}

        <!-- Y-axis -->
        <line x1={0} y1={0} x2={0} y2={innerHeight} class="stroke-gray-300" stroke-width="1" />

        <!-- Y-axis ticks and labels -->
        {#each yTicks as tick}
          <g transform={`translate(0,${yScale(tick)})`}>
            <line x2="-6" class="stroke-gray-400" />
            <text
              x="-10"
              text-anchor="end"
              dominant-baseline="middle"
              class="fill-gray-600 text-xs"
            >
              {tick}
            </text>
          </g>
        {/each}

        <!-- Line path -->
        <path
          d={linePath}
          class="fill-none stroke-blue-600 stroke-2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Data points -->
        {#each formattedData as point}
          <circle
            cx={xScale(point.date)}
            cy={yScale(point.close)}
            r="5"
            class={brushSelection &&
            (point.date < brushSelection[0] || point.date > brushSelection[1])
              ? "cursor-pointer fill-blue-300/70 stroke-white stroke-[1.5px] transition-all duration-300 ease-in-out"
              : "cursor-pointer fill-blue-600 stroke-white stroke-[1.5px] transition-all duration-300 ease-in-out"}
            onmouseenter={(e) => showTooltip(e, point)}
            onmouseleave={hideTooltip}
          />
        {/each}

        <!-- D3 Brush container -->
        <g class="brush-group" bind:this={brushGroupEl}></g>
      </g>
    </svg>

    <!-- Year range pills that match the design in the image (positioned at the bottom) -->
    {#if brushSelection && brushPixelPositions.width > 0}
      <div
        class="absolute z-10 -translate-x-1/2 transform rounded-md bg-emerald-500 px-2 py-1 text-xs text-white"
        style="left: {brushPixelPositions.left}px; top: {margin.top + innerHeight + 30}px;"
        transition:animateYearPill
      >
        from {formatDate(brushSelection[0])}
      </div>

      <div
        class="absolute z-10 -translate-x-1/2 transform rounded-md bg-emerald-500 px-2 py-1 text-xs text-white"
        style="left: {brushPixelPositions.right}px; top: {margin.top + innerHeight + 30}px;"
        transition:animateYearPill
      >
        to {formatDate(brushSelection[1])}
      </div>

      <div
        class="absolute z-10 text-xs font-medium text-emerald-500"
        style="left: {(brushPixelPositions.left + brushPixelPositions.right) /
          2}px; top: {margin.top + innerHeight + 10}px; transform: translateX(-50%);"
      >
        Selected year range
      </div>
    {/if}
  </div>

  <!-- Slide to select instructions -->
  {#if brushSelection}
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
  {/if}

  <!-- Tooltip -->
  {#if activePoint}
    <div
      class="pointer-events-none fixed z-50 rounded bg-gray-900 px-3 py-2 text-sm text-white shadow-lg"
      style={`left: ${tooltipX}px; top: ${tooltipY}px; animation: fadeIn 0.15s ease-in-out;`}
    >
      <div><strong>Year:</strong> {activePoint.year}</div>
      <div><strong>Value:</strong> {activePoint.close}</div>
    </div>
  {/if}
</div>

<style global>
/* D3 brush styles */
.brush-group .selection {
  fill: rgba(255, 255, 255, 0);
  stroke: #10b981; /* Emerald-500 for brush handles */
  stroke-width: 2;
}

.brush-group .handle {
  fill: #10b981; /* Emerald-500 */
  stroke: white;
  stroke-width: 1;
  cursor: ew-resize;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
