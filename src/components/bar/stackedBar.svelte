<script>
// @ts-nocheck
import * as d3 from "d3";
import { getContext, onMount } from "svelte";
import { fade } from "svelte/transition";

// Get responsive dimensions from Figure context
const figure = getContext("Figure");
const width = $derived(figure.getWidth());
const height = $derived(figure.getHeight());

// Component props
let {
  data,
  margin = { top: 40, right: 30, bottom: 50, left: 60 },
  // Stack configuration
  keys = ["negative", "neutral", "positive"], // Keys to stack
  // Color scheme
  colors = {
    negative: "hsla(211, 99%, 45%, 1)", // Blue for negative
    neutral: "hsla(0, 0%, 85%, 1)", // Gray for neutral
    positive: "hsla(145, 63%, 42%, 1)", // Green for positive
  },
  // Hover colors
  hoverColors = {
    negative: "hsla(211, 99%, 35%, 1)",
    neutral: "hsla(0, 0%, 75%, 1)",
    positive: "hsla(145, 63%, 32%, 1)",
  },
  // Grid and styling
  gridLineColor = "hsla(0, 0%, 90%, 1)",
  showXGridlines = false,
  showYGridlines = true,
  showChartBorder = true,
  chartBackgroundColor = "white",
  // Axis configuration
  xTickPosition = "bottom",
  yTickPosition = "left",
  yTickCount = 5,
  tickLength = 6,
  tickOffset = 10,
  // Bar configuration
  barPadding = 0.1,
  // Animation configuration
  animationDuration = 750,
  animationDelay = 50,
  // Tooltip configuration
  enableTooltip = true,
} = $props();

// State variables
let hoveredBar = $state(null);
let hoveredSegment = $state(null);
let barsContainer = $state(null);
let isFirstRender = $state(true);

// Calculate chart dimensions
const innerWidth = $derived(width - margin.left - margin.right);
const innerHeight = $derived(height - margin.top - margin.bottom);

// Process and prepare data for stacking
const processedData = $derived(() => {
  if (!data || !data.length) return [];

  return data.map((d) => {
    // Ensure we have all keys with numeric values
    const processed = {
      year: d.year || d.date,
      ...keys.reduce((acc, key) => {
        acc[key] = +d[key] || 0;
        return acc;
      }, {}),
    };

    // Calculate total for tooltip
    processed.total = keys.reduce((sum, key) => sum + processed[key], 0);

    return processed;
  });
});

// Create the stack generator
const stack = d3.stack().keys(keys).order(d3.stackOrderNone).offset(d3.stackOffsetDiverging); // This handles positive/negative stacking

// Generate stacked data
const stackedData = $derived(() => {
  const processed = processedData();
  if (!processed.length) return [];

  return stack(processed);
});

// Create scales
const xScale = $derived(
  d3
    .scaleBand()
    .domain(processedData().map((d) => d.year))
    .range([0, innerWidth])
    .padding(barPadding)
);

const yScale = $derived(() => {
  const stacked = stackedData();
  if (!stacked.length) return d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

  // Find the extent across all stacked values
  const minValue = d3.min(stacked, (series) => d3.min(series, (d) => d[0]));
  const maxValue = d3.max(stacked, (series) => d3.max(series, (d) => d[1]));

  // Add padding
  const range = maxValue - minValue;
  const padding = range * 0.1;

  return d3
    .scaleLinear()
    .domain([minValue - padding, maxValue + padding])
    .nice()
    .range([innerHeight, 0]);
});

// Get y position for zero line
const zeroY = $derived(yScale()(0));

// Generate tick values
const yTicks = $derived(yScale().ticks(yTickCount));

// Handle mouse events
function handleMouseEnter(series, segment) {
  hoveredBar = segment.data;
  hoveredSegment = {
    key: series.key,
    value: segment.data[series.key],
    y0: segment[0],
    y1: segment[1],
  };
}

function handleMouseLeave() {
  hoveredBar = null;
  hoveredSegment = null;
}

// Get color for segment
function getSegmentColor(seriesKey, isHovered) {
  const colorMap = isHovered ? hoverColors : colors;
  return colorMap[seriesKey] || colors.neutral;
}

