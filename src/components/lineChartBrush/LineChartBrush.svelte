<script lang="ts">
/**
 * moving parts:
 * - data
 * - year start, end
 * - chart height, width
 */
import * as d3 from "d3";
import { untrack, getContext, onMount } from "svelte";
import { scale } from "svelte/transition";
import { cubicOut } from "svelte/easing";
import { Tween } from "svelte/motion";
import Tooltip from "$components/chart/Tooltip.svelte";
import type { D3BrushEvent } from "d3-brush";

type IDatum = {
  year: number;
  close: number;
  closed_per_100k: number;
};

type IProps = {
  data?: IDatum[];
  margin?: { top: number; right: number; bottom: number; left: number };
  yearRange?: [number, number];
  key?: "close" | "closed_per_100k";
};

const exampleData = [
  { year: 2001, close: 70, closed_per_100k: 0.2 },
  { year: 2002, close: 50, closed_per_100k: 0.1 },
  { year: 2003, close: 40, closed_per_100k: 0.1 },
  { year: 2004, close: 60, closed_per_100k: 0.1 },
  { year: 2005, close: 100, closed_per_100k: 0.3 },
  { year: 2006, close: 120, closed_per_100k: 0.3 },
  { year: 2007, close: 40, closed_per_100k: 0.1 },
  { year: 2008, close: 10, closed_per_100k: 0.05 },
  { year: 2009, close: 30, closed_per_100k: 0.05 },
  { year: 2010, close: 50, closed_per_100k: 0.1 },
  { year: 2011, close: 50, closed_per_100k: 0.1 },
  { year: 2012, close: 20, closed_per_100k: 0.05 },
  { year: 2013, close: 20, closed_per_100k: 0.05 },
  { year: 2014, close: 20, closed_per_100k: 0.05 },
  { year: 2015, close: 90, closed_per_100k: 0.2 },
  { year: 2016, close: 120, closed_per_100k: 0.3 },
  { year: 2017, close: 40, closed_per_100k: 0.1 },
  { year: 2018, close: 10, closed_per_100k: 0.05 },
  { year: 2019, close: 30, closed_per_100k: 0.05 },
  { year: 2020, close: 90, closed_per_100k: 0.2 },
  { year: 2021, close: 120, closed_per_100k: 0.3 },
];

// Configurable parameters
const MIN_YEAR_SPAN = 5;
const MIN_YEAR_START = 2001;
const MAX_YEAR_END = 2021;

// Component props
let {
  data = exampleData,
  margin = { top: 50, right: 30, bottom: 80, left: 80 },
  yearRange = $bindable([2003, 2011]),
  key = "close",
}: IProps = $props();

// Visual styling props - matching lineChart.svelte aesthetic
const chartBackgroundColor = "hsla(206, 100%, 96%, 1)";
const lineColor = "hsla(0, 0%, 53%, 1)";
const circleColor = "hsla(211, 99%, 21%, 1)";
const circleHoverColor = "hsla(211, 99%, 35%, 1)";
const gridLineColor = "hsla(0, 0%, 80%, 1)";
const circleRadius = 6;
const circleHoverRadius = 8;
const tickLength = 6;
const tickOffset = 20;

// Get responsive dimensions from Figure context
const figure: any = getContext("Figure");
const width = $derived(figure.getWidth());
const height = $derived(figure.getHeight());
// Computed dimensions
const innerWidth = $derived(width - margin.left - margin.right);
const innerHeight = $derived(height - margin.top - margin.bottom);

// D3 scales
const xScale = $derived(
  d3.scaleLinear().domain([MIN_YEAR_START, MAX_YEAR_END]).range([0, innerWidth])
);

const yScale = $derived(
  d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d[key]) as [number, number])
    .nice()
    .range([innerHeight, 0])
);

// Axis ticks
const xTicks = $derived(xScale.ticks().map((d) => ({ value: d, x: xScale(d) })));
const yTicks = $derived(yScale.ticks(3).map((d) => ({ value: d, y: yScale(d) })));

// Line generator
const line = $derived(
  d3
    .line<IDatum>()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d[key]))
  // .curve(d3.curveMonotoneX)
);

// Path data
const pathData = $derived(line(data));

// Brush state - store year range instead of pixel coordinates
let brushGroupElm = $state<SVGGElement>();
let brushSelection = $state<[number, number] | null>(null);
let yearRangeSelection = $state<[number, number]>(yearRange);
let movingHandle = $state<"start" | "end" | null>(null);

const yearSpan = $derived(yearRangeSelection[1] - yearRangeSelection[0]);

// Hover state for circles
let hoveredPoint = $state<IDatum | null>(null);

const brush = d3
  .brushX()
  .extent([
    [0, 0],
    // svelte-ignore state_referenced_locally
    [innerWidth, innerHeight],
  ])
  .handleSize(8)
  .keyModifiers(false)
  .on("brush", onBrush)
  .on("end", onBrushEnd);

