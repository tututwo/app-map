<script lang="ts">
/**
 * moving parts:
 * - data
 * - year start, end
 * - chart height, width
 */

import * as d3 from "d3";
import { untrack, getContext } from "svelte";
import { ArrowLeftToLine } from "lucide-svelte";
import Tooltip from "$components/chart/Tooltip.svelte";
import { YEAR_WINDOW_BOUNDS, clampYearWindow, inferAdjustedEdge } from "$lib/domain/yearWindow";
import type { AdjustedEdge } from "$lib/domain/yearWindow";
import type { D3BrushEvent } from "d3-brush";

import {
  animateLineChart,
  fadeInInstruction,
  fadeOutInstruction,
  flashSelectionWarning,
} from "./animations";

type IDatum = {
  year: number;
  close: number;
};

type IProps = {
  data?: IDatum[];
  margin?: { top: number; right: number; bottom: number; left: number };
  yearRange?: [number, number];
  disableBrushing?: boolean;
};

// Year-window rules are owned by the domain module (data-driven)
const {
  minGap: MIN_YEAR_SPAN,
  minYear: MIN_YEAR_START,
  maxYear: MAX_YEAR_END,
} = YEAR_WINDOW_BOUNDS;
const ALERT_COLOR = "hsla(0, 0%, 53%, 1)";
const FROM_TO_TEXT_VERTICAL_OFFSET = 10;
const Y_AXIS_TICK_COUNT = 2;
const key = "close" as const;

// Add tick formatter for y-axis
const yTickFormatter = d3.format("~s"); // SI-prefix with trimmed zeros

// Component props
let {
  data = [],
  margin = { top: 50, right: 30, bottom: 80, left: 80 },
  yearRange = $bindable([2003, 2011]),
  disableBrushing = false,
}: IProps = $props();

// Visual styling props
const chartBackgroundColor = "hsla(206, 100%, 96%, 1)";
const lineColor = "hsla(0, 0%, 53%, 1)";
const circleColor = "hsla(211, 99%, 21%, 1)";
const circleHoverColor = "hsla(211, 99%, 35%, 1)";
const gridLineColor = "hsla(0, 0%, 80%, 1)";
const circleRadius = 5;
const circleHoverRadius = 8;
const tickLength = 6;
const tickOffset = 20;

// Get responsive dimensions from Figure context
const figure = getContext("Figure") as { getWidth(): number; getHeight(): number };
const width = $derived(figure.getWidth());
const height = $derived(figure.getHeight());
// Computed dimensions
const innerWidth = $derived(width - margin.left - margin.right);
const innerHeight = $derived(height - margin.top - margin.bottom);

// D3 scales
const xScale = $derived(
  d3.scaleLinear().domain([MIN_YEAR_START, MAX_YEAR_END]).range([0, innerWidth])
);

const yScale = $derived.by(() => {
  const [minValue, maxValue] = d3.extent(data, (d) => d[key]) as [number, number];

  // Start from 0 for smaller values, use the data minimum for larger values
  const domainMin = maxValue <= 1000 ? 0 : minValue;

  return d3.scaleLinear().domain([domainMin, maxValue]).nice().range([innerHeight, 0]);
});

// Axis ticks
const xTicks = $derived(xScale.ticks().map((d) => ({ value: d, x: xScale(d) })));
const yTicks = $derived.by(() => {
  let ticks = yScale.ticks(Y_AXIS_TICK_COUNT);

  // Ensure 0 is included if the scale starts from 0
  const [min] = yScale.domain();
  if (min === 0 && !ticks.includes(0)) {
    ticks = [0, ...ticks].sort((a, b) => a - b);
  }

  return ticks.map((d) => ({ value: d, y: yScale(d) }));
});

