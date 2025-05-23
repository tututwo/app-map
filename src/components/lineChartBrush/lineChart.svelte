<script>
// @ts-nocheck
import * as d3 from "d3";
import { untrack, getContext } from "svelte";
import { scale } from "svelte/transition";
import { elasticOut } from "svelte/easing";

// Get responsive dimensions from Figure context
const figure = getContext("Figure");
const width = $derived(figure.getWidth());
const height = $derived(figure.getHeight());

// Component props
let {
  data,
  margin = { top: 50, right: 30, bottom: 80, left: 80 },
  initialBrushSelection = null,
  lineColor = "hsla(0, 0%, 53%, 1)",
  circleColor = "hsla(211, 99%, 21%, 1)",
  circleHoverColor = "hsla(211, 99%, 35%, 1)",
  circleRadius = 6,
  circleHoverRadius = 8,
  gridLineColor = "hsla(0, 0%, 80%, 1)",
  // New props for enhanced control
  xTickPosition = "top", // "top" | "bottom" | "both" | "none"
  yTickPosition = "left", // "left" | "right" | "both" | "none"
  showXGridlines = true,
  showYGridlines = true,
  showChartBorder = true,
  xTickCount = null, // null = auto, or specific number
  yTickCount = 5,
  tickLength = 6,
  tickOffset = 20,
} = $props();

// State variables
let activePoint = $state(null);
let hoveredPoint = $state(null);

// Current brush selection (in date values)
let brushSelection = $state(initialBrushSelection);

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

// Format data with $derived
const formattedData = $derived(
  data.map((d) => ({
    date: new Date(d.date),
    year: new Date(d.date).getFullYear(),
    close: +d.close,
  }))
);

// Calculate chart dimensions - now responsive!
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
const xTicks = $derived(
  xTickCount ? xScale.ticks(xTickCount) : xScale.ticks(Math.min(formattedData.length, 13))
);
const yTicks = $derived(yScale.ticks(yTickCount));

// Format functions
function formatDate(date) {
  return date.getFullYear().toString();
}

// Handle mouse events for tooltips and hover effects
function showTooltip(event, point) {
  activePoint = point;
  hoveredPoint = point;
}

function hideTooltip() {
  activePoint = null;
  hoveredPoint = null;
}

// Create debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Brush implementation
let brush;
let brushGroup;

// Update brush pixel positions for animation
function updateBrushPixelPositions() {
  if (brushSelection && svgContainer) {
    const leftPos = xScale(brushSelection[0]);
    const rightPos = xScale(brushSelection[1]);

    brushPixelPositions = {
      left: leftPos + margin.left,
      right: rightPos + margin.left,
      width: rightPos - leftPos,
    };
  }
}

