<script lang="ts">
let {
  description,
  children,
  class: className,
} = $props<{
  description: string;
  children: any;
  class?: string;
}>();

let isVisible = $state(false);
let tooltipElement: HTMLDivElement | null = $state(null);

function showTooltip() {
  isVisible = true;
}

function hideTooltip() {
  isVisible = false;
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative {className}" onmouseenter={showTooltip} onmouseleave={hideTooltip}>
  {@render children()}

  {#if isVisible}
    <div
      bind:this={tooltipElement}
      class="absolute z-50 mt-1 -ml-3 w-max max-w-xs rounded bg-gray-900 px-3 py-2 text-sm text-white shadow-lg"
      role="tooltip"
    >
      {description}
      <div class="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-gray-900"></div>
    </div>
  {/if}
</div>

<style>
/* Add a small delay to prevent flickering */
div[role="tooltip"] {
  animation: fadeIn 0.1s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