// Animate bars using D3 transitions
$effect(() => {
  if (!barsContainer || !stackedData().length) return;

  const t = d3
    .transition()
    .duration(isFirstRender ? 0 : animationDuration)
    .ease(d3.easeCubicInOut);

  const barGroups = d3
    .select(barsContainer)
    .selectAll(".bar-group")
    .data(stackedData(), (d) => d.key);

  // Handle series groups
  barGroups.join(
    (enter) =>
      enter
        .append("g")
        .attr("class", "bar-group")
        .attr("data-series", (d) => d.key),
    (update) => update,
    (exit) => exit.transition(t).style("opacity", 0).remove()
  );

  // Handle individual bars within each series
  barGroups.each(function (series) {
    const seriesGroup = d3.select(this);

    const bars = seriesGroup.selectAll(".bar-segment").data(series, (d) => d.data.year);

    bars.join(
      (enter) => {
        const rect = enter
          .append("rect")
          .attr("class", "bar-segment")
          .attr("data-year", (d) => d.data.year)
          .attr("x", (d) => xScale(d.data.year))
          .attr("width", xScale.bandwidth())
          .attr("y", yScale()(0))
          .attr("height", 0)
          .attr("fill", getSegmentColor(series.key, false))
          .style("cursor", "pointer");

        // Add event listeners
        rect
          .on("mouseenter", (event, d) => handleMouseEnter(series, d))
          .on("mouseleave", handleMouseLeave);

        // Animate in with stagger
        rect
          .transition(t)
          .delay((d, i) => (isFirstRender ? i * animationDelay : 0))
          .attr("y", (d) => Math.min(yScale()(d[0]), yScale()(d[1])))
          .attr("height", (d) => Math.abs(yScale()(d[0]) - yScale()(d[1])));

        return rect;
      },
      (update) =>
        update
          .transition(t)
          .attr("x", (d) => xScale(d.data.year))
          .attr("width", xScale.bandwidth())
          .attr("y", (d) => Math.min(yScale()(d[0]), yScale()(d[1])))
          .attr("height", (d) => Math.abs(yScale()(d[0]) - yScale()(d[1])))
          .attr("fill", (d) =>
            getSegmentColor(series.key, hoveredBar === d.data && hoveredSegment?.key === series.key)
          ),
      // Inside the main animation $effect's .join()
      (exit) =>
        exit.transition(t).attr("y", yScale()(0)).attr("height", 0).style("opacity", 0).remove()
    );
  });

  // Mark first render as complete
  if (isFirstRender) {
    setTimeout(
      () => {
        isFirstRender = false;
      },
      animationDuration + processedData().length * animationDelay
    );
  }
});

// Update colors on hover (reactive)
$effect(() => {
  if (!barsContainer) return;

  d3.select(barsContainer)
    .selectAll(".bar-segment")
    .attr("fill", function () {
      const seriesKey = d3.select(this.parentNode).datum().key;
      const year = d3.select(this).datum().data.year;
      const isHovered = hoveredBar?.year === year && hoveredSegment?.key === seriesKey;
      return getSegmentColor(seriesKey, isHovered);
    });
});

// Handle resize animations
let previousWidth = 0;
let previousHeight = 0;

$effect(() => {
  if (!barsContainer || !width || !height) return;

  // Only animate if dimensions actually changed
  if (previousWidth !== width || previousHeight !== height) {
    previousWidth = width;
    previousHeight = height;

    const t = d3.transition().duration(300).ease(d3.easeCubicOut);

    // Instead of selecting all segments at once, select the groups first
    d3.select(barsContainer)
      .selectAll(".bar-group") // Select the series group
      .each(function (series) {
        // Get the series data
        d3.select(this)
          .selectAll(".bar-segment") // Now select the bars within this group
          .transition(t)
          .attr("x", (d) => xScale(d.data.year))
          .attr("width", xScale.bandwidth())
          // Now we don't need to find the parent, because we already have `series`
          .attr("y", (d) => Math.min(yScale()(d[0]), yScale()(d[1])))
          .attr("height", (d) => Math.abs(yScale()(d[0]) - yScale()(d[1])));
      });
  }
});
</script>

