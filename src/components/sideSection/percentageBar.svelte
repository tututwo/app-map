<script lang="ts">
import type { Snippet } from "svelte";
import { Tween, prefersReducedMotion } from "svelte/motion";
import { untrack } from "svelte";

interface Props {
  title?: string;
  currentValueDisplay?: string;
  currentValue?: number;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  averageValue?: number;
  averageLabel?: string;
  uniqueIdBase?: string;
  description?: string;
  additionalInfo?: Snippet;
  animationDuration?: number;
  overrideWidth?: number | null;
  forceStatic?: boolean; // <-- Add this
}

let {
  title = "Default Title",
  currentValueDisplay = "0",
  currentValue = 0,
  minValue = 0,
  maxValue = 100,
  minLabel = "0",
  maxLabel = "100",
  averageValue = undefined,
  averageLabel = undefined,
  uniqueIdBase = "stat",
  description = undefined,
  additionalInfo = undefined,
  animationDuration = 500,
  overrideWidth = null,
  forceStatic = false,
}: Props = $props();

// Use a simple const instead of $state for static values
const titleId = `${uniqueIdBase}-title-${crypto.randomUUID().slice(0, 8)}`;
const descriptionId = description
  ? `${uniqueIdBase}-desc-${crypto.randomUUID().slice(0, 8)}`
  : undefined;

// Calculate the actual percentage values
const valuePercent = $derived(
  maxValue === minValue
    ? 0
    : Math.max(0, Math.min(100, ((currentValue - minValue) / (maxValue - minValue)) * 100))
);

const averagePercent = $derived(
  averageValue === undefined || maxValue === minValue
    ? undefined
    : Math.max(0, Math.min(100, ((averageValue - minValue) / (maxValue - minValue)) * 100))
);

// Create animated values using Tween
const animatedValuePercent = new Tween(valuePercent, {
  duration: animationDuration,
  easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
});

const animatedAveragePercent =
  averagePercent !== undefined
    ? new Tween(averagePercent, {
        duration: animationDuration,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      })
    : undefined;

// Update tween targets when values change
$effect(() => {
  // Respect user's motion preferences or static mode
  const duration = prefersReducedMotion.current || forceStatic ? 0 : animationDuration;

  animatedValuePercent.set(valuePercent, { duration });

  if (animatedAveragePercent && averagePercent !== undefined) {
    animatedAveragePercent.set(averagePercent, { duration });
  }
});
// --- ADD THIS DERIVED STATE ---
// This will decide what width to display and what will-change style to use.
// --- AND THIS ONE ---
const displayWidth = $derived(
  forceStatic ? valuePercent : overrideWidth !== null ? overrideWidth : animatedValuePercent.current
);

const displayAveragePercent = $derived(
  forceStatic && averagePercent !== undefined
    ? averagePercent
    : (animatedAveragePercent?.current ?? 0)
);

// Computed values for accessibility
const progressBarAriaLabel = $derived(
  `${title}: ${currentValueDisplay}, range ${minLabel} to ${maxLabel}${
    averageValue !== undefined ? `, average ${averageLabel || averageValue}` : ""
  }`
);

const valuePercentRounded = $derived(Math.round(animatedValuePercent.current));
const averagePercentRounded = $derived(
  animatedAveragePercent ? Math.round(animatedAveragePercent.current) : undefined
);

// This effect is removed as it's a duplicate of the one above
</script>

<article class="w-full" role="region" aria-labelledby={titleId} aria-describedby={descriptionId}>
  <header class="">
    <h2 id={titleId} class="text-sm">
      {title}
    </h2>
    {#if description}
      <p id={descriptionId} class="mt-1 text-sm text-gray-600">
        {description}
      </p>
    {/if}
  </header>

  <div class="flex items-center gap-x-2">
    <!-- Current value display with baseline alignment to progress bar -->
    <div
      class="w-auto min-w-[6rem] shrink-0 self-end pt-2 text-left"
      aria-live="polite"
      aria-atomic="true"
    >
      <span class="text-xl font-medium text-gray-900 tabular-nums">
        {currentValueDisplay}
      </span>
      <span class="sr-only">out of {maxLabel}</span>
    </div>

    <div class="flex-1">
      <!-- Scale labels with better positioning -->
      <div class="relative h-4" aria-hidden="true">
        <span class="absolute bottom-0 left-0 text-xs font-medium text-gray-600">
          {minLabel}
        </span>
        {#if averagePercent !== undefined && averageLabel}
          <span
            class="absolute bottom-1 text-xs font-light whitespace-nowrap text-gray-600 transition-all"
            style="left: {displayAveragePercent}%; transition-duration: {prefersReducedMotion.current ||
            forceStatic
              ? '0ms'
              : `${animationDuration}ms`};"
          >
            {averageLabel}
          </span>
        {/if}
        <span class="absolute right-0 bottom-0 text-xs font-medium text-gray-600">
          {maxLabel}
        </span>
      </div>

      <!-- Progress bar container -->
      <div class="relative">
        <div
          class="relative h-4 w-full overflow-hidden bg-gray-200"
          role="progressbar"
          aria-valuenow={currentValue}
          aria-valuemin={minValue}
          aria-valuemax={maxValue}
          aria-valuetext={`${currentValueDisplay} (${Math.round(valuePercent)}%)`}
          aria-label={progressBarAriaLabel}
        >
          <div
            class="absolute top-0 left-0 h-full bg-[#00C288]"
            style="width: {displayWidth}%; {prefersReducedMotion.current || forceStatic
              ? ''
              : 'will-change: width;'}"
          >
            <span class="sr-only">{valuePercentRounded}% complete</span>
          </div>
        </div>

        <!-- Average marker with enhanced visibility and animation -->
        {#if averagePercent !== undefined}
          <div
            class="absolute top-[-4px] bottom-[-4px] flex items-center transition-all"
            style="left: {displayAveragePercent}%; transition-duration: {prefersReducedMotion.current ||
            forceStatic
              ? '0ms'
              : `${animationDuration}ms`};"
            role="img"
            aria-label={`Average: ${averageLabel || averageValue} (${averagePercentRounded}%)`}
          >
            <div class="h-full w-0.5 bg-gray-700"></div>
            <!-- Radio circle to highlight the bar -->
            <!-- <div
              class="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-700 ring-2 ring-white"
            ></div> -->
          </div>
        {/if}
      </div>

      <!-- Additional context for screen readers -->
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        Progress: {Math.round(valuePercent)}% complete.
        {#if averagePercent !== undefined}
          Average is at {Math.round(averagePercent)}%.
        {/if}
      </div>
    </div>
  </div>

  {#if additionalInfo}
    <div class="mt-3 text-sm text-gray-600">
      {@render additionalInfo()}
    </div>
  {/if}

  <hr class="my-2 border-t border-gray-200" />
</article>

<style>
/* Add focus-visible styles for better keyboard navigation indication */
:global(:focus-visible) {
  outline: 2px solid #0ea5e9;
  outline-offset: 2px;
}

/* Ensure smooth number transitions */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
