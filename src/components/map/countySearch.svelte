<!-- CountySearch.svelte -->
<script lang="ts">
import { Combobox } from "bits-ui";
import { searchCounties } from "./searchCounty2010Census.js";
import { Debounced } from "runed";
import type { ComponentProps } from "svelte";

// Define the county type for better type safety
type County = {
  key: string;
  county: string;
  state: string | null;
  displayName: string;
  originalLocation: string;
};

// Define props using Svelte 5's $props pattern
interface CountySearchProps {
  placeholder?: string;
  onCountySelected?: (county: County) => void;
  class?: string;
}

let {
  placeholder = "All counties",
  onCountySelected,
  class: className = "",
}: CountySearchProps = $props();

// State management with proper types
let searchValue = $state("");
let suggestions = $state<County[]>([]);
let isLoading = $state(false);
let selectedCounty = $state<string | undefined>(undefined);
let open = $state(false);

// Create debounced search value
const debouncedSearchValue = new Debounced(() => searchValue, 300);

// Effect to handle search when debounced value changes
$effect(async () => {
  const searchTerm = debouncedSearchValue.current;

  if (!searchTerm || searchTerm.length < 3) {
    suggestions = [];
    isLoading = false;
    return;
  }

  isLoading = true;

  try {
    suggestions = await searchCounties(searchTerm);
  } catch (error) {
    console.error("Search error:", error);
    suggestions = [];
  } finally {
    isLoading = false;
  }
});

// Handle county selection
function handleValueChange(value: string | undefined) {
  if (!value) return;

  const selected = suggestions.find((s) => s.key === value);
  if (selected) {
    searchValue = selected.displayName;
    selectedCounty = value;

    // Call the callback if provided
    onCountySelected?.(selected);

    // For backward compatibility, also dispatch the custom event
    const event = new CustomEvent("county-selected", {
      detail: selected,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }
}

// Handle input changes
function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  searchValue = target.value;

  // Open dropdown when user types enough characters
  if (searchValue.length >= 3) {
    open = true;
  }
}

// Clear search when dropdown closes
function handleOpenChange(isOpen: boolean) {
  open = isOpen;
  if (!isOpen && !selectedCounty) {
    // Only clear if no county was selected
    searchValue = "";
  }
}

// Type for Combobox.Item children props
type ItemChildrenProps = ComponentProps<Combobox.Item>["children"] extends
  | ((props: infer P) => any)
  | undefined
  ? P
  : never;
</script>

<Combobox.Root
  type="single"
  bind:value={selectedCounty}
  bind:open
  onValueChange={handleValueChange}
  onOpenChange={handleOpenChange}
  items={suggestions.map((s) => ({ value: s.key, label: s.displayName }))}
  class="county-search-container {className}"
>
  <div class="input-wrapper">
    <Combobox.Input
      value={searchValue}
      oninput={handleInput}
      {placeholder}
      class="search-input"
      aria-label="Search for a county"
    />
    <Combobox.Trigger class="trigger-button">
      <svg
        class="chevron-icon"
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.26618 11.9026 7.38064 11.95 7.49999 11.95C7.61933 11.95 7.73379 11.9026 7.81819 11.8182L10.0682 9.56819Z"
          fill="currentColor"
          fill-rule="evenodd"
          clip-rule="evenodd"
        />
      </svg>
    </Combobox.Trigger>
  </div>

  <Combobox.Portal>
    <Combobox.Content class="dropdown-content" sideOffset={8}>
      <Combobox.Viewport class="viewport">
        {#if isLoading}
          <div class="loading-state">
            <span class="spinner"></span>
            Loading counties...
          </div>
        {:else if searchValue.length >= 3 && suggestions.length === 0}
          <div class="no-results">No counties found</div>
        {:else if searchValue.length < 3}
          <div class="info-message">Type at least 3 characters to search</div>
        {:else}
          {#each suggestions as suggestion (suggestion.key)}
            <Combobox.Item
              value={suggestion.key}
              label={suggestion.displayName}
              class="suggestion-item"
            >
              {#snippet children({ selected }: ItemChildrenProps)}
                <div class="item-content">
                  <div>
                    <div class="county-name">{suggestion.displayName}</div>
                    <div class="original-location">{suggestion.originalLocation}</div>
                  </div>
                  {#if selected}
                    <svg
                      class="check-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                        fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                      />
                    </svg>
                  {/if}
                </div>
              {/snippet}
            </Combobox.Item>
          {/each}
        {/if}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>

<style>
.county-search-container {
  position: relative;
  width: 100%;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

:global(.county-search-container .search-input) {
  width: 100%;
  padding: 20px 24px;
  border: none;
  border-radius: 32px;
  font-size: 18px;
  font-weight: 400;
  background-color: white;
  color: #1f2937;
  transition: all 0.2s ease;
}

:global(.county-search-container .search-input::placeholder) {
  color: #9ca3af;
  font-size: 18px;
}

:global(.county-search-container .search-input:focus) {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
}

:global(.county-search-container .trigger-button) {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  padding: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

:global(.county-search-container .trigger-button:hover) {
  background-color: rgba(0, 0, 0, 0.05);
  color: #6b7280;
}

.chevron-icon {
  transition: transform 0.2s ease;
  opacity: 0.6;
}

:global(.county-search-container[data-state="open"] .chevron-icon) {
  transform: rotate(180deg);
}

:global(.dropdown-content) {
  background: white;
  border: none;
  border-radius: 16px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  z-index: 50;
  width: var(--bits-combobox-anchor-width);
  max-height: 320px;
  overflow: hidden;
  margin-top: 8px;
}

.viewport {
  padding: 8px;
  max-height: 304px;
  overflow-y: auto;
}

:global(.suggestion-item) {
  padding: 14px 16px;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.15s ease;
  outline: none;
  margin-bottom: 4px;
}

:global(.suggestion-item:last-child) {
  margin-bottom: 0;
}

:global(.suggestion-item[data-highlighted]) {
  background-color: #f3f4f6;
}

:global(.suggestion-item[data-selected]) {
  background-color: #eff6ff;
}

.item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.county-name {
  font-weight: 500;
  color: #1f2937;
  font-size: 15px;
}

.original-location {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1.4;
}

.check-icon {
  color: #3b82f6;
  flex-shrink: 0;
}

.loading-state,
.no-results,
.info-message {
  padding: 24px;
  text-align: center;
  color: #6b7280;
  font-size: 15px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Scrollbar styling */
.viewport::-webkit-scrollbar {
  width: 8px;
}

.viewport::-webkit-scrollbar-track {
  background: transparent;
}

.viewport::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 4px;
}

.viewport::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}
</style>