// Line generator
const line = $derived(
  d3
    .line<IDatum>()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d[key]))
  // .curve(d3.curveMonotoneX)
);
function flashWarningEffect() {
  if (!brushGroupElm) return;

  const selectionRect = d3.select(brushGroupElm).select(".selection").node();
  if (selectionRect) flashSelectionWarning(selectionRect as Element, ALERT_COLOR);
}

// Add new state for instruction animation
let instructionElement = $state<HTMLDivElement>();
let hasInteracted = $state(false);
// +++ ADD LABEL DRAGGING STATE +++
let isDraggingLabel = $state<"from" | "to" | null>(null);
let dragStartX = $state(0);
let dragStartYear = $state(0);

// The path and circles are animated by gsap (see ./animations.ts), not by
// Svelte reactivity — this effect hands the new geometry to the animator.
let pathElement = $state<SVGPathElement>();
let circleElements = $state<Array<SVGCircleElement | undefined>>([]);
let isInitialRender = true;
let chartTimeline: ReturnType<typeof animateLineChart> = null;

$effect(() => {
  if (!pathElement || !data.length) return;

  const newPath = line(data);
  if (!newPath) return;

  chartTimeline = animateLineChart({
    pathElement,
    circleElements,
    path: newPath,
    circles: data.map((point) => ({ cx: xScale(point.year), cy: yScale(point[key]) })),
    isInitial: isInitialRender,
    previousTimeline: chartTimeline,
  });
  isInitialRender = false;
});
// Brush state - store year range instead of pixel coordinates
let brushGroupElm = $state<SVGGElement>();
let brushSelection = $state<[number, number] | null>(null);
let yearRangeSelection = $state<[number, number]>(yearRange);
let movingHandle = $state<AdjustedEdge>(null);
let isSnapping = false;
let snapGeneration = 0;

// +++ IMPROVED TOOLTIP STATE - Following stacked bar chart pattern +++
let svgBoundary = $state<HTMLElement | null>();
let tooltipData = $state<IDatum | null>(null);
let tooltipX = $state(0);
let tooltipY = $state(0);
const tooltipOpen = $derived(!!tooltipData);

// +++ ADD THIS NEW STATE VARIABLE +++
let isSelectionInvalid = $state(false);
const yearSpan = $derived(yearRangeSelection[1] - yearRangeSelection[0]);

const brush = d3
  .brushX()
  .extent([
    [0, 0],
    [1, 1],
  ])
  .handleSize(15)
  .keyModifiers(false)
  .filter((event) => !disableBrushing)
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

      .attr("rx", 3);
  }
});

function redrawBrush() {
  if (brushGroupElm && yearRangeSelection && !isDraggingLabel) {
    const [year0, year1] = yearRangeSelection;
    const x0 = xScale(year0);
    const x1 = xScale(year1);
    d3.select(brushGroupElm).interrupt().call(brush.move, [x0, x1]);
  }
}

// Keep the visible selection in sync when navigation changes the input range.
// yearRangeSelection is read via untrack: depending on it reactively would
// re-run this effect on every onBrush frame and snap the selection back to
// the URL range mid-gesture, making direct brush drags a silent no-op.
$effect(() => {
  const nextRange: [number, number] = [yearRange[0], yearRange[1]];
  const currentSelection = untrack(() => yearRangeSelection);

  if (nextRange[0] === currentSelection[0] && nextRange[1] === currentSelection[1]) {
    return;
  }

  yearRangeSelection = nextRange;
  untrack(redrawBrush);
});
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

  // Track which handle is moving by comparing with the previous selection
  if (event.mode === "handle" && brushSelection) {
    movingHandle = inferAdjustedEdge(brushSelection, [x0, x1]);
  }

  // Update previous selection for next comparison
  brushSelection = [x0, x1];
  // Convert pixel coordinates to years
  let year0 = Math.round(xScale.invert(x0));
  let year1 = Math.round(xScale.invert(x1));
  yearRangeSelection = [year0, year1];

  // +++ ADD THIS LIVE VALIDITY CHECK +++
  const yearSpan = yearRangeSelection[1] - yearRangeSelection[0];
  isSelectionInvalid = yearSpan < MIN_YEAR_SPAN;
}
// Add this new effect to your <script> block