// D3 Brush effect
$effect(() => {
  if (!brushGroupEl || !width || !height) return;

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
      .handleSize(8)
      .on("brush.move", (event) => {
        if (event.sourceEvent && event.sourceEvent.type === "brush") return;
        if (event.selection) {
          const [x0, x1] = event.selection;
          brushPixelPositions = {
            left: x0 + margin.left,
            right: x1 + margin.left,
            width: x1 - x0,
          };
        }
        debouncedBrushMove(event.selection);
      })
      .on("end", brushEnded);
  }

  brushGroup = d3.select(brushGroupEl);
  brushGroup.call(brush);

  // Style D3 brush elements
  brushGroup.select(".selection").attr("fill", "transparent").attr("stroke", "none");

  brushGroup.select(".overlay").attr("fill", "transparent");

  // Style brush handles
  brushGroup
    .selectAll(".handle")
    .attr("fill", "hsla(162, 100%, 38%, 1)")
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .attr("rx", 2); // Rounded corners

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

// Update positions on resize
$effect(() => {
  if (chartEl && brushSelection && svgContainer) {
    updateBrushPixelPositions();
  }
});

function animateYearPill(node, { duration = 300 }) {
  return {
    duration,
    css: (t) => {
      const eased = elasticOut(t);
      return `transform: scale(${0.8 + 0.2 * eased}); opacity: ${t};`;
    },
  };
}

// Helper function to determine if a point is outside the brush selection
function isPointOutsideSelection(point) {
  return brushSelection && (point.date < brushSelection[0] || point.date > brushSelection[1]);
}
</script>

<div class="relative h-full w-full" bind:this={svgContainer}>
  <svg {width} {height} class="h-full w-full">
    <!-- Chart area with margin -->
    <g transform={`translate(${margin.left},${margin.top})`} bind:this={chartEl}>
      <!-- Background color -->
      <rect x={0} y={0} width={innerWidth} height={innerHeight} class="fill-[#E9F6FF]" />

      <!-- White selection rectangle (Svelte-controlled for visual appearance) -->
      {#if brushSelection && brushPixelPositions.width > 0}
        <rect
          x={brushPixelPositions.left - margin.left}
          y={0}
          width={brushPixelPositions.width}
          height={innerHeight}
          class="fill-white"
          pointer-events="none"
          transition:scale={{
            duration: 150,
            start: 0.95,
            easing: elasticOut,
          }}
        />
      {/if}

      <!-- X-axis grid lines -->
      {#if showXGridlines}
        <g class="x-grid grid">
          {#each xTicks as tick}
            <line
              x1={xScale(tick)}
              y1={0}
              x2={xScale(tick)}
              y2={innerHeight}
              stroke={gridLineColor}
              stroke-width="1"
              opacity="0.5"
            />
          {/each}
        </g>
      {/if}

      <!-- Y-axis grid lines -->
      {#if showYGridlines}
        <g class="y-grid grid">
          {#each yTicks as tick}
            <line
              x1={0}
              y1={yScale(tick)}
              x2={innerWidth}
              y2={yScale(tick)}
              stroke={gridLineColor}
              stroke-width="1"
              opacity="0.5"
            />
          {/each}
        </g>
      {/if}

      <!-- Chart border (enclosing rectangle) -->
      {#if showChartBorder}
        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill="none"
          stroke={gridLineColor}
          stroke-width="1.5"
        />
      {/if}

      <!-- X-axis ticks and labels -->
      {#if xTickPosition !== "none"}
        <!-- Top ticks -->
        {#if xTickPosition === "top" || xTickPosition === "both"}
          <g class="x-axis-top">
            {#each formattedData as point}
              <g transform={`translate(${xScale(point.date)},0)`}>
                <line y1={0} y2={-tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  y={-tickOffset}
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="fill-gray-600 text-xs font-medium"
                >
                  {point.year}
                </text>
              </g>
            {/each}
          </g>
        {/if}

        <!-- Bottom ticks -->
        {#if xTickPosition === "bottom" || xTickPosition === "both"}
          <g class="x-axis-bottom">
            {#each formattedData as point}
              <g transform={`translate(${xScale(point.date)},${innerHeight})`}>
                <line y1={0} y2={tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  y={tickOffset}
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="fill-gray-600 text-xs font-medium"
                >
                  {point.year}
                </text>
              </g>
            {/each}
          </g>
        {/if}
      {/if}

      <!-- Y-axis ticks and labels -->
      {#if yTickPosition !== "none"}
        <!-- Left ticks -->
        {#if yTickPosition === "left" || yTickPosition === "both"}
          <g class="y-axis-left">
            {#each yTicks as tick}
              <g transform={`translate(0,${yScale(tick)})`}>
                <line x1={0} x2={-tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  x={-tickOffset}
                  text-anchor="end"
                  dominant-baseline="middle"
                  class="fill-gray-600 text-xs font-medium"
                >
                  {tick}
                </text>
              </g>
            {/each}
          </g>
        {/if}

        <!-- Right ticks -->
        {#if yTickPosition === "right" || yTickPosition === "both"}
          <g class="y-axis-right">
            {#each yTicks as tick}
              <g transform={`translate(${innerWidth},${yScale(tick)})`}>
                <line x1={0} x2={tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  x={tickOffset}
                  text-anchor="start"
                  dominant-baseline="middle"
                  class="fill-gray-600 text-xs font-medium"
                >
                  {tick}
                </text>
              </g>
            {/each}
          </g>
        {/if}
      {/if}

      <!-- Line path -->
      <path
        d={linePath}
        class="fill-none stroke-2"
        stroke={lineColor}
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- D3 Brush container (rendered before circles so circles are on top) -->
      <g class="brush-group" bind:this={brushGroupEl}></g>

      <!-- Data points (rendered after brush so they're on top) -->
      <g class="data-points" style="pointer-events: all;">
        {#each formattedData as point, i}
          <circle
            cx={xScale(point.date)}
            cy={yScale(point.close)}
            r={hoveredPoint === point ? circleHoverRadius : circleRadius}
            fill={isPointOutsideSelection(point)
              ? "hsla(211, 99%, 21%, 0.4)"
              : hoveredPoint === point
                ? circleHoverColor
                : circleColor}
            stroke="white"
            stroke-width="2"
            class="cursor-pointer transition-all duration-200 ease-out"
            style="filter: {hoveredPoint === point
              ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
              : 'none'};"
            role="button"
            tabindex="0"
            aria-label="Data point for {point.year}: {point.close}"
            onmouseenter={(e) => showTooltip(e, point)}
            onmouseleave={hideTooltip}
            onfocus={(e) => showTooltip(e, point)}
            onblur={hideTooltip}
          />
        {/each}
      </g>
    </g>
  </svg>

  <!-- Enhanced Tooltip -->
  {#if activePoint}
    <div
      class="pointer-events-none absolute z-50 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-xl"
      style="
        left: {xScale(activePoint.date) + margin.left - 30}px; 
        top: {yScale(activePoint.close) + margin.top - 60}px;
        transform: translateX(-50%);
      "
      transition:scale={{ duration: 150, start: 0.9 }}
    >
      <div class="font-medium">{activePoint.year}</div>
      <div class="text-gray-300">Value: {activePoint.close}</div>
      <!-- Tooltip arrow -->
      <div
        class="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-t-4 border-r-4 border-l-4 border-t-gray-900 border-r-transparent border-l-transparent"
      ></div>
    </div>
  {/if}

  <!-- Year range pills -->
  {#if brushSelection && brushPixelPositions.width > 0}
    <div
      class="absolute z-10 -translate-x-1/2 transform rounded-md bg-emerald-500 px-2 py-1 text-xs shadow-md"
      style="left: {brushPixelPositions.left}px; top: {margin.top + innerHeight + 20}px;"
      transition:animateYearPill
    >
      from <strong>{formatDate(brushSelection[0])}</strong>
    </div>

    <div
      class="absolute z-10 -translate-x-1/2 transform rounded-md bg-emerald-500 px-2 py-1 text-xs shadow-md"
      style="left: {brushPixelPositions.right}px; top: {margin.top + innerHeight + 20}px;"
      transition:animateYearPill
    >
      to <strong>{formatDate(brushSelection[1])}</strong>
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

<style>
/* Remove the global fadeIn animation since we're using Svelte transitions */
</style>
