<script lang="ts">
  import * as d3 from 'd3';
  import { onMount } from 'svelte'; // Or $effect for Svelte 5 style lifecycle

  // --- Component Props (Optional, if you want to make it reusable) ---
  // let { initialWidth = 800, initialHeight = 150 } = $props();
  // For this example, let's use fixed dimensions as in the original.
  const width = 800;
  const height = 150;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  // --- Reactive State (if any part of the chart needs to be reactive) ---
  // let someReactiveData = $state([]); // Example

  // --- D3 setup will go into $effect or onMount ---
  let svgRef: SVGSVGElement | undefined = $state(); // To hold the SVG element reference

  $effect(() => {
    if (!svgRef) {
      return; 
    }

    const svgNode = svgRef;
    const d3Svg = d3.select(svgNode);
    d3Svg.selectAll("*").remove(); 

    const interval = d3.timeHour.every(12);

    const x = d3
      .scaleTime()
      .domain([new Date(2013, 7, 1), new Date(new Date(2013, 7, 1).getTime() + (width / 60) * 24*60*60*1000 -1 )])
      .rangeRound([margin.left, width - margin.right]);

    const xAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call((g_1) => // Renamed to avoid conflict with outer g
          g_1
            .append("g")
            .call(
              d3
                .axisBottom(x)
                .ticks(interval)
                .tickSize(-height + margin.top + margin.bottom)
                .tickFormat(() => null)
            )
            .call((g_2) => // Renamed
              g_2.select(".domain").attr("fill", "#ddd").attr("stroke", null)
            )
            .call((g_2) => // Renamed
              g_2
                .selectAll(".tick line")
                .attr("stroke", "#fff")
                .attr("stroke-opacity", (d) => (d && d <= d3.timeDay(d as Date) ? 1 : 0.5))
            )
        )
        .call((g_1) => // Renamed
          g_1
            .append("g")
            .call(d3.axisBottom(x).ticks(d3.timeDay).tickPadding(0))
            .attr("text-anchor", null)
            .call((g_2) => g_2.select(".domain").remove()) // Renamed
            .call((g_2) => g_2.selectAll("text").attr("x", 6)) // Renamed
        );

    // IMPORTANT CHANGE HERE: Define brushended as a traditional function
    function brushended(this: SVGGElement, event: d3.D3BrushEvent<unknown>) {
      const selection = event.selection;
      // The crucial check to prevent infinite loops with programmatic .move
      if (!event.sourceEvent || !selection) return; 

      const [x0Pixel, x1Pixel] = selection as [number, number];
      const d0 = x.invert(x0Pixel);
      const d1 = x.invert(x1Pixel);

      const roundedX0 = interval.round(d0);
      const roundedX1 = interval.round(d1);
      
      const brushSelection = d3.select(this); // `this` is the <g> element the brush is attached to

      if (roundedX1 <= roundedX0) { // If selection is empty or inverted
        brushSelection.call(brush.move, null); // Clear the brush
      } else {
        // Apply the rounded selection with a transition
        brushSelection.transition().call(brush.move, [roundedX0, roundedX1].map(x));
      }
    }

    const brush = d3
      .brushX()
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom]
      ])
      .on("end", brushended); // brushended is now a traditional function

    d3Svg.append("g").call(xAxis);

    // Create the <g> element for the brush and call the brush on it
    const brushGroup = d3Svg.append("g")
      .attr("class", "brush-group") // Keep class for clarity if needed elsewhere
      .call(brush);

    return () => {
      brush.on("end", null); // Clean up the listener
      d3Svg.selectAll("*").remove(); // More thorough cleanup of D3 elements
    };
  });

</script>

<div class="chart-container">
  <svg bind:this={svgRef} viewBox="0 0 {width} {height}" style="width: {width}px; height: {height}px;"></svg>
</div>

<style>
  .chart-container {
    display: inline-block; /* Or other layout as needed */
    border: 1px solid #ccc; /* Optional: for visual clarity */
  }
  /* Add any other styles for your chart or container */
</style>