$effect(() => {
  // If the selection has *just* become invalid, trigger the flash.
  // This effect will only re-run when isSelectionInvalid changes value.
  if (isSelectionInvalid) {
    flashWarningEffect();
  }
});
function onBrushEnd(event: D3BrushEvent<IDatum>) {
  if (isSnapping || isDraggingLabel) return;

  if (!event.selection) {
    redrawBrush();
    return;
  }

  let [x0, x1] = event.selection as [number, number];
  // Convert pixel coordinates to years
  let year0 = Math.round(xScale.invert(x0));
  let year1 = Math.round(xScale.invert(x1));

  [year0, year1] = adjustYearRange(year0, year1);

  // Update the brush position to reflect final constrained values
  const finalX0 = xScale(year0);
  const finalX1 = xScale(year1);

  if (brushGroupElm && (Math.abs(finalX0 - x0) > 1 || Math.abs(finalX1 - x1) > 1)) {
    const generation = ++snapGeneration;
    isSnapping = true;

    d3.select(brushGroupElm)
      .transition()
      .call(brush.move, [finalX0, finalX1])
      .on("end.publish", () => {
        if (generation !== snapGeneration) return;

        isSnapping = false;
        movingHandle = null;
        brushSelection = [finalX0, finalX1];
        updateYearRange(year0, year1);
      })
      .on("interrupt.publish cancel.publish", () => {
        if (generation !== snapGeneration) return;
        isSnapping = false;
      });

    return;
  }

  // No snapping animation is needed, so publish immediately.
  updateYearRange(year0, year1);
  movingHandle = null;
  brushSelection = [finalX0, finalX1];
}

// +++ IMPROVED TOOLTIP HANDLERS +++
function handleCircleMouseEnter(point: IDatum) {
  // Calculate positions first
  const x = xScale(point.year) + margin.left;
  const y = yScale(point[key]) + margin.top;

  // Set all tooltip state at once
  tooltipX = x;
  tooltipY = y;
  tooltipData = point;
}

function handleCircleMouseLeave() {
  // Clear the tooltip data
  tooltipData = null;
}

function adjustYearRange(year0: number, year1: number) {
  const { from, to } = clampYearWindow(year0, year1, movingHandle);
  return [from, to];
}

// Drag-instruction fade-in on first interaction, fade-out when the brush clears
$effect(() => {
  if (instructionElement && brushSelection && !hasInteracted) {
    hasInteracted = true;
    fadeInInstruction(instructionElement);
  }
});

$effect(() => {
  if (instructionElement && !brushSelection && hasInteracted) {
    fadeOutInstruction(instructionElement);
  }
});

// +++ ADD LABEL DRAG HANDLERS +++
function handleLabelMouseDown(event: MouseEvent, type: "from" | "to") {
  if (disableBrushing || !yearRangeSelection || !brushGroupElm) return;

  event.preventDefault();
  isDraggingLabel = type;
  dragStartX = event.clientX;
  dragStartYear = type === "from" ? yearRangeSelection[0] : yearRangeSelection[1];

  // Add global listeners
  window.addEventListener("mousemove", handleLabelMouseMove);
  window.addEventListener("mouseup", handleLabelMouseUp);
}

// One path for "move one window edge" — shared by handle drags (via d3-brush)
// and label drags: clamp through the domain module, then puppet the brush.
function moveEdge(edge: "from" | "to", year: number) {
  if (!brushGroupElm) return;

  movingHandle = edge;
  const [year0, year1] =
    edge === "from" ? [year, yearRangeSelection[1]] : [yearRangeSelection[0], year];
  const [adjusted0, adjusted1] = adjustYearRange(year0, year1);
  d3.select(brushGroupElm).call(brush.move, [xScale(adjusted0), xScale(adjusted1)]);
}

