<script>
// @ts-nocheck
import * as d3 from "d3";
import { untrack, getContext } from "svelte";
import { scale } from "svelte/transition";
import { cubicOut } from "svelte/easing";
import { Tween } from "svelte/motion";

// Get responsive dimensions from Figure context
const figure = getContext("Figure");
const width = $derived(figure.getWidth());
const height = $derived(figure.getHeight());

// Component props
let {
  data,
  margin = { top: 50, right: 30, bottom: 80, left: 80 },
  initialBrushSelection = null,
  chartBackgroundColor = "hsla(206, 100%, 96%, 1)",
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
  enableBrushing = true, // New prop to enable/disable brushing
} = $props();

// ------------------------------------------------------------
// Brush Tween
// ------------------------------------------------------------
// Default options for the snapping animation
const tweenOptions = {
  duration: 350,
  easing: cubicOut,
};

// Initialize with default/initial values.
// The actual initial brush position will be set in an effect once scales are ready.
const visualBrush = new Tween({ x: 0, width: 0 }, tweenOptions);

// For the pills, derive positions from the tween's current value and margins
const brushPillPositions = $derived({
  left: visualBrush.current.x + margin.left, // Access the current value via .current
  right: visualBrush.current.x + visualBrush.current.width + margin.left,
  width: visualBrush.current.width,
});

// State variables
let activePoint = $state(null);
let hoveredPoint = $state(null);

// Current brush selection (in date values)
let brushSelection = $state(enableBrushing ? initialBrushSelection : null);

// Calculated pixel positions for the brushed area

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

// Brush implementation
let brush;
let brushGroup;

