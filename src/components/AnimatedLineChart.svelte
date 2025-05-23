<script>
// @ts-nocheck
import { gsap } from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { untrack } from "svelte";
import LineChart from "$components/lineChartBrush/lineChart.svelte";

// Register the plugin
gsap.registerPlugin(MorphSVGPlugin);

// Props - forwarding all LineChart props plus animation config
let {
  data,
  animationDuration = 1.2,
  animationEase = "power2.inOut",
  staggerDelay = 0.03,
  ...restProps
} = $props();

// State for tracking animation
let chartContainer = $state(null);
let isFirstRender = $state(true);
let previousDataRef = null; // Non-reactive reference
let animationTimeline = null; // Non-reactive reference

// Store references to animated elements
let pathElement = $state(null);
let circleElements = $state([]);
let innerHeight = $state(0);

// Effect to capture DOM elements after LineChart renders
$effect(() => {
  if (!chartContainer) return;

  // Find the path element
  const path = chartContainer.querySelector("path.fill-none.stroke-2");
  if (path) pathElement = path;

  // Find all circle elements
  const circles = chartContainer.querySelectorAll('circle[role="button"]');
  circleElements = Array.from(circles);

  // Get inner height for drop animations
  const chartG = chartContainer.querySelector("g[transform]");
  if (chartG) {
    const rect = chartG.querySelector("rect");
    if (rect) innerHeight = parseFloat(rect.getAttribute("height"));
  }
});

// Helper function to extract current positions from DOM
function getCurrentPositions() {
  if (!pathElement || circleElements.length === 0) return null;

  const positions = {
    path: pathElement.getAttribute("d"),
    circles: circleElements.map((circle) => ({
      element: circle,
      cx: parseFloat(circle.getAttribute("cx")),
      cy: parseFloat(circle.getAttribute("cy")),
      date: circle.getAttribute("aria-label")?.match(/\d{4}/)?.[0] || "",
    })),
  };

  return positions;
}

// Main animation effect - only triggers on data changes
$effect(() => {
  // Access data to create dependency
  data;

  // Skip animation on first render
  if (isFirstRender) {
    isFirstRender = false;
    previousDataRef = structuredClone(data);
    return;
  }

  // Skip if elements aren't ready
  if (!pathElement || circleElements.length === 0 || !previousDataRef) {
    previousDataRef = structuredClone(data);
    return;
  }

  // Execute animation logic without tracking
  untrack(() => {
    // Kill any existing timeline
    if (animationTimeline) {
      animationTimeline.kill();
    }

    // Store current positions before DOM updates
    const oldPositions = getCurrentPositions();
    if (!oldPositions) return;

    // Create data maps for matching
    const oldDataMap = new Map(previousDataRef.map((d) => [d.date, d]));
    const newDataMap = new Map(data.map((d) => [d.date, d]));

    // Categorize data points
    const exitingDates = previousDataRef.filter((d) => !newDataMap.has(d.date)).map((d) => d.date);
    const enteringDates = data.filter((d) => !oldDataMap.has(d.date)).map((d) => d.date);
    const persistingDates = data.filter((d) => oldDataMap.has(d.date)).map((d) => d.date);

    // Wait for DOM to update with new data
    requestAnimationFrame(() => {
      const newPositions = getCurrentPositions();
      if (!newPositions) return;

      // Create animation timeline
      animationTimeline = gsap.timeline({
        onComplete: () => {
          previousDataRef = structuredClone(data);
          animationTimeline = null;
        },
      });

      // Animate path morph
      if (oldPositions.path !== newPositions.path) {
        // Revert to old path for animation start
        pathElement.setAttribute("d", oldPositions.path);

        animationTimeline.to(
          pathElement,
          {
            attr: { d: newPositions.path },
            duration: animationDuration,
            ease: animationEase,
          },
          0
        );
      }

      // Handle circle animations
      const newCircleMap = new Map(newPositions.circles.map((c) => [c.date, c]));
      const oldCircleMap = new Map(oldPositions.circles.map((c) => [c.date, c]));

      // Exit animations - circles that are being removed
      oldPositions.circles.forEach((oldCircle, index) => {
        const year = oldCircle.date;
        const matchingDate = previousDataRef.find(
          (d) => new Date(d.date).getFullYear().toString() === year
        );

        if (matchingDate && exitingDates.includes(matchingDate.date)) {
          // This circle needs to exit
          animationTimeline.to(
            oldCircle.element,
            {
              cy: innerHeight,
              opacity: 0,
              duration: animationDuration * 0.6,
              ease: "power2.in",
            },
            index * staggerDelay
          );
        }
      });

      // Enter animations - new circles
      newPositions.circles.forEach((newCircle, index) => {
        const year = newCircle.date;
        const matchingDate = data.find((d) => new Date(d.date).getFullYear().toString() === year);

        if (matchingDate && enteringDates.includes(matchingDate.date) && !oldCircleMap.has(year)) {
          // This is a new circle - start from bottom
          gsap.set(newCircle.element, {
            cy: innerHeight,
            opacity: 0,
          });

          // Animate to final position
          animationTimeline.to(
            newCircle.element,
            {
              cy: newCircle.cy,
              opacity: 1,
              duration: animationDuration * 0.8,
              ease: "power2.out",
            },
            animationDuration * 0.3 + index * staggerDelay
          );
        }
      });

      // Update animations - circles that persist but move
      newPositions.circles.forEach((newCircle, index) => {
        const year = newCircle.date;
        const oldCircle = oldCircleMap.get(year);
        const matchingDate = data.find((d) => new Date(d.date).getFullYear().toString() === year);

        if (oldCircle && matchingDate && persistingDates.includes(matchingDate.date)) {
          // Check if position changed
          if (Math.abs(oldCircle.cy - newCircle.cy) > 1) {
            // Set to old position first
            gsap.set(newCircle.element, {
              cy: oldCircle.cy,
            });

            // Animate to new position
            animationTimeline.to(
              newCircle.element,
              {
                cy: newCircle.cy,
                duration: animationDuration,
                ease: animationEase,
              },
              index * staggerDelay * 0.5
            );
          }
        }
      });
    });
  });
});

// Cleanup on unmount
$effect(() => {
  return () => {
    if (animationTimeline) {
      animationTimeline.kill();
      animationTimeline = null;
    }
  };
});
</script>

<div bind:this={chartContainer}>
  <LineChart {data} {...restProps} />
</div>
