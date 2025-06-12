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
  key?: "close" | "closed_per_100k";
  onchange?: (from: number, to: number) => void;
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
  key = "close",
  onchange = (from, to) => {
    console.log("selected year range:", from, to);
  },
}: IProps = $props();

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
const yTicks = $derived(yScale.ticks(6).map((d) => ({ value: d, y: yScale(d) })));

// Line generator
const line = $derived(
  d3
    .line<IDatum>()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d[key]))
    .curve(d3.curveMonotoneX)
);

// Path data
const pathData = $derived(line(data));

// Brush state - store year range instead of pixel coordinates
let brushGroup = $state<SVGGElement>();
let brushSelection = $state<[number, number] | null>(null);
let yearRangeSelection = $state<[number, number] | null>(null);
let movingHandle = $state<"start" | "end" | null>(null);

const brush = d3
  .brushX()
  .extent([
    [0, 0],
    // svelte-ignore state_referenced_locally
    [innerWidth, innerHeight],
  ])
  .keyModifiers(false)
  .on("brush", onBrush)
  .on("end", onBrushEnd);

$effect(() => {
  // initialize brush
  if (brushGroup) brush(d3.select(brushGroup));
});

// redraw brush when innerWidth or innerHeight changes
$effect(() => {
  if (!brushGroup) return;
  brush.extent([
    [0, 0],
    [innerWidth, innerHeight],
  ]);
  // HACK: somehow setting brush.extent doesn't touch the internal `state.extent`, so set it manually
  // @ts-ignore
  brushGroup.__brush.extent = brush.extent()();

  // MUST be untracked, otherwise it will cause a loop
  untrack(() => {
    if (brushGroup && yearRangeSelection) {
      const [year0, year1] = yearRangeSelection;
      const x0 = xScale(year0);
      const x1 = xScale(year1);
      // redraw
      d3.select(brushGroup).transition().call(brush.move, [x0, x1]);
    }
  });
});

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
}

let _preventReEnter = false;
function onBrushEnd(event: D3BrushEvent<IDatum>) {
  if (_preventReEnter) return (_preventReEnter = false);

  if (!event.selection) {
    // Clear selection
    yearRangeSelection = null;
    movingHandle = null;
    brushSelection = null;
    return;
  }

  let [x0, x1] = event.selection as [number, number];
  // Convert pixel coordinates to years
  let year0 = Math.round(xScale.invert(x0));
  let year1 = Math.round(xScale.invert(x1));

  [year0, year1] = adjustYearRange(year0, year1);

  // Update state and notify parent
  yearRangeSelection = [year0, year1];
  onchange?.(year0, year1);

  // Update the brush position to reflect final constrained values
  const finalX0 = xScale(year0);
  const finalX1 = xScale(year1);

  if (brushGroup && (Math.abs(finalX0 - x0) > 1 || Math.abs(finalX1 - x1) > 1)) {
    _preventReEnter = true;
    d3.select(brushGroup).transition().call(brush.move, [finalX0, finalX1]);
  }

  // Reset
  movingHandle = null;
  brushSelection = [finalX0, finalX1];
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

<svg {width} {height} class="overflow-visible">
  <!-- Main chart group -->
  <g transform="translate({margin.left}, {margin.top})">
    <!-- Grid lines -->
    <g class="grid opacity-20">
      {#each xTicks as tick}
        <line
          x1={tick.x}
          x2={tick.x}
          y1={0}
          y2={innerHeight}
          stroke="currentColor"
          stroke-width="0.5"
        />
      {/each}
      {#each yTicks as tick}
        <line
          x1={0}
          x2={innerWidth}
          y1={tick.y}
          y2={tick.y}
          stroke="currentColor"
          stroke-width="0.5"
        />
      {/each}
    </g>

    <!-- Line chart -->
    <path
      d={pathData}
      fill="none"
      stroke="#3b82f6"
      stroke-width="2"
      class="transition-all duration-300"
    />

    <!-- Data points -->
    {#each data as point}
      <circle
        cx={xScale(point.year)}
        cy={yScale(point[key])}
        r="3"
        fill="#3b82f6"
        class="hover:r-4 transition-all duration-200"
      />
    {/each}

    <!-- X-axis -->
    <g transform="translate(0, {innerHeight})">
      <line x1={0} x2={innerWidth} stroke="currentColor" stroke-width="1" />
      {#each xTicks as tick}
        <g transform="translate({tick.x}, 0)">
          <line y1={0} y2={6} stroke="currentColor" />
          <text y={20} text-anchor="middle" class="fill-current text-sm">{tick.value}</text>
        </g>
      {/each}
      <text x={innerWidth / 2} y={50} text-anchor="middle" class="fill-current text-sm font-medium"
        >Year</text
      >
    </g>

    <!-- Y-axis -->
    <g>
      <line y1={0} y2={innerHeight} stroke="currentColor" stroke-width="1" />
      {#each yTicks as tick}
        <g transform="translate(0, {tick.y})">
          <line x1={-6} x2={0} stroke="currentColor" />
          <text x={-10} dy="0.35em" text-anchor="end" class="fill-current text-sm"
            >{tick.value}</text
          >
        </g>
      {/each}
      <text
        x={-50}
        y={innerHeight / 2}
        text-anchor="middle"
        transform="rotate(-90, {-50}, {innerHeight / 2})"
        class="fill-current text-sm font-medium"
      >
        {key === "close" ? "Close" : "Closed per 100k"}
      </text>
    </g>
  </g>

  <!-- Brush -->
  <g bind:this={brushGroup} class="brush" transform="translate({margin.left}, {margin.top})"></g>
</svg>

<style>
:global(.brush .selection) {
  fill: rgba(59, 130, 246, 0.2);
  stroke: #3b82f6;
  stroke-width: 1;
}

:global(.brush .handle) {
  fill: #3b82f6;
}
</style>