$effect(() => {
  // initialize brush
  if (brushGroupElm) {
    const brushGroup = d3.select(brushGroupElm).call(brush);
    brushGroup.select(".selection").attr("fill", "white").attr("fill-opacity", "1");
    // prevent clicking on the overlay, so user cannot de-select the brushed range
    brushGroup.select(".overlay").attr("pointer-events", "none");
    brushGroup
      .selectAll(".handle")
      .attr("fill", "hsla(162, 100%, 38%, 1)")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("rx", 2);
  }
});

function redrawBrush() {
  if (brushGroupElm && yearRangeSelection) {
    const [year0, year1] = yearRangeSelection;
    const x0 = xScale(year0);
    const x1 = xScale(year1);
    // redraw
    d3.select(brushGroupElm).transition().call(brush.move, [x0, x1]);
  }
}
// redraw brush when innerWidth or innerHeight changes
$effect(() => {
  if (!brushGroupElm) return;
  brush.extent([
    [0, 0],
    [innerWidth, innerHeight],
  ]);
  // HACK: somehow setting brush.extent doesn't touch the internal `state.extent`, so set it manually
  // @ts-ignore
  brushGroupElm.__brush.extent = brush.extent()();

  // MUST be untracked, otherwise it will cause a loop
  untrack(redrawBrush);
});

function updateYearRange(year0: number, year1: number) {
  if (year0 !== yearRange[0] || year1 !== yearRange[1]) {
    yearRange = [year0, year1];
    yearRangeSelection = [year0, year1];
  }
}

function onBrush(event: D3BrushEvent<IDatum>) {
  if (!event.selection) return;

  const [x0, x1] = event.selection as [number, number];

  // Track which handle is moving by comparing with previous selection
  if (event.mode === "handle" && brushSelection) {
    const [prevX0, prevX1] = brushSelection;

    // Determine which handle moved by checking which end changed more
    const startDelta = Math.abs(x0 - prevX0);
    const endDelta = Math.abs(x1 - prevX1);

    if (startDelta > endDelta) {
      movingHandle = "start";
    } else {
      movingHandle = "end";
    }
  }

  // Update previous selection for next comparison
  brushSelection = [x0, x1];
  // Convert pixel coordinates to years
  let year0 = Math.round(xScale.invert(x0));
  let year1 = Math.round(xScale.invert(x1));
  yearRangeSelection = [year0, year1];
}

let _preventReEnter = false;
function onBrushEnd(event: D3BrushEvent<IDatum>) {
  if (_preventReEnter) return (_preventReEnter = false);

  if (!event.selection) {
    redrawBrush();
    // Clear selection
    // yearRangeSelection = null;
    // movingHandle = null;
    // brushSelection = null;
    return;
  }

  let [x0, x1] = event.selection as [number, number];
  // Convert pixel coordinates to years
  let year0 = Math.round(xScale.invert(x0));
  let year1 = Math.round(xScale.invert(x1));

  [year0, year1] = adjustYearRange(year0, year1);

  // Update state and notify parent
  updateYearRange(year0, year1);

  // Update the brush position to reflect final constrained values
  const finalX0 = xScale(year0);
  const finalX1 = xScale(year1);

  if (brushGroupElm && (Math.abs(finalX0 - x0) > 1 || Math.abs(finalX1 - x1) > 1)) {
    _preventReEnter = true;
    d3.select(brushGroupElm).transition().call(brush.move, [finalX0, finalX1]);
  }

  // Reset
  movingHandle = null;
  brushSelection = [finalX0, finalX1];
}

// Mouse event handlers for circle hover
function handleCircleMouseEnter(point: IDatum) {
  hoveredPoint = point;
}

function handleCircleMouseLeave() {
  hoveredPoint = null;
}

function adjustYearRange(year0: number, year1: number) {
  // Apply constraints based on which handle was moving
  if (year1 - year0 < MIN_YEAR_SPAN) {
    if (movingHandle === "end") {
      year1 = year0 + MIN_YEAR_SPAN;

      // If extending end goes beyond max, move start back
      if (year1 > MAX_YEAR_END) {
        year1 = MAX_YEAR_END;
        year0 = year1 - MIN_YEAR_SPAN;
      }
    } else if (movingHandle === "start") {
      year0 = year1 - MIN_YEAR_SPAN;

      // If extending start goes beyond min, move end forward
      if (year0 < MIN_YEAR_START) {
        year0 = MIN_YEAR_START;
        year1 = year0 + MIN_YEAR_SPAN;
      }
    } else {
      // New selection or drag - expand from center
      const center = (year0 + year1) / 2;
      year0 = Math.max(MIN_YEAR_START, Math.floor(center - MIN_YEAR_SPAN / 2));
      year1 = Math.min(MAX_YEAR_END, year0 + MIN_YEAR_SPAN);

      // Adjust if we hit boundaries
      if (year1 > MAX_YEAR_END) {
        year1 = MAX_YEAR_END;
        year0 = year1 - MIN_YEAR_SPAN;
      }
      if (year0 < MIN_YEAR_START) {
        year0 = MIN_YEAR_START;
        year1 = year0 + MIN_YEAR_SPAN;
      }
    }
  }

  // Final boundary constraints
  year0 = Math.max(MIN_YEAR_START, Math.min(MAX_YEAR_END - MIN_YEAR_SPAN, year0));
  year1 = Math.min(MAX_YEAR_END, Math.max(MIN_YEAR_START + MIN_YEAR_SPAN, year1));
  return [year0, year1];
}
</script>