<div class="relative h-full w-full">
  <svg {width} {height} class="h-full w-full">
    <!-- Chart area with margin -->
    <g transform={`translate(${margin.left},${margin.top})`}>
      <!-- Background -->
      <rect x={0} y={0} width={innerWidth} height={innerHeight} fill={chartBackgroundColor} />

      <!-- Y-axis grid lines -->
      {#if showYGridlines}
        <g class="y-grid">
          {#each yTicks as tick}
            <line
              x1={0}
              y1={yScale()(tick)}
              x2={innerWidth}
              y2={yScale()(tick)}
              stroke={gridLineColor}
              stroke-width="1"
              shape-rendering="crispEdges"
            />
          {/each}
        </g>
      {/if}

      <!-- Zero line (emphasized) -->
      <line
        x1={0}
        y1={zeroY}
        x2={innerWidth}
        y2={zeroY}
        stroke="hsla(0, 0%, 60%, 1)"
        stroke-width="2"
        shape-rendering="crispEdges"
      />

      <!-- X-axis grid lines -->
      {#if showXGridlines}
        <g class="x-grid">
          {#each processedData() as d}
            {@const x = xScale(d.year) + xScale.bandwidth() / 2}
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={innerHeight}
              stroke={gridLineColor}
              stroke-width="1"
              shape-rendering="crispEdges"
            />
          {/each}
        </g>
      {/if}

      <!-- Chart border -->
      {#if showChartBorder}
        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill="none"
          stroke={gridLineColor}
          stroke-width="1.5"
          shape-rendering="crispEdges"
        />
      {/if}

      <!-- Bars container for D3 manipulation -->
      <g class="bars" bind:this={barsContainer}>
        <!-- D3 will populate this -->
      </g>

      <!-- X-axis -->
      {#if xTickPosition !== "none"}
        {#if xTickPosition === "bottom" || xTickPosition === "both"}
          <g class="x-axis" transform={`translate(0,${innerHeight})`}>
            {#each processedData() as d}
              {@const x = xScale(d.year) + xScale.bandwidth() / 2}
              <g transform={`translate(${x},0)`}>
                <line y1={0} y2={tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  y={tickOffset + tickLength}
                  text-anchor="middle"
                  dominant-baseline="hanging"
                  class="fill-gray-600 text-sm font-medium"
                >
                  {d.year}
                </text>
              </g>
            {/each}
          </g>
        {/if}

        {#if xTickPosition === "top" || xTickPosition === "both"}
          <g class="x-axis">
            {#each processedData() as d}
              {@const x = xScale(d.year) + xScale.bandwidth() / 2}
              <g transform={`translate(${x},0)`}>
                <line y1={0} y2={-tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  y={-tickOffset - tickLength}
                  text-anchor="middle"
                  dominant-baseline="auto"
                  class="fill-gray-600 text-sm font-medium"
                >
                  {d.year}
                </text>
              </g>
            {/each}
          </g>
        {/if}
      {/if}

      <!-- Y-axis -->
      {#if yTickPosition !== "none"}
        {#if yTickPosition === "left" || yTickPosition === "both"}
          <g class="y-axis">
            {#each yTicks as tick}
              <g transform={`translate(0,${yScale()(tick)})`}>
                <line x1={0} x2={-tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  x={-tickOffset - tickLength}
                  text-anchor="end"
                  dominant-baseline="middle"
                  class="fill-gray-600 text-sm font-medium"
                >
                  {tick}
                </text>
              </g>
            {/each}
          </g>
        {/if}

        {#if yTickPosition === "right" || yTickPosition === "both"}
          <g class="y-axis">
            {#each yTicks as tick}
              <g transform={`translate(${innerWidth},${yScale()(tick)})`}>
                <line x1={0} x2={tickLength} stroke="currentColor" class="text-gray-400" />
                <text
                  x={tickOffset + tickLength}
                  text-anchor="start"
                  dominant-baseline="middle"
                  class="fill-gray-600 text-sm font-medium"
                >
                  {tick}
                </text>
              </g>
            {/each}
          </g>
        {/if}
      {/if}
    </g>
  </svg>

  <!-- Tooltip -->
  {#if enableTooltip && hoveredBar && hoveredSegment}
    <div
      class="pointer-events-none absolute z-50 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-xl"
      style="
        left: {xScale(hoveredBar.year) + xScale.bandwidth() / 2 + margin.left}px;
        top: {Math.min(yScale()(hoveredSegment.y0), yScale()(hoveredSegment.y1)) +
        margin.top -
        10}px;
        transform: translate(-50%, -100%);
      "
      transition:fade={{ duration: 150 }}
    >
      <div class="font-semibold">{hoveredBar.year}</div>
      <div class="capitalize">{hoveredSegment.key}: {hoveredSegment.value.toLocaleString()}</div>
      <div class="text-xs text-gray-400">Total: {hoveredBar.total.toLocaleString()}</div>
      <!-- Tooltip arrow -->
      <div
        class="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-t-4 border-r-4 border-l-4 border-t-gray-900 border-r-transparent border-l-transparent"
      ></div>
    </div>
  {/if}
</div>

<style>
/* Ensure smooth transitions for D3 manipulated elements */
:global(.bar-segment) {
  transition: fill 200ms ease-out;
}
</style>
