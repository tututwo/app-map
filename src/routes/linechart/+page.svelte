<script lang="ts">
import brushLine from "$data/line/brushLine.csv";
import Figure from "$components/Figure.svelte";
import * as d3 from "d3";

// --- Component Dimensions (could be $props) ---
const width = 800;
const height = 150;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };

// --- D3 Scale (derived from dimensions) ---
const x = $derived(
  d3
    .scaleTime()
    .domain([
      new Date(2013, 7, 1), // August 1, 2013
      // Calculate end date similar to original: start + width/60 days
      new Date(new Date(2013, 7, 1).getTime() + (width / 60) * 24 * 60 * 60 * 1000 - 1),
    ])
    .rangeRound([margin.left, width - margin.right])
);

// --- Tick Data Calculation (derived from scale and dimensions) ---
const interval = d3.timeHour.every(12);

// const gridTicks = $derived(x.ticks(interval));
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
    if (!event.sourceEvent || !selection) {
      // Critical: avoid infinite loop on programmatic move
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
      targetSelection.transition().call(
        brush.move,
        [roundedX0, roundedX1].map((val) => x(val))
      );
    }
  }

  const brush = d3
    .brushX()
    .extent([
      [margin.left, margin.top], // Use full chart drawing area for brush extent
      [width - margin.right, height - margin.bottom],
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

<!-- svelte-ignore a11y_figcaption_parent -->
<section class="flex h-screen w-full items-center justify-center">
  <!-- @ts-ignore -->
  <Figure>
    <!-- Chart  -->

    <svg> </svg>
    <!-- Named slot: figcaption -->
    {#snippet figcaption()}
      <!-- svelte-ignore a11y_figcaption_parent -->
      <figcaption>
        <h1>Hello from figcaption</h1>
      </figcaption>
    {/snippet}
  </Figure>
</section>

<style>
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
