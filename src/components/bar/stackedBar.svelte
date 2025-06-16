<script>
// @ts-nocheck
import * as d3 from "d3";
import { getContext, untrack } from "svelte";
import { expoOut, cubicOut } from "svelte/easing"; // expoOut: firm bamboo growth, cubicOut: smooth exit
import { fade } from "svelte/transition";
import Tooltip from "$components/chart/Tooltip.svelte";

// Get responsive dimensions from Figure context
const figure = getContext("Figure");
const width = $derived(figure.getWidth());
const height = $derived(figure.getHeight());

// Component props
let {
  data,
  yearRange = [2003, 2011],
  margin = { top: 40, right: 30, bottom: 50, left: 60 },
  // Stack configuration
  keys = ["negative", "neutral", "positive"],
  // Color scheme
  colors = {
    negative: "hsla(211, 99%, 45%, 1)",
    neutral: "hsla(0, 0%, 85%, 1)",
    positive: "hsla(145, 63%, 42%, 1)",
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
  animationDuration = 800, // Total animation duration for updates
  segmentDuration = 400, // Each bamboo segment grows in 200ms
  yearStaggerDelay = 100,
  segmentStaggerDelay = 100, // Small delay, segments complete before next starts
  // Tooltip configuration
  enableTooltip = true,
} = $props();

// State variables
let hoveredBar = $state(null);
let hoveredSegment = $state(null);
let svgElement = $state(null);
let containerElement = $state(null);

// State management for tooltip
let tooltipData = $state(null);
let tooltipX = $state(0);
let tooltipY = $state(0);
const tooltipOpen = $derived(!!tooltipData);

// Track previous data for animation coordination
let previousYears = [];
let animationPromise = null;

// Calculate chart dimensions
const innerWidth = $derived(width - margin.left - margin.right);
const innerHeight = $derived(height - margin.top - margin.bottom);

// Process data
const processedData = $derived(() => {
  if (!data || !data.length) return [];
  const filteredData = data.filter(({ year }) => year >= yearRange[0] && year <= yearRange[1]);
  return filteredData.map((d) => {
    const processed = {
      year: d.year || d.date,
      ...keys.reduce((acc, key) => {
        acc[key] = +d[key] || 0;
        return acc;
      }, {}),
    };
    processed.total = keys.reduce((sum, key) => sum + processed[key], 0);
    return processed;
  });
});

// Create the stack generator
const stack = d3.stack().keys(keys).order(d3.stackOrderNone).offset(d3.stackOffsetDiverging);

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

  const minValue = d3.min(stacked, (series) => d3.min(series, (d) => d[0]));
  const maxValue = d3.max(stacked, (series) => d3.max(series, (d) => d[1]));
  const range = maxValue - minValue;
  const padding = range * 0.1;

  return d3
    .scaleLinear()
    .domain([minValue - padding, maxValue + padding])
    .nice()
    .range([innerHeight, 0]);
});

const zeroY = $derived(yScale()(0));
const yTicks = $derived(yScale().ticks(yTickCount));

// Calculate the full bounds of each year's stack
const stackBoundsByYear = $derived.by(() => {
  const bounds = new Map();
  const stacked = stackedData();
  if (!stacked.length) return bounds;

  processedData().forEach((yearData, index) => {
    const year = yearData.year;
    const y0Values = stacked.map((series) => series[index][0]);
    const y1Values = stacked.map((series) => series[index][1]);

    bounds.set(year, {
      yMin: yScale()(d3.max(y1Values)),
      yMax: yScale()(d3.min(y0Values)),
    });
  });
  return bounds;
});

function getSegmentColor(seriesKey, isHovered) {
  const colorMap = isHovered ? hoverColors : colors;
  return colorMap[seriesKey] || colors.neutral;
}