const pixelsPerYear = $derived(innerWidth / (MAX_YEAR_END - MIN_YEAR_START));

function handleLabelMouseMove(event: MouseEvent) {
  if (!isDraggingLabel) return;

  const deltaYear = Math.round((event.clientX - dragStartX) / pixelsPerYear);
  moveEdge(isDraggingLabel, dragStartYear + deltaYear);
}

function handleLabelMouseUp() {
  const finalRange = yearRangeSelection;
  isDraggingLabel = null;
  window.removeEventListener("mousemove", handleLabelMouseMove);
  window.removeEventListener("mouseup", handleLabelMouseUp);

  if (finalRange) {
    updateYearRange(finalRange[0], finalRange[1]);
  }

  movingHandle = null;
}

// Clean up on unmount
$effect(() => {
  return () => {
    window.removeEventListener("mousemove", handleLabelMouseMove);
    window.removeEventListener("mouseup", handleLabelMouseUp);
  };
});

// The data-point circles render above the brush (they need hover tooltips),
// so a mousedown on one would never reach d3's listeners in the brush group.
// Re-dispatch it onto the topmost brush element under the cursor instead.
function forwardMousedownToBrush(event: MouseEvent) {
  if (disableBrushing || !brushGroupElm) return;
  const brushTarget = document
    .elementsFromPoint(event.clientX, event.clientY)
    .find((el) => brushGroupElm!.contains(el) && el !== brushGroupElm);
  if (!brushTarget) return;
  brushTarget.dispatchEvent(new MouseEvent("mousedown", event));
}
</script>

