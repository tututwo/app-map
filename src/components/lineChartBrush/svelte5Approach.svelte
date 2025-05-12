<script lang="ts">
  import * as d3 from 'd3';

  // --- Component Dimensions (could be $props) ---
  const width = 800;
  const height = 150;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  // --- D3 Scale (derived from dimensions) ---
  const x = $derived(
    d3.scaleTime()
      .domain([
        new Date(2013, 7, 1), // August 1, 2013
        // Calculate end date similar to original: start + width/60 days
        new Date(new Date(2013, 7, 1).getTime() + (width / 60) * 24 * 60 * 60 * 1000 -1)
      ])
      .rangeRound([margin.left, width - margin.right])
  );

  // --- Tick Data Calculation (derived from scale and dimensions) ---
  const interval = d3.timeHour.every(12);

  const gridTicks = $derived(x.ticks(interval));
  // Length of the grid lines, going upwards from the axis line
  const gridTickLength = $derived(-(height - margin.bottom - margin.top));

  const dayTicks = $derived(x.ticks(d3.timeDay));
  // Format for day tick labels (e.g., "1", "2", "15")
  const dayTickFormat = $derived(d3.timeFormat("%e")); // %e is day of month, padded with space

  // --- Refs for D3 interaction ---
  let brushGroupEl = $state<SVGGElement>(); // Element for D3 brush to attach to

  // --- D3 Brush Setup and Interaction Logic ---
  $effect(() => {
    if (!brushGroupEl) {
      return; // Wait for the brush group element to be available
    }

    const d3BrushGroup = d3.select(brushGroupEl);

    // Traditional function for brushended to maintain `this` context
    function brushended(this: SVGGElement, event: d3.D3BrushEvent<unknown>) {
      const selection = event.selection;
      if (!event.sourceEvent || !selection) { // Critical: avoid infinite loop on programmatic move
        return;
      }

      const [x0Pixel, x1Pixel] = selection as [number, number];
      const d0 = x.invert(x0Pixel);
      const d1 = x.invert(x1Pixel);

      const roundedX0 = interval.round(d0);
      const roundedX1 = interval.round(d1);

      const targetSelection = d3.select(this); // `this` is brushGroupEl

      if (roundedX1 <= roundedX0) {
        targetSelection.call(brush.move, null); // Clear brush
      } else {
        targetSelection.transition().call(brush.move, [roundedX0, roundedX1].map(val => x(val)));
      }
    }

    const brush = d3.brushX()
      .extent([
        [margin.left, margin.top], // Use full chart drawing area for brush extent
        [width - margin.right, height - margin.bottom]
      ])
      .on("end", brushended);

    d3BrushGroup.call(brush);

    // Cleanup function for the effect
    return () => {
      if (brushGroupEl) {
        // Remove brush listeners and clear its visual state
        // Calling brush.move with null clears the selection.
        // Setting .on to null removes all listeners for that event type.
        d3.select(brushGroupEl).call(brush.move, null).on(".brush", null);
      }
    };
  });

</script>

<div class="chart-container">
  <svg viewBox="0 0 {width} {height}" style="width: {width}px; height: {height}px;">
    <g class="x-axis" transform="translate(0, {height - margin.bottom})">
      <path
        class="domain-grid-background"
        d="M{x.range()[0]},{0}H{x.range()[1]}"
        fill="#ddd"
        stroke="none"
      />

      {#each gridTicks as tickValue (tickValue.getTime())}
        <line
          class="grid-line"
          x1={x(tickValue)}
          y1={0}
          x2={x(tickValue)}
          y2={gridTickLength}
          stroke="#fff"
          stroke-opacity={tickValue <= d3.timeDay(tickValue) ? 1 : 0.5}
        />
      {/each}

      {#each dayTicks as tickValue (tickValue.getTime())}
        <g class="day-tick-label" transform="translate({x(tickValue)}, 0)">
          <text
            x={6}
            dy="0.71em"
            fill="currentColor"
            style="text-anchor: start;"
          >
            {dayTickFormat(tickValue).trim()} 
          </text>
        </g>
      {/each}
    </g>

    <g class="brush-group" bind:this={brushGroupEl}></g>
  </svg>
</div>

<style>
  .chart-container {
    display: inline-block;
    border: 1px solid #ccc;
  }
  .x-axis text {
    font-size: 10px;
  }
  /* D3 brush styles (default ones are usually applied by D3) */
  /* You might need to ensure they are loaded or define custom ones if needed */
  :global(.brush-group .selection) {
    fill: steelblue;
    fill-opacity: 0.3;
    stroke: steelblue;
  }
  :global(.brush-group .handle) {
    fill: #555;
    stroke: #ddd;
  }
</style>