<script lang="ts">
import type { Snippet } from "svelte";
import type { TransitionConfig } from "svelte/transition";
import { fade } from "svelte/transition";
import { Tween } from "svelte/motion";
import { cubicOut } from "svelte/easing";
import { cn } from "$lib/utils.js";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

// A helper type for transition functions
type TransitionFn = (node: Element, params?: any) => TransitionConfig;

interface TooltipProps {
  x: number;
  y: number;
  open: boolean;
  boundary?: HTMLElement | null;
  preferredSide?: Side;
  sideOffset?: number; // Distance from cursor to tooltip edge
  align?: Align;
  alignOffset?: number;
  showArrow?: boolean;
  arrowPadding?: number;
  collisionPadding?: number;
  inTransition?: TransitionFn;
  inTransitionParams?: any;
  outTransition?: TransitionFn;
  outTransitionParams?: any;
  children?: Snippet;
  class?: string;
  arrowClass?: string;
  description?: string;
  ref?: HTMLDivElement | null;
}

let {
  x,
  y,
  open,
  boundary = null,
  preferredSide = "right",
  sideOffset = 20, // Increased from 10 to 20 for better spacing
  align = "center",
  alignOffset = 0,
  showArrow = false,
  arrowPadding = 8,
  collisionPadding = 8,
  // Provide safe defaults for transitions to prevent errors
  inTransition = fade,
  inTransitionParams = { duration: 150 },
  outTransition = fade,
  outTransitionParams = { duration: 100 },
  children,
  class: className,
  arrowClass,
  description,
  ref = $bindable(null),
  ...restProps
}: TooltipProps = $props();

let tooltipElement = $state<HTMLDivElement | null>(null);
let actualSide = $state<Side>(preferredSide);
let actualAlign = $state<Align>(align);
let arrowStyle = $state("");

// Use tweens for smooth position changes
const tooltipPos = {
  x: new Tween(0, { duration: 75, easing: cubicOut }),
  y: new Tween(0, { duration: 75, easing: cubicOut }),
};

function getViewportBounds() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

$effect(() => {
  if (tooltipElement) {
    ref = tooltipElement;
  }
});

