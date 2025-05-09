<script lang="ts">
import Fuse from "fuse.js";
import { onMount } from "svelte";

let {
  data,
  onSelect,
  placeholder = "Search for a county...",
  maxResults = 10,
  disabled = false,
  class: className = "",
}: {
  data: { name: string; geoid: string }[];
  onSelect: (county: { name: string; geoid: string }) => void;
  placeholder?: string;
  maxResults?: number;
  disabled?: boolean;
  class?: string;
} = $props();

// State
let inputValue = $state("");
let isOpen = $state(false);
let selectedIndex = $state(-1);
let fuse: Fuse<{ name: string; geoid: string }>;
let dropdownElement: HTMLDivElement | null = $state(null);
let inputElement: HTMLInputElement | null = $state(null);

// Initialize Fuse.js for fuzzy search
onMount(() => {
  fuse = new Fuse(data, {
    keys: ["name", "geoid"],
    threshold: 0.3,
    includeScore: true,
  });
});

// Computed
let filteredResults = $derived.by(() => {
  if (!inputValue.trim()) return [];
  return fuse
    .search(inputValue)
    .slice(0, maxResults)
    .map((result) => result.item);
});

// Methods
function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  inputValue = target.value;
  isOpen = true;
  selectedIndex = -1;
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isOpen) return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredResults.length - 1);
      break;
    case "ArrowUp":
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      break;
    case "Enter":
      e.preventDefault();
      if (selectedIndex >= 0) {
        selectCounty(filteredResults[selectedIndex]);
      }
      break;
    case "Escape":
      e.preventDefault();
      isOpen = false;
      break;
  }
}

function selectCounty(county: { name: string; geoid: string }) {
  inputValue = county.name;
  onSelect(county);
  isOpen = false;
}

function handleClickOutside(e: MouseEvent) {
  if (!dropdownElement?.contains(e.target as Node) && !inputElement?.contains(e.target as Node)) {
    isOpen = false;
  }
}

// Cleanup
onMount(() => {
  document.addEventListener("click", handleClickOutside);
  return () => {
    document.removeEventListener("click", handleClickOutside);
  };
});
</script>

<div class="relative w-full {className}">
  <input
    bind:this={inputElement}
    type="text"
    {placeholder}
    {disabled}
    value={inputValue}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    class="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25 focus:outline-none"
  />

  {#if isOpen && filteredResults.length > 0}
    <div
      bind:this={dropdownElement}
      class="absolute top-full right-0 left-0 z-50 mt-1 max-h-[300px] overflow-y-auto rounded border border-gray-300 bg-white shadow-sm"
      role="listbox"
    >
      {#each filteredResults as county, i}
        <div
          class="cursor-pointer px-3 py-2 hover:bg-gray-100 {i === selectedIndex
            ? 'bg-gray-100'
            : ''}"
          role="option"
          aria-selected={i === selectedIndex}
          onclick={() => selectCounty(county)}
          onmouseenter={() => (selectedIndex = i)}
          onkeydown={(e) => e.key === "Enter" && selectCounty(county)}
          tabindex="0"
        >
          {county.name} ({county.geoid})
        </div>
      {/each}
    </div>
  {/if}
</div>
