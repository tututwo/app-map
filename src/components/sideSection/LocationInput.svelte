<script lang="ts">
import Fuse from "fuse.js";
import { onMount } from "svelte";
import counties from "$data/countyID/counties_geoid.csv";

let {
  placeholder = "Search for a county...",
  maxResults = 10,
  disabled = false,
  class: className = "",
  value = "",
  onSelect = (geoid: string) => {},
}: {
  placeholder?: string;
  maxResults?: number;
  disabled?: boolean;
  class?: string;
  value?: string;
  onSelect?: (geoid: string) => void;
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
  fuse = new Fuse(counties, {
    keys: ["name", "geoid"],
    threshold: 0.3,
    includeScore: true,
  });

  // Initialize inputValue based on current value prop
  updateInputValueFromProp();
});

// Sync with value prop
$effect(() => {
  // This will rerun whenever value prop changes
  updateInputValueFromProp();
});

function updateInputValueFromProp() {
  if (!counties) return; // Guard against data not being available yet

  if (value) {
    const selectedCounty = counties.find((county) => county.geoid === value);
    if (selectedCounty) {
      inputValue = selectedCounty.name;
    } else {
      // If geoid exists in prop but not in data, clear it
      onSelect("");
      inputValue = "";
    }
  } else {
    inputValue = "";
  }
}

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

  // Clear county selection if input is empty
  if (!inputValue.trim()) {
    onSelect("");
  }
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
  onSelect(county.geoid);
  isOpen = false;
}

function clearSelection() {
  inputValue = "";
  onSelect("");
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
  <div class="relative w-full">
    <input
      bind:this={inputElement}
      type="text"
      {placeholder}
      {disabled}
      value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeyDown}
      class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25 focus:outline-none {inputValue
        ? 'pr-8'
        : ''}"
    />
    {#if inputValue}
      <button
        type="button"
        class="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        onclick={clearSelection}
        aria-label="Clear selection"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="h-5 w-5"
        >
          <path
            d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
          />
        </svg>
      </button>
    {/if}
  </div>

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