<div class="relative h-full w-full" bind:this={svgBoundary}>
  <svg {width} {height} class="h-full w-full">
    <!-- Chart area with margin -->
    <g transform="translate({margin.left}, {margin.top})">
      <!-- Background color -->
      <rect x={0} y={0} width={innerWidth} height={innerHeight} fill={chartBackgroundColor} />

      <!-- Brush container (rendered before circles so circles are on top) -->
      <g bind:this={brushGroupElm} class="brush-group"></g>

      <!-- X-axis grid lines -->
      <g class="x-grid grid" pointer-events="none">
        {#each data as point (point.year)}
          <line
            x1={xScale(point.year)}
            y1={0}
            x2={xScale(point.year)}
            y2={innerHeight}
            stroke={gridLineColor}
            stroke-width="1"
            opacity="0.5"
          />
        {/each}
      </g>

      <!-- Y-axis grid lines -->
      <g class="y-grid grid" pointer-events="none">
        {#each yTicks as tick (tick.value)}
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
        pointer-events="none"
      />

      <!-- X-axis ticks and labels -->
      <g class="x-axis-top" pointer-events="none">
        {#each xTicks as tick (tick.value)}
          <g transform="translate({tick.x}, 10)">
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
      <g class="y-axis-left" pointer-events="none">
        {#each yTicks as tick (tick.value)}
          <g transform="translate(10, {tick.y})">
            <text
              x={-tickOffset}
              text-anchor="end"
              dominant-baseline="middle"
              class="fill-gray-600 text-xs font-medium"
            >
              {yTickFormatter(tick.value)}
            </text>
          </g>
        {/each}
      </g>

      <!-- Line path -->
      <path
        bind:this={pathElement}
        d=""
        fill="none"
        stroke-width="2"
        stroke={lineColor}
        stroke-linejoin="round"
        stroke-linecap="round"
        pointer-events="none"
      />

      <!-- Data points (rendered after brush so they're on top) -->
      <g class="data-points" style="pointer-events: all;">
        {#each data as point, i (point.year)}
          <circle
            bind:this={circleElements[i]}
            r={circleRadius}
            fill={circleColor}
            stroke="white"
            stroke-width="2"
            class="cursor-pointer"
            style="filter: none;"
            role="button"
            tabindex="0"
            aria-label="Data point for {point.year}: {point[key]}"
            onmouseenter={() => handleCircleMouseEnter(point)}
            onmouseleave={handleCircleMouseLeave}
            onfocus={() => handleCircleMouseEnter(point)}
            onblur={handleCircleMouseLeave}
            onmousedown={forwardMousedownToBrush}
          />
        {/each}
      </g>
    </g>
  </svg>

  {#if brushSelection && yearRangeSelection}
    <button
      type="button"
      disabled={disableBrushing}
      class="bg-yale-green absolute -translate-x-1/2 transform rounded-sm px-2 py-1 whitespace-nowrap shadow-md"
      class:cursor-grab={!disableBrushing && !isDraggingLabel}
      class:cursor-grabbing={isDraggingLabel === "from"}
      style={`left: ${margin.left + brushSelection[0]}px; top: ${margin.top + innerHeight + FROM_TO_TEXT_VERTICAL_OFFSET}px; user-select: none;`}
      aria-hidden={!brushSelection}
      onmousedown={(e) => handleLabelMouseDown(e, "from")}
    >
      from <strong>{yearRangeSelection[0]}</strong>
    </button>

    <button
      type="button"
      disabled={disableBrushing}
      class="bg-yale-green absolute -translate-x-1/2 transform rounded-sm px-2 py-1 whitespace-nowrap shadow-md"
      class:cursor-grab={!disableBrushing && !isDraggingLabel}
      class:cursor-grabbing={isDraggingLabel === "to"}
      style={`left: ${margin.left + brushSelection[1]}px; top: ${margin.top + innerHeight + FROM_TO_TEXT_VERTICAL_OFFSET}px; user-select: none;`}
      aria-hidden={!brushSelection}
      onmousedown={(e) => handleLabelMouseDown(e, "to")}
    >
      to <strong>{yearRangeSelection[1]}</strong>
    </button>

    {#if !disableBrushing}
      <div
        bind:this={instructionElement}
        class="absolute flex translate-y-1/2 transform items-center gap-1.5
           text-xs font-normal tracking-wide whitespace-nowrap text-gray-700"
        style={`
      left: ${margin.left + brushSelection[1] + 80}px; 
      top: ${margin.top + innerHeight + FROM_TO_TEXT_VERTICAL_OFFSET - 2}px; 
      opacity: 0;
    `}
        aria-hidden={!brushSelection}
        role="tooltip"
      >
        <ArrowLeftToLine class="h-3.5 w-3.5 translate-y-1/2 opacity-70" />
        <span class="translate-y-1/2 uppercase" style="letter-spacing: 0.05em;"
          >Drag to adjust range</span
        >
      </div>
    {/if}
    <!-- use +50 to control where the "from to" texts are -->
    <div
      class="absolute z-10 -translate-x-1/2 transform text-xs font-medium"
      class:text-yale-green={!isSelectionInvalid}
      class:text-yale-red={isSelectionInvalid}
      style={`left: ${margin.left + (brushSelection[0] + brushSelection[1]) / 2}px; top: ${
        margin.top + innerHeight + FROM_TO_TEXT_VERTICAL_OFFSET
      }px;`}
      aria-hidden={!brushSelection}
    >
      {#if isSelectionInvalid}
        Minimum {MIN_YEAR_SPAN} years
      {:else}
        {yearSpan} years
      {/if}
    </div>
  {/if}

  {#if svgBoundary}
    <Tooltip
      open={tooltipOpen}
      boundary={svgBoundary}
      x={tooltipX}
      y={tooltipY}
      preferredSide="top"
      sideOffset={10}
      showArrow={true}
    >
      {#if tooltipData}
        <div class="flex flex-col text-left font-sans">
          <span class="font-bold">Year: {tooltipData.year}</span>
          <span class="capitalize">{key}: {tooltipData[key]}</span>
        </div>
      {/if}
    </Tooltip>
  {/if}
</div>
