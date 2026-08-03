<!-- adapted from Pudding :https://github.com/the-pudding/svelte-starter/blob/main/src/components/figure/migrate/Figure.svelte-->

<script>
import { setContext } from "svelte";

let {
  children,
  figcaption, // Named slot for figcaption
  visuallyHiddenCaption = true,
} = $props();

const uid = $props.id();
const captionId = `figure-caption-${uid}`;

// Dimensions bound to the chart container; Svelte's own ResizeObserver keeps them current.
// ponytail: no resize debounce — charts redraw per observer frame; wrap these in a
// debounced mirror if drag-resize redraw ever measures slow.
let figureWidth = $state(0);
let figureHeight = $state(0);

const hasDimensions = $derived(figureWidth > 0 && figureHeight > 0);

// Provide getter functions in the context for live values
setContext("Figure", {
  getWidth: () => figureWidth,
  getHeight: () => figureHeight,
});
</script>

<figure class="flex h-full w-full flex-col" aria-labelledby={figcaption ? captionId : undefined}>
  {#if figcaption}
    <figcaption
      id={captionId}
      class="mt-2 text-center text-sm text-gray-600"
      class:sr-only={visuallyHiddenCaption}
    >
      {@render figcaption()}
    </figcaption>
  {/if}
  <div
    class="relative h-full w-full flex-grow"
    bind:clientWidth={figureWidth}
    bind:clientHeight={figureHeight}
  >
    <div class="absolute inset-0">
      {#if hasDimensions && children}
        {@render children()}
      {:else}
        <div
          class="flex h-full w-full items-center justify-center bg-gray-50"
          role="status"
          aria-live="polite"
        >
          <div class="text-sm text-gray-400">Loading chart...</div>
        </div>
      {/if}
    </div>
  </div>
</figure>
