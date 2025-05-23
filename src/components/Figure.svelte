<!-- adapted from Pudding :https://github.com/the-pudding/svelte-starter/blob/main/src/components/figure/migrate/Figure.svelte-->

<script>
import { setContext, onMount, tick } from "svelte";
import { browser } from "$app/environment";
import resize from "$lib/resize.js";

let {
  debounce = 250,
  exclude = "height",
  custom: initialCustom = {},
  children,
  figcaption, // Named slot for figcaption
  captionId = `figure-caption-${Math.random().toString(36).substring(2, 15)}`, // Unique ID for ARIA
} = $props();

// Base $state variables
let figureWidth = $state(0);
let figureHeight = $state(0);
let figureCustom = $state({ ...initialCustom });

// State variables bound to the div's client dimensions
let divClientWidth = $state(0);
let divClientHeight = $state(0);

// $derived variable for DPR
let dpr = $derived(browser ? Math.min(2, window.devicePixelRatio || 1) : 1);

// $derived to check if we have valid dimensions
const hasDimensions = $derived(figureWidth > 0 && figureHeight > 0);

// Provide getter functions in the context for live values
setContext("Figure", {
  getWidth: () => figureWidth,
  getHeight: () => figureHeight,
  getDpr: () => dpr,
  getCustom: () => figureCustom,
});

function updateDimensionsFromBoundValues() {
  figureWidth = divClientWidth;
  figureHeight = divClientHeight;
}

// $effect to react to changes in the 'initialCustom' prop
$effect(() => {
  figureCustom = { ...initialCustom };
});

onMount(() => {
  async function initialResize() {
    await tick(); // Ensure DOM measurements are up-to-date
    updateDimensionsFromBoundValues();
  }
  initialResize();
});

// Event handler for the custom 'resize' event dispatched by the action
function handleResizeEvent() {
  updateDimensionsFromBoundValues();
}
</script>

<figure class="flex h-full w-full flex-col" aria-labelledby={figcaption ? captionId : undefined}>
  <div
    class="h-full w-full flex-grow"
    bind:clientWidth={divClientWidth}
    bind:clientHeight={divClientHeight}
    use:resize={{ exclude, debounce }}
    onresize={handleResizeEvent}
  >
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
  {#if figcaption}
    <figcaption id={captionId} class="mt-2 text-center text-sm text-gray-600">
      {@render figcaption()}
    </figcaption>
  {/if}
</figure>

<style>
:global(.figure-inner > *) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