$effect(() => {
  if (!open || !tooltipElement || !boundary) return;

  const boundaryRect = boundary.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const viewport = getViewportBounds();

  // Cursor position in viewport coordinates
  const cursorX = boundaryRect.left + x;
  const cursorY = boundaryRect.top + y;

  // Add a small offset to prevent tooltip from appearing directly under cursor
  const cursorOffset = 5;

  // Calculate available space from cursor position
  const spaceTop = cursorY - collisionPadding;
  const spaceBottom = viewport.height - cursorY - collisionPadding;
  const spaceLeft = cursorX - collisionPadding;
  const spaceRight = viewport.width - cursorX - collisionPadding;

  // Also check boundary constraints
  const boundarySpaceTop = cursorY - boundaryRect.top - collisionPadding;
  const boundarySpaceBottom = boundaryRect.bottom - cursorY - collisionPadding;
  const boundarySpaceLeft = cursorX - boundaryRect.left - collisionPadding;
  const boundarySpaceRight = boundaryRect.right - cursorX - collisionPadding;

  // Use the minimum of viewport and boundary constraints
  const availableSpace = {
    top: Math.min(spaceTop, boundarySpaceTop),
    bottom: Math.min(spaceBottom, boundarySpaceBottom),
    left: Math.min(spaceLeft, boundarySpaceLeft),
    right: Math.min(spaceRight, boundarySpaceRight),
  };

  // Check if preferred side has enough space
  let bestSide = preferredSide;
  const hasSpace = {
    top: availableSpace.top >= tooltipRect.height + sideOffset + cursorOffset,
    bottom: availableSpace.bottom >= tooltipRect.height + sideOffset + cursorOffset,
    left: availableSpace.left >= tooltipRect.width + sideOffset + cursorOffset,
    right: availableSpace.right >= tooltipRect.width + sideOffset + cursorOffset,
  };

  if (!hasSpace[preferredSide]) {
    // Find the side with the most space
    const sides: Side[] = ["right", "left", "bottom", "top"];
    bestSide = sides.reduce(
      (best, side) => (availableSpace[side] > availableSpace[best] ? side : best),
      sides[0]
    );
  }
  actualSide = bestSide;

  // Calculate tooltip position based on the chosen side
  let tooltipX = cursorX;
  let tooltipY = cursorY;

  // Adjust base position based on side
  switch (actualSide) {
    case "top":
      tooltipY = cursorY - tooltipRect.height - sideOffset - cursorOffset;
      // For top/bottom, center horizontally by default
      tooltipX = cursorX - tooltipRect.width / 2;
      break;
    case "bottom":
      tooltipY = cursorY + sideOffset + cursorOffset;
      // For top/bottom, center horizontally by default
      tooltipX = cursorX - tooltipRect.width / 2;
      break;
    case "left":
      tooltipX = cursorX - tooltipRect.width - sideOffset - cursorOffset;
      // For left/right, center vertically by default
      tooltipY = cursorY - tooltipRect.height / 2;
      break;
    case "right":
      tooltipX = cursorX + sideOffset + cursorOffset;
      // For left/right, center vertically by default
      tooltipY = cursorY - tooltipRect.height / 2;
      break;
  }

  // Apply alignment adjustments
  let effectiveAlign = align;
  if (actualSide === "top" || actualSide === "bottom") {
    // Horizontal alignment adjustments
    switch (align) {
      case "start":
        tooltipX = cursorX - alignOffset;
        break;
      case "center":
        // Already centered above
        break;
      case "end":
        tooltipX = cursorX - tooltipRect.width + alignOffset;
        break;
    }
  } else {
    // Vertical alignment adjustments for left/right
    switch (align) {
      case "start":
        tooltipY = cursorY - alignOffset;
        break;
      case "center":
        // Already centered above
        break;
      case "end":
        tooltipY = cursorY - tooltipRect.height + alignOffset;
        break;
    }
  }

  // Ensure tooltip stays within viewport bounds
  const originalX = tooltipX;
  const originalY = tooltipY;

  tooltipX = Math.max(
    collisionPadding,
    Math.min(tooltipX, viewport.width - tooltipRect.width - collisionPadding)
  );
  tooltipY = Math.max(
    collisionPadding,
    Math.min(tooltipY, viewport.height - tooltipRect.height - collisionPadding)
  );

  // Ensure tooltip stays within boundary bounds if boundary is specified
  const minX = boundaryRect.left + collisionPadding;
  const maxX = boundaryRect.right - tooltipRect.width - collisionPadding;
  const minY = boundaryRect.top + collisionPadding;
  const maxY = boundaryRect.bottom - tooltipRect.height - collisionPadding;

  tooltipX = Math.max(minX, Math.min(tooltipX, maxX));
  tooltipY = Math.max(minY, Math.min(tooltipY, maxY));

  // Detect if alignment was adjusted due to collision
  if (tooltipX !== originalX || tooltipY !== originalY) {
    actualAlign = "start"; // Visual indication that alignment was adjusted
  } else {
    actualAlign = align;
  }

  // Update tooltip position
  tooltipPos.x.target = tooltipX;
  tooltipPos.y.target = tooltipY;

  // Calculate arrow position
  const relCursorX = cursorX - tooltipX;
  const relCursorY = cursorY - tooltipY;

  if (actualSide === "top" || actualSide === "bottom") {
    const arrowX = Math.max(arrowPadding, Math.min(relCursorX, tooltipRect.width - arrowPadding));
    arrowStyle = `left: ${arrowX}px;`;
  } else {
    const arrowY = Math.max(arrowPadding, Math.min(relCursorY, tooltipRect.height - arrowPadding));
    arrowStyle = `top: ${arrowY}px;`;
  }
});

// Default tooltip styles that can be overridden
const defaultTooltipClass =
  "pointer-events-none fixed z-50 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-md dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50";

const defaultArrowClass = "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950";
</script>

{#if open}
  <div
    bind:this={tooltipElement}
    role="tooltip"
    data-state={open ? "open" : "closed"}
    data-side={actualSide}
    data-align={actualAlign}
    data-slot="tooltip"
    class={cn(defaultTooltipClass, className)}
    style="left: {tooltipPos.x.current}px; top: {tooltipPos.y.current}px;"
    in:inTransition={inTransitionParams}
    out:outTransition={outTransitionParams}
    {...restProps}
  >
    {@render children?.()}
    {#if showArrow}
      <div
        data-slot="tooltip-arrow"
        class={cn(
          "absolute -z-10 size-2.5 rotate-45 border",
          "data-[side=bottom]:-top-[6px] data-[side=bottom]:border-t-0 data-[side=bottom]:border-l-0",
          "data-[side=left]:-right-[6px] data-[side=left]:border-b-0 data-[side=left]:border-l-0",
          "data-[side=right]:-left-[6px] data-[side=right]:border-t-0 data-[side=right]:border-r-0",
          "data-[side=top]:-bottom-[6px] data-[side=top]:border-r-0 data-[side=top]:border-b-0",
          defaultArrowClass,
          arrowClass
        )}
        style={arrowStyle}
        data-side={actualSide}
      ></div>
    {/if}
  </div>
{/if}