// Single effect to manage D3 transitions for the visual layer
$effect(() => {
  if (!svgElement || !stackedData().length) return;

  const svg = d3.select(svgElement);
  const barsGroup = svg.select(".bars-visual");

  // Get current years and determine animation strategy
  const currentYears = processedData().map((d) => d.year);
  const exitingYears = previousYears.filter((year) => !currentYears.includes(year));
  const hasExiting = exitingYears.length > 0;

  // Calculate max exit duration if needed
  let maxExitDuration = 0;
  if (hasExiting) {
    const maxExitIndex = exitingYears.length - 1;
    const maxSeriesIndex = keys.length - 1;
    // Exit animations are quicker with segmentDuration
    maxExitDuration =
      segmentDuration + maxExitIndex * yearStaggerDelay + maxSeriesIndex * segmentStaggerDelay;
  }

  // Cancel any pending animation
  if (animationPromise) {
    animationPromise.cancel = true;
  }

  // Create new animation promise
  const currentAnimation = { cancel: false };
  animationPromise = currentAnimation;

  // Update bars using D3's data join
  const barGroups = barsGroup.selectAll(".bar-group").data(stackedData(), (d) => d.key);

  // Remove exiting groups
  barGroups.exit().transition().duration(animationDuration).style("opacity", 0).remove();

  // Enter new groups
  const enterGroups = barGroups.enter().append("g").attr("class", "bar-group");

  // Update all groups
  const allGroups = barGroups.merge(enterGroups);

  // Handle bars within each group
  allGroups.each(function (series, seriesIndex) {
    if (currentAnimation.cancel) return;

    const group = d3.select(this);
    const bars = group.selectAll(".bar-segment").data(series, (d) => d.data.year);

    // Exit
    bars.exit().each(function (d, i) {
      const exitIndex = exitingYears.indexOf(d.data.year);
      if (exitIndex === -1) return;

      const reverseSeriesIndex = keys.length - 1 - seriesIndex;
      const delay = exitIndex * yearStaggerDelay + reverseSeriesIndex * segmentStaggerDelay;

      d3.select(this)
        .transition()
        .duration(segmentDuration) // Quick exit to match enter duration
        .ease(cubicOut) // Smooth exit without bounce
        .delay(delay)
        .attr("y", (d) => {
          // Exit to the starting edge
          const y0 = yScale()(d[0]);
          const y1 = yScale()(d[1]);
          return d[1] >= d[0] ? y0 : y1;
        })
        .attr("height", 0)
        .style("opacity", 0)
        .remove();
    });

    // Enter
    const enterBars = bars
      .enter()
      .append("rect")
      .attr("class", "bar-segment")
      .attr("x", (d) => xScale(d.data.year))
      .attr("width", xScale.bandwidth())
      .attr("y", (d) => {
        // For enter animation, position at the starting edge
        const y0 = yScale()(d[0]);
        const y1 = yScale()(d[1]);
        // For positive bars, start from bottom; for negative, start from top
        return d[1] >= d[0] ? y0 : y1;
      })
      .attr("height", 0)
      .attr("fill", getSegmentColor(series.key, false))
      .style("pointer-events", "none"); // Visual layer doesn't handle interactions

    // Animate enter - bars grow from their base with proper bamboo timing
    enterBars
      .transition()
      .duration(segmentDuration) // Each segment grows quickly!
      .ease(expoOut) // Firm bamboo-like growth without bounce
      .delay((d, i) => {
        // Bamboo timing: each segment completes ~80% before next starts
        // This creates clear 节节高 (segment by segment) growth
        const yearDelay = i * yearStaggerDelay;
        const segmentDelay = seriesIndex * (segmentDuration * 0.8 + segmentStaggerDelay);
        return maxExitDuration + yearDelay + segmentDelay;
      })
      .attr("y", (d) => Math.min(yScale()(d[0]), yScale()(d[1])))
      .attr("height", (d) => Math.abs(yScale()(d[0]) - yScale()(d[1])));

    // Update (for existing bars that are repositioning)
    bars
      .transition()
      .duration(animationDuration) // Use full duration for updates
      .ease(expoOut) // Consistent bamboo-like effect
      .delay(maxExitDuration)
      .attr("x", (d) => xScale(d.data.year))
      .attr("width", xScale.bandwidth())
      .attr("y", (d) => Math.min(yScale()(d[0]), yScale()(d[1])))
      .attr("height", (d) => Math.abs(yScale()(d[0]) - yScale()(d[1])));
  });

  // Update previous years for next run
  previousYears = [...currentYears];

  // Cleanup function
  return () => {
    if (animationPromise === currentAnimation) {
      animationPromise = null;
    }
  };
});