<div class="relative h-full w-full">
  <svg {width} {height} class="h-full w-full">
    <!-- Chart area with margin -->
    <g transform="translate({margin.left}, {margin.top})">
      <!-- Background color -->
      <rect x={0} y={0} width={innerWidth} height={innerHeight} fill={chartBackgroundColor} />

      <!-- Brush container (rendered before circles so circles are on top) -->
      <g bind:this={brushGroupElm} class="brush-group"></g>

      <!-- X-axis grid lines -->
      <g class="x-grid grid">
        {#each xTicks as tick}
          <line
            x1={tick.x}
            y1={0}
            x2={tick.x}
            y2={innerHeight}
            stroke={gridLineColor}
            stroke-width="1"
            opacity="0.5"
          />
        {/each}
      </g>

      <!-- Y-axis grid lines -->
      <g class="y-grid grid">
        {#each yTicks as tick}
          <line
            x1={0}
            y1={tick.y}
            x2={innerWidth}
            y2={tick.y}
            stroke={gridLineColor}
            stroke-width="1"
            opacity="0.5"
          />
        {/each}
      </g>

      <!-- Chart border (enclosing rectangle) -->
      <rect
        x={0}
        y={0}
        width={innerWidth}
        height={innerHeight}
        fill="none"
        stroke={gridLineColor}
        stroke-width="1.5"
      />

      <!-- X-axis ticks and labels -->
      <g class="x-axis-top">
        {#each xTicks as tick}
          <g transform="translate({tick.x}, 0)">
            <line y1={0} y2={-tickLength} stroke="currentColor" class="text-gray-400" />
            <text
              y={-tickOffset}
              text-anchor="middle"
              dominant-baseline="middle"
              class="fill-gray-600 text-xs font-medium"
            >
              {tick.value}
            </text>
          </g>
        {/each}
      </g>

      <!-- Y-axis ticks and labels -->
      <g class="y-axis-left">
        {#each yTicks as tick}
          <g transform="translate(0, {tick.y})">
            <line x1={0} x2={-tickLength} stroke="currentColor" class="text-gray-400" />
            <text
              x={-tickOffset}
              text-anchor="end"
              dominant-baseline="middle"
              class="fill-gray-600 text-xs font-medium"
            >
              {tick.value}
            </text>
          </g>
        {/each}
      </g>

      <!-- Line path -->
      <path
        d={pathData}
        class="fill-none stroke-2"
        stroke={lineColor}
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Data points (rendered after brush so they're on top) -->
      <g class="data-points" style="pointer-events: all;">
        {#each data as point}
          <circle
            cx={xScale(point.year)}
            cy={yScale(point[key])}
            r={circleRadius}
            fill={circleColor}
            stroke="white"
            stroke-width="2"
            class="cursor-pointer transition-all duration-200 ease-out"
            style="filter: none;"
            role="button"
            tabindex="0"
            aria-label="Data point for {point.year}: {point[key]}"
            onmouseenter={() => handleCircleMouseEnter(point)}
            onmouseleave={handleCircleMouseLeave}
            onfocus={() => handleCircleMouseEnter(point)}
            onblur={handleCircleMouseLeave}
          />
        {/each}
      </g>
    </g>
  </svg>

  {#if brushSelection && yearRangeSelection}
    <div
      class="bg-yale-green absolute -translate-x-1/2 transform rounded-sm px-2 py-1 text-xs whitespace-nowrap shadow-md"
      style={`left: ${margin.left + brushSelection[0]}px; top: ${margin.top + innerHeight + 5}px;`}
      aria-hidden={!brushSelection}
    >
      from <strong>{yearRangeSelection[0]}</strong>
    </div>

    <div
      class="bg-yale-green absolute -translate-x-1/2 transform rounded-sm px-2 py-1 text-xs whitespace-nowrap shadow-md"
      style={`left: ${margin.left + brushSelection[1]}px; top: ${margin.top + innerHeight + 5}px;`}
      aria-hidden={!brushSelection}
    >
      to <strong>{yearRangeSelection[1]}</strong>
    </div>

    <div
      class="absolute z-10 -translate-x-1/2 transform text-xs font-medium"
      class:text-yale-green={yearSpan >= 5}
      class:text-yale-red={yearSpan < 5}
      style={`left: ${margin.left + (brushSelection[0] + brushSelection[1]) / 2}px; top: ${
        margin.top + innerHeight + 5
      }px;`}
      aria-hidden={!brushSelection}
    >
      {#if yearSpan < 5}
        Minimum 5 years
      {:else}
        {yearSpan} years
      {/if}
    </div>
  {/if}
</div>
