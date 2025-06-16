<script>
// @ts-nocheck
import * as d3 from "d3";
import { getContext } from "svelte";
import { backOut } from "svelte/easing";
import Tooltip from "$components/chart/Tooltip.svelte"; // Corrected import path

// Get responsive dimensions from Figure context
const figure = getContext("Figure");
const width = $derived(figure.getWidth());
const height = $derived(figure.getHeight());

// Component props
let {
  data,
  yearRange = [2003, 2011],
  margin = { top: 40, right: 30, bottom: 50, left: 60 },
  keys = ["negative", "neutral", "positive"],
  colors = {
    negative: "hsla(211, 99%, 45%, 1)",
    neutral: "hsla(0, 0%, 85%, 1)",
    positive: "hsla(145, 63%, 42%, 1)",
  },
  hoverColors = {
    negative: "hsla(211, 99%, 35%, 1)",
    neutral: "hsla(0, 0%, 75%, 1)",
    positive: "hsla(145, 63%, 32%, 1)",
  },
  gridLineColor = "hsla(0, 0%, 90%, 1)",
  showXGridlines = false,
  showYGridlines = true,
  showChartBorder = true,
  chartBackgroundColor = "white",
  xTickPosition = "bottom",
  yTickPosition = "left",
  yTickCount = 5,
  tickLength = 6,
  tickOffset = 10,
  barPadding = 0.1,
  animationDuration = 750,
  yearStaggerDelay = 50,
  segmentStaggerDelay = 250,
} = $props();

// State management for the integrated tooltip
let tooltipData = $state(null);
let tooltipX = $state(0);
let tooltipY = $state(0);
const tooltipOpen = $derived(!!tooltipData);

// Element references
let svgElement = $state(null);
let containerElement = $state(null);

// Data processing and scales
const innerWidth = $derived(width - margin.left - margin.right);
const innerHeight = $derived(height - margin.top - margin.bottom);

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

const stack = d3.stack().keys(keys).order(d3.stackOrderNone).offset(d3.stackOffsetDiverging);
const stackedData = $derived(() => {
  const processed = processedData();
  if (!processed.length) return [];
  return stack(processed);
});

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

$effect(() => {
  if (!svgElement || !stackedData().length) return;
  const svg = d3.select(svgElement);

  // --- Rendering Layer (Visible Bars) ---
  const barsGroup = svg.select(".bars-visual");
  const barGroups = barsGroup.selectAll(".bar-group").data(stackedData(), (d) => d.key);
  barGroups.exit().remove();
  const enterGroups = barGroups.enter().append("g").attr("class", "bar-group");
  const allGroups = barGroups.merge(enterGroups);

  allGroups.each(function (series) {
    const group = d3.select(this);
    const bars = group.selectAll(".bar-segment").data(series, (d) => d.data.year);

    bars.exit().remove();

    bars
      .enter()
      .append("rect")
      .attr("class", "bar-segment")
      .attr("x", (d) => xScale(d.data.year))
      .attr("width", xScale.bandwidth())
      .attr("y", (d) => Math.min(yScale()(d[0]), yScale()(d[1])))
      .attr("height", (d) => Math.abs(yScale()(d[0]) - yScale()(d[1])))
      .attr("fill", (d) => colors[series.key])
      .style("pointer-events", "none")
      .merge(bars)
      .transition()
      .duration(animationDuration)
      .attr("x", (d) => xScale(d.data.year))
      .attr("width", xScale.bandwidth())
      .attr("y", (d) => Math.min(yScale()(d[0]), yScale()(d[1])))
      .attr("height", (d) => Math.abs(yScale()(d[0]) - yScale()(d[1])));
  });

  // --- Interaction Layer (Invisible Hover Rectangles) ---
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
    })
    .on("mouseleave", () => {
      tooltipData = null;
    })
    .merge(hoverRects)
    .transition()
    .duration(animationDuration)
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
      <rect x={0} y={0} {innerWidth} {innerHeight} fill={chartBackgroundColor} />

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
          {innerWidth}
          {innerHeight}
          fill="none"
          stroke={gridLineColor}
          stroke-width="1.5"
          shape-rendering="crispEdges"
        />
      {/if}

      <g class="bars-visual"></g>
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

  {#if containerElement}
    <Tooltip
      open={tooltipOpen}
      x={tooltipX}
      y={tooltipY}
      boundary={containerElement}
      preferredSide="right"
      align="start"
      sideOffset={15}
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
