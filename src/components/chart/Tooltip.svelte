<script lang="ts">
import type { Snippet } from "svelte";
import type { TransitionConfig } from "svelte/transition";
import { fade } from "svelte/transition";
import { Tween } from "svelte/motion";
import { cubicOut } from "svelte/easing";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

// A helper type for transition functions
type TransitionFn = (node: Element, params?: any) => TransitionConfig;

interface Props {
  x: number;
  y: number;
  open: boolean;
  boundary?: HTMLElement | null;
  preferredSide?: Side;
  sideOffset?: number;
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
}

let {
  x,
  y,
  open,
  boundary = null,
  preferredSide = "right",
  sideOffset = 10,
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
}: Props = $props();

let tooltipElement = $state<HTMLElement | null>(null);
let actualSide = $state<Side>(preferredSide);
let arrowStyle = $state("");

// Use tweens for smooth position changes
const pos = {
  x: new Tween(0, { duration: 75, easing: cubicOut }),
  y: new Tween(0, { duration: 75, easing: cubicOut }),
};

$effect(() => {
  if (!boundary) return;

  const boundaryRect = boundary.getBoundingClientRect();
  pos.x.target = boundaryRect.left + x;
  pos.y.target = boundaryRect.top + y;

  if (!open || !tooltipElement) return;

  const rect = tooltipElement.getBoundingClientRect();
  const viewportX = pos.x.current;
  const viewportY = pos.y.current;

  // --- Collision Detection ---
  const spaceTop = viewportY - (boundaryRect.top + collisionPadding);
  const spaceBottom = boundaryRect.bottom - collisionPadding - viewportY;
  const spaceLeft = viewportX - (boundaryRect.left + collisionPadding);
  const spaceRight = boundaryRect.right - collisionPadding - viewportX;

  let bestSide = preferredSide;
  const hasSpace = {
    top: spaceTop >= rect.height + sideOffset,
    bottom: spaceBottom >= rect.height + sideOffset,
    left: spaceLeft >= rect.width + sideOffset,
    right: spaceRight >= rect.width + sideOffset,
  };

  if (!hasSpace[preferredSide]) {
    const sides: Side[] = ["right", "left", "bottom", "top"];
    const space = { right: spaceRight, left: spaceLeft, bottom: spaceBottom, top: spaceTop };
    bestSide = sides.sort((a, b) => space[b] - space[a])[0];
  }
  actualSide = bestSide;

  // --- Arrow Positioning ---
  const cursorXInTooltip = viewportX - rect.left;
  const cursorYInTooltip = viewportY - rect.top;

  if (actualSide === "top" || actualSide === "bottom") {
    arrowStyle = `left: clamp(${arrowPadding}px, ${cursorXInTooltip}px, calc(100% - ${arrowPadding}px));`;
  } else {
    arrowStyle = `top: clamp(${arrowPadding}px, ${cursorYInTooltip}px, calc(100% - ${arrowPadding}px));`;
  }
});
</script>

{#if open}
  <div
    bind:this={tooltipElement}
    role="tooltip"
    data-state={open ? "open" : "closed"}
    data-side={actualSide}
    data-align={align}
    class="pointer-events-none fixed z-50 rounded-md border bg-white px-3 py-1.5 text-sm text-gray-900 shadow-md
           
           data-[side=bottom]:translate-y-[var(--side-offset)]
           data-[side=bottom]:data-[align=center]:-translate-x-1/2
           data-[side=bottom]:data-[align=end]:-translate-x-[calc(100%_-_var(--align-offset))]
           data-[side=bottom]:data-[align=start]:-translate-x-[var(--align-offset)]
           
           data-[side=left]:-translate-x-[calc(100%_+_var(--side-offset))]
           data-[side=left]:data-[align=center]:-translate-y-1/2
           data-[side=left]:data-[align=end]:-translate-y-[calc(100%_-_var(--align-offset))]
           data-[side=left]:data-[align=start]:-translate-y-[var(--align-offset)]
           data-[side=right]:translate-x-[var(--side-offset)]
           data-[side=right]:data-[align=center]:-translate-y-1/2
           
           data-[side=right]:data-[align=end]:-translate-y-[calc(100%_-_var(--align-offset))]
           data-[side=right]:data-[align=start]:-translate-y-[var(--align-offset)]
           data-[side=top]:-translate-y-[calc(100%_+_var(--side-offset))]
           data-[side=top]:data-[align=center]:-translate-x-1/2
           data-[side=top]:data-[align=end]:-translate-x-[calc(100%_-_var(--align-offset))]
           data-[side=top]:data-[align=start]:-translate-x-[var(--align-offset)]"
    style="left: {pos.x.current}px; top: {pos.y
      .current}px; --side-offset: {sideOffset}px; --align-offset: {alignOffset}px;"
    in:inTransition={inTransitionParams}
    out:outTransition={outTransitionParams}
  >
    {@render children?.()}
    {#if showArrow}
      <div
        class="absolute -z-10 size-2.5 rotate-45 border bg-white
               data-[side=bottom]:top-0 data-[side=bottom]:translate-y-[-50%] data-[side=bottom]:border-t-0 data-[side=bottom]:border-l-0
               data-[side=left]:right-0 data-[side=left]:-translate-x-1/2 data-[side=left]:border-b-0 data-[side=left]:border-l-0
               data-[side=right]:left-0 data-[side=right]:translate-x-[-50%] data-[side=right]:border-t-0 data-[side=right]:border-r-0
               data-[side=top]:bottom-0 data-[side=top]:-translate-y-1/2 data-[side=top]:border-r-0 data-[side=top]:border-b-0"
        style={arrowStyle}
        data-side={actualSide}
      />
    {/if}
  </div>
{/if}