// Separate effect for interaction layer
$effect(() => {
  if (!svgElement || !processedData().length) return;

  const svg = d3.select(svgElement);
  const interactionGroup = svg.select(".bars-interaction");
  const hoverRects = interactionGroup.selectAll(".hover-area").data(processedData(), (d) => d.year);

  hoverRects.exit().remove();

  hoverRects
    .enter()
    .append("rect")
    .attr("class", "hover-area")
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      const [x, y] = d3.pointer(event, containerElement);
      tooltipX = x;
      tooltipY = y;
      tooltipData = d;
      hoveredBar = d;
    })
    .on("mouseleave", () => {
      tooltipData = null;
      hoveredBar = null;
    })
    .merge(hoverRects)
    .attr("x", (d) => xScale(d.year))
    .attr("width", xScale.bandwidth())
    .attr("y", (d) => stackBoundsByYear.get(d.year)?.yMin ?? 0)
    .attr("height", (d) => {
      const bounds = stackBoundsByYear.get(d.year);
      return bounds ? bounds.yMax - bounds.yMin : 0;
    });
});
</script>

<div class="relative h-full w-full" bind:this={containerElement}>
  <svg bind:this={svgElement} {width} {height} class="h-full w-full">
    <g transform={`translate(${margin.left},${margin.top})`}>
      <rect x={0} y={0} width={innerWidth} height={innerHeight} fill={chartBackgroundColor} />
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
      <line
        x1={0}
        y1={zeroY}
        x2={innerWidth}
        y2={zeroY}
        stroke="hsla(0, 0%, 60%, 1)"
        stroke-width="2"
        shape-rendering="crispEdges"
      />
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
      <g class="bars-visual"></g>
      {#if hoveredBar}
        {@const year = hoveredBar.year}
        {@const bounds = stackBoundsByYear.get(year)}
        {@const x = xScale(year)}
        {#if bounds && x !== undefined}
          <rect
            class="hover-outline"
            {x}
            y={bounds.yMin}
            width={xScale.bandwidth()}
            height={bounds.yMax - bounds.yMin}
            fill="none"
            stroke="hsla(211, 99%, 21%, 1)"
            stroke-width="2.5"
            pointer-events="none"
            rx="2"
            transition:fade={{ duration: 150 }}
          />
        {/if}
      {/if}
      <g class="bars-interaction"></g>
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

  {#if containerElement && enableTooltip}
    <Tooltip
      open={tooltipOpen}
      x={tooltipX}
      y={tooltipY}
      boundary={containerElement}
      preferredSide="right"
      align="start"
      sideOffset={xScale.bandwidth() * 0.65}
      showArrow={true}
    >
      {#snippet children()}
        {#if tooltipData}
          <div class="w-40 font-sans text-sm">
            <p class="mb-2 font-bold text-gray-900 dark:text-gray-50">
              Year: {tooltipData.year}
            </p>
            <div class="space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700">
              {#each keys as key}
                <div class="flex items-center justify-between">
                  <span class="text-gray-700 capitalize dark:text-gray-300">{key}:</span>
                  <span class="font-medium text-gray-900 dark:text-gray-50">
                    {tooltipData[key].toLocaleString()}
                  </span>
                </div>
              {/each}
              <div
                class="flex items-center justify-between border-t border-gray-200/50 pt-1 font-semibold dark:border-gray-700/50"
              >
                <span class="text-gray-700 capitalize dark:text-gray-300">Total:</span>
                <span class="font-medium text-gray-900 dark:text-gray-50">
                  {tooltipData.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        {/if}
      {/snippet}
    </Tooltip>
  {/if}
</div>

<style>
:global(.bar-segment) {
  transition: fill 200ms ease-out;
}
</style>
