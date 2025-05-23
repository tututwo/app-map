<script>
// @ts-nocheck
import * as d3 from "d3";
import { untrack, getContext } from "svelte";
import { scale } from "svelte/transition";
import { elasticOut } from "svelte/easing";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

// Register GSAP plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(MorphSVGPlugin);
}

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
  xTickPosition = "top",
  yTickPosition = "left",
  showXGridlines = true,
  showYGridlines = true,
  showChartBorder = true,
  xTickCount = null,
  yTickCount = 5,
  tickLength = 6,
  tickOffset = 20,
  enableBrushing = true,
  // Animation props
  enableAnimation = true,
  animationDuration = 1,
  animationEase = "power2.inOut",
  staggerDelay = 0.02,
} = $props();

// State variables
let activePoint = $state(null);
let hoveredPoint = $state(null);
let brushSelection = $state(enableBrushing ? initialBrushSelection : null);
let brushPixelPositions = $state({ left: 0, right: 0, width: 0 });

// References
let brushGroupEl = $state(null);
let chartEl = $state(null);
let svgContainer = $state(null);
let pathElement = $state(null);
let circleContainer = $state(null);

// Animation state
let previousData = null;
let animationTimeline = null;
let isFirstRender = true;

// Format data with $derived
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

// Create scales
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

// Generate tick values
const xTicks = $derived(
  xTickCount ? xScale.ticks(xTickCount) : xScale.ticks(Math.min(formattedData.length, 13))
);
const yTicks = $derived(yScale.ticks(yTickCount));

// Animation effect
$effect(() => {
  if (!enableAnimation || !pathElement || !circleContainer) return;

  // Skip first render
  if (isFirstRender) {
    isFirstRender = false;
    previousData = [...data];
    return;
  }

  // Check if data changed
  const dataChanged = JSON.stringify(data) !== JSON.stringify(previousData);
  if (!dataChanged) return;

  untrack(() => {
    animateTransition();
  });
});

function animateTransition() {
  // Kill any existing animations
  if (animationTimeline) {
    animationTimeline.kill();
  }

  // Create data maps
  const oldDataMap = new Map(previousData.map((d) => [d.date, d]));
  const newDataMap = new Map(data.map((d) => [d.date, d]));

  // Get circles
  const circles = circleContainer.querySelectorAll("circle");
  const circleArray = Array.from(circles);

  // Create timeline
  animationTimeline = gsap.timeline({
    onComplete: () => {
      previousData = [...data];
    },
  });

  // 1. Animate path morph
  const oldPath = pathElement.getAttribute("d");
  animationTimeline.to(
    pathElement,
    {
      morphSVG: linePath,
      duration: animationDuration,
      ease: animationEase,
    },
    0
  );

  // 2. Handle exiting circles (drop animation)
  previousData.forEach((oldPoint, index) => {
    if (!newDataMap.has(oldPoint.date) && circles[index]) {
      animationTimeline.to(
        circles[index],
        {
          cy: innerHeight,
          opacity: 0,
          duration: animationDuration * 0.6,
          ease: "power2.in",
          onComplete: function () {
            this.targets()[0].style.display = "none";
          },
        },
        0
      );
    }
  });

  // 3. Handle persisting circles (move animation)
  formattedData.forEach((point, newIndex) => {
    const oldIndex = previousData.findIndex((d) => d.date === point.date);
    if (oldIndex !== -1 && circles[oldIndex]) {
      const circle = circles[oldIndex];
      const newX = xScale(point.date);
      const newY = yScale(point.close);

      animationTimeline.to(
        circle,
        {
          cx: newX,
          cy: newY,
          duration: animationDuration,
          ease: animationEase,
        },
        0
      );
    }
  });

  // 4. Handle entering circles (rise animation)
  formattedData.forEach((point, index) => {
    if (!oldDataMap.has(point.date)) {
      // Create new circle
      setTimeout(() => {
        const newCircles = circleContainer.querySelectorAll("circle");
        const newCircle = newCircles[index];
        if (newCircle) {
          const targetY = yScale(point.close);

          // Set initial position
          gsap.set(newCircle, {
            cy: innerHeight,
            opacity: 0,
          });

          // Animate rise
          animationTimeline.to(
            newCircle,
            {
              cy: targetY,
              opacity: 1,
              duration: animationDuration * 0.8,
              ease: "power2.out",
              delay: index * staggerDelay,
            },
            animationDuration * 0.4
          );
        }
      }, 50);
    }
  });
}

// Format functions
function formatDate(date) {
  return date.getFullYear().toString();
}

// Mouse events
function showTooltip(event, point) {
  activePoint = point;
  hoveredPoint = point;
}

function hideTooltip() {
  activePoint = null;
  hoveredPoint = null;
}

// Other helper functions remain the same...
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

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

function isPointOutsideSelection(point) {
  return brushSelection && (point.date < brushSelection[0] || point.date > brushSelection[1]);
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

// Brush implementation (keeping your existing code)
let brush;
let brushGroup;

$effect(() => {
  if (!enableBrushing || !brushGroupEl || !width || !height) return;

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

  brushGroup.select(".selection").attr("fill", "transparent").attr("stroke", "none");
  brushGroup.select(".overlay").attr("fill", "transparent");
  brushGroup
    .selectAll(".handle")
    .attr("fill", "hsla(162, 100%, 38%, 1)")
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .attr("rx", 2);

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
  if (enableBrushing && chartEl && brushSelection && svgContainer) {
    updateBrushPixelPositions();
  }
});
</script>

<div class="relative h-full w-full" bind:this={svgContainer}>
  <svg {width} {height} class="h-full w-full">
    <g transform={`translate(${margin.left},${margin.top})`} bind:this={chartEl}>
      <!-- Background -->
      <rect x={0} y={0} width={innerWidth} height={innerHeight} fill={chartBackgroundColor} />

      <!-- Selection rectangle -->
      {#if enableBrushing && brushSelection && brushPixelPositions.width > 0}
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

      <!-- Grid lines -->
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
        />
      {/if}

      <!-- Axis ticks and labels (keeping your existing code) -->
      {#if xTickPosition !== "none"}
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

      {#if yTickPosition !== "none"}
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
        bind:this={pathElement}
        d={linePath}
        class="fill-none stroke-2"
        stroke={lineColor}
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Brush -->
      {#if enableBrushing}
        <g class="brush-group" bind:this={brushGroupEl}></g>
      {/if}

      <!-- Data points -->
      <g class="data-points" bind:this={circleContainer} style="pointer-events: all;">
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

  <!-- Tooltip -->
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
      <div
        class="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-t-4 border-r-4 border-l-4 border-t-gray-900 border-r-transparent border-l-transparent"
      ></div>
    </div>
  {/if}

  <!-- Year range pills -->
  {#if enableBrushing && brushSelection && brushPixelPositions.width > 0}
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
.animated-line-chart :global(path[d]) {
  will-change: d;
}

.animated-line-chart :global(circle) {
  will-change: transform, opacity, cx, cy;
}
</style>
