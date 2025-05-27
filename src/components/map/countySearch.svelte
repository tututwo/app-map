<!-- CountySearch.svelte -->
<!-- @ts-nocheck -->
<script>
import { searchCounties } from "./utils.js";

let query = $state("");
let suggestions = $state([]);
let isLoading = $state(false);
let showDropdown = $state(false);
let selectedIndex = $state(-1);

let debounceTimer;

async function handleInput() {
  clearTimeout(debounceTimer);

  if (query.length < 3) {
    suggestions = [];
    showDropdown = false;
    return;
  }

  debounceTimer = setTimeout(async () => {
    isLoading = true;
    showDropdown = true;

    try {
      suggestions = await searchCounties(query);
    } catch (error) {
      console.error("Search error:", error);
      suggestions = [];
    } finally {
      isLoading = false;
    }
  }, 300);
}

function selectSuggestion(suggestion) {
  query = suggestion.displayName;
  showDropdown = false;
  selectedIndex = -1;

  // Dispatch custom event with selected county
  const event = new CustomEvent("county-selected", {
    detail: suggestion,
  });
  document.dispatchEvent(event);
}

function handleKeydown(event) {
  if (!showDropdown || suggestions.length === 0) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      break;
    case "Enter":
      event.preventDefault();
      if (selectedIndex >= 0) {
        selectSuggestion(suggestions[selectedIndex]);
      }
      break;
    case "Escape":
      showDropdown = false;
      selectedIndex = -1;
      break;
  }
}

function handleBlur() {
  // Delay hiding to allow click events on suggestions
  setTimeout(() => {
    showDropdown = false;
    selectedIndex = -1;
  }, 150);
}
</script>

<div class="search-container">
  <input
    type="text"
    bind:value={query}
    oninput={handleInput}
    onkeydown={handleKeydown}
    onblur={handleBlur}
    onfocus={() => query.length >= 3 && (showDropdown = true)}
    placeholder="Search for a place..."
    class="search-input"
  />

  {#if showDropdown}
    <div class="dropdown">
      {#if isLoading}
        <div class="loading">Loading...</div>
      {:else if suggestions.length === 0}
        <div class="no-results">No counties found</div>
      {:else}
        {#each suggestions as suggestion, index}
          <div
            class="suggestion"
            class:selected={index === selectedIndex}
            onclick={() => selectSuggestion(suggestion)}
            role="option"
            tabindex="-1"
          >
            <div class="county-name">{suggestion.displayName}</div>
            <div class="original-location">{suggestion.originalLocation}</div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
.search-container {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion {
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}

.suggestion:hover,
.suggestion.selected {
  background-color: #f5f5f5;
}

.county-name {
  font-weight: 500;
  color: #333;
}

.original-location {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.loading,
.no-results {
  padding: 12px;
  text-align: center;
  color: #666;
}
</style>