// D3 Brush effect
$effect(() => {
  if (
    !enableBrushing ||
    !brushGroupEl ||
    !width ||
    !height ||
    !innerWidth ||
    !innerHeight ||
    !xScale.domain().length
  )
    return;

  const yearInterval = d3.timeYear;
  const minYearSpanRequired = 4; // Minimum 4 years in the selection
  const minYearDifference = minYearSpanRequired - 1; // e.g. 2010 to 2013 (4 years) has a difference of 3.

  function snapToClosestYear(date) {
    const floorDate = yearInterval.floor(date);
    const ceilDate = yearInterval.ceil(date);
    if (floorDate.getTime() === ceilDate.getTime()) return floorDate; // Already on a year boundary
    const distToFloor = date.getTime() - floorDate.getTime();
    const distToCeil = ceilDate.getTime() - date.getTime();
    return distToFloor < distToCeil ? floorDate : ceilDate;
  }

  if (!brush) {
    brush = d3
      .brushX()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .handleSize(8)
      .on("brush", (event) => {
        if (
          !event.sourceEvent ||
          event.sourceEvent.type === "zoom" ||
          event.sourceEvent.type === "end"
        )
          return;

        if (event.selection) {
          const [px0, px1] = event.selection;
          visualBrush.set({ x: px0, width: px1 - px0 }, { duration: 0 });
        } else {
          visualBrush.set({ x: 0, width: 0 }, { duration: 0 });
        }
      })
      .on("end", (event) => {
        if (!event.sourceEvent) return;

        const selection = event.selection;
        if (!selection) {
          untrack(() => {
            brushSelection = null;
          });
          visualBrush.set({ x: 0, width: 0 });
          return;
        }

        const [px0_transient, px1_transient] = selection;
        let d0_transient = xScale.invert(px0_transient);
        let d1_transient = xScale.invert(px1_transient);

        let d0_snapped = snapToClosestYear(d0_transient);
        let d1_snapped = snapToClosestYear(d1_transient);

        if (d0_snapped.getTime() === d1_snapped.getTime()) {
          // If snapped to the exact same year, extend d1 to meet minimum or by 1 year initially
          d1_snapped = yearInterval.offset(d0_snapped, 1); // Extend by at least one year first
        }
        // Ensure d0_snapped is before d1_snapped
        if (d0_snapped > d1_snapped) {
          [d0_snapped, d1_snapped] = [d1_snapped, d0_snapped];
        }

        // --- START: Enforce minimum 4-year selection ---
        const currentYearDifference = d1_snapped.getFullYear() - d0_snapped.getFullYear();

        if (currentYearDifference < minYearDifference) {
          d1_snapped = yearInterval.offset(d0_snapped, minYearDifference);
          // Optional: Check if d1_snapped exceeds the max domain of your data/xScale
          // and clamp it if necessary. For example:
          const maxDomainDate = xScale.domain()[1];
          if (d1_snapped > maxDomainDate) {
            // d1_snapped = maxDomainDate; // This would clamp it
            // If clamping changes d1_snapped, you might also need to adjust d0_snapped
            // to maintain the minimum span from the right edge, if possible.
            // For simplicity now, we'll let it potentially go over if not clamped.
            // Or, more robustly, adjust d0 backwards if d1 hits the end:
            // d1_snapped = snapToClosestYear(maxDomainDate); // Snap to a valid year at the end
            // d0_snapped = yearInterval.offset(d1_snapped, -minYearDifference);
            // d0_snapped = snapToClosestYear(d0_snapped); // Re-snap d0
            // if (d0_snapped < xScale.domain()[0]) d0_snapped = xScale.domain()[0]; // Clamp d0
          }
        }
        // --- END: Enforce minimum 4-year selection ---

        untrack(() => {
          brushSelection = [d0_snapped, d1_snapped];
        });

        const finalPixelX0 = xScale(d0_snapped);
        const finalPixelX1 = xScale(d1_snapped);

        visualBrush.set({ x: finalPixelX0, width: finalPixelX1 - finalPixelX0 });

        if (event.selection) {
          // event.selection should still be used for the .call here
          d3.select(brushGroupEl)
            .transition()
            .duration(tweenOptions.duration)
            .ease(d3.easeCubicOut)
            .call(brush.move, finalPixelX1 > finalPixelX0 ? [finalPixelX0, finalPixelX1] : null);
        }
      });
  }

  brushGroup = d3.select(brushGroupEl);
  brushGroup.call(brush);

  // Style D3 brush (make D3's selection rect transparent)
  brushGroup.select(".selection").attr("fill", "transparent").attr("stroke", "none");
  brushGroup.select(".overlay").attr("fill", "transparent");
  brushGroup
    .selectAll(".handle")
    .attr("fill", "hsla(162, 100%, 38%, 1)")
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .attr("rx", 2);

  // Handle initial brush selection
  // Ensure scales are initialized (xScale.domain().length check helps)
  if (initialBrushSelection && xScale.domain().length === 2) {
    // --- Apply minimum year span to initialBrushSelection too ---
    let [initial_d0, initial_d1] = initialBrushSelection.map((d) => new Date(d)); // Ensure they are date objects
    initial_d0 = snapToClosestYear(initial_d0);
    initial_d1 = snapToClosestYear(initial_d1);

    if (initial_d0.getTime() === initial_d1.getTime()) {
      initial_d1 = yearInterval.offset(initial_d0, 1);
    }
    if (initial_d0 > initial_d1) {
      [initial_d0, initial_d1] = [initial_d1, initial_d0];
    }
    const initialYearDiff = initial_d1.getFullYear() - initial_d0.getFullYear();
    if (initialYearDiff < minYearDifference) {
      initial_d1 = yearInterval.offset(initial_d0, minYearDifference);
      // Add clamping for initial_d1 against xScale.domain()[1] if needed
    }
    // Update the actual initialBrushSelection prop if possible, or just use these adjusted values
    // For now, we'll use these adjusted values for setting up the brush
    const initialPx0 = xScale(initial_d0);
    const initialPx1 = xScale(initial_d1);

    // Update brushSelection state with adjusted initial values
    // This ensures the pills show the correct initial range
    untrack(() => {
      brushSelection = [initial_d0, initial_d1];
    });

    visualBrush.set({ x: initialPx0, width: initialPx1 - initialPx0 }, { duration: 0 });
    if (brushGroupEl && brush) {
      d3.select(brushGroupEl).call(brush.move, [initialPx0, initialPx1]);
    }
  } else if (!initialBrushSelection) {
    visualBrush.set({ x: 0, width: 0 }, { duration: 0 });
    if (brushGroupEl && brush) {
      d3.select(brushGroupEl).call(brush.move, null);
    }
  }

  return () => {
    if (brushGroup) {
      brushGroup.on(".brush", null).on(".end", null);
    }
  };
});

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
      <rect x={0} y={0} width={innerWidth} height={innerHeight} fill={chartBackgroundColor} />

      <!-- White selection rectangle (Svelte-controlled for visual appearance) -->
      {#if enableBrushing && visualBrush.current.width > 0}
        <rect
          x={visualBrush.current.x}
          y={0}
          width={visualBrush.current.width}
          height={innerHeight}
          class="fill-white"
          pointer-events="none"
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
      {#if enableBrushing}
        <g class="brush-group" bind:this={brushGroupEl}></g>
      {/if}

      <!-- Data points (rendered after brush so they're on top) -->
      <g class="data-points" style="pointer-events: all;">
        {#each formattedData as point, i}
          <circle
            cx={xScale(point.date)}
            cy={yScale(point.close)}
            r={hoveredPoint === point ? circleHoverRadius : circleRadius}
            fill={enableBrushing && isPointOutsideSelection(point)
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
  {#if enableBrushing && brushSelection && brushPillPositions.width > 0}
    <div
      class="absolute z-10 -translate-x-1/2 transform rounded-sm bg-[#00C288] px-2 py-1 text-xs shadow-md"
      style="left: {brushPillPositions.left}px; top: {margin.top + innerHeight + 20}px;"
      aria-hidden={!brushSelection}
    >
      from <strong>{formatDate(brushSelection[0])}</strong>
    </div>

    <div
      class="absolute z-10 -translate-x-1/2 transform rounded-sm bg-[#00C288] px-2 py-1 text-xs shadow-md"
      style="left: {brushPillPositions.right}px; top: {margin.top + innerHeight + 20}px;"
      aria-hidden={!brushSelection}
    >
      to <strong>{formatDate(brushSelection[1])}</strong>
    </div>

    <div
      class="absolute z-10 text-xs font-medium text-emerald-500"
      style="left: {(brushPillPositions.left + brushPillPositions.right) / 2}px; top: {margin.top +
        innerHeight +
        10}px; transform: translateX(-50%);"
      aria-hidden={!brushSelection}
    >
      Selected year range
    </div>
  {/if}
</div>

<style>
/* Remove the global fadeIn animation since we're using Svelte transitions */
</style>
