<!-- adapted from Pudding :https://github.com/the-pudding/svelte-starter/blob/main/src/components/figure/migrate/Figure.svelte-->

<script>
import { setContext, onMount, tick } from "svelte";
import { browser } from "$app/environment";
import resize from "$lib/resize.js"; // Ensure this path is correct

// Props, including 'children' and 'figcaption' which will be snippets
let {
  debounce = 250,
  exclude = "height",
  custom: initialCustom = {},
  children, // Default slot equivalent
  figcaption, // Named slot 'figcaption' equivalent
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

<figure class="w-full h-full">
  <div
    class="w-full h-full"
    bind:clientWidth={divClientWidth}
    bind:clientHeight={divClientHeight}
    use:resize={{ exclude, debounce }}
    onresize={handleResizeEvent}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
  {#if figcaption}
    {@render figcaption?.()}
  {/if}
</figure>

<style>


/* This global rule might need adjustment based on how snippets render,
	   but the principle of positioning children of .figure-inner is likely the same. */
:global(.figure-inner > *) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
