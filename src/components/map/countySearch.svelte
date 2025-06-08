<script lang="ts">
import { Combobox } from "bits-ui";
import { searchCounties } from "./searchCounty2010Census.js";
import { Debounced } from "runed";
import type { ComponentProps } from "svelte";
import Check from "lucide-svelte/icons/check";
// import type { County } from '$lib/types';
export type County = {
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

// State management
let searchValue = $state("");
let suggestions = $state<County[]>([]);
let isLoading = $state(false);
let selectedCountyKey = $state<string | undefined>(undefined); // Renamed to avoid conflict with selectedCounty object
let open = $state(false);

const debouncedSearchValue = new Debounced(() => searchValue, 300);

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

function handleValueChange(value: string | undefined) {
  if (!value) return;

  const selected = suggestions.find((s) => s.key === value);
  if (selected) {
    searchValue = selected.displayName;
    selectedCountyKey = value;

    onCountySelected?.(selected);
  }
}
function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  searchValue = target.value;

  if (searchValue.length >= 3) {
    open = true;
    // Set loading immediately when user types enough characters
    if (
      suggestions.length === 0 ||
      !suggestions.some((s) => s.displayName.toLowerCase().includes(searchValue.toLowerCase()))
    ) {
      isLoading = true;
    }
  } else {
    // Clear selected key if search value is cleared and not matching a selection
    if (
      selectedCountyKey &&
      suggestions.find((s) => s.key === selectedCountyKey)?.displayName !== searchValue
    ) {
      selectedCountyKey = undefined;
    }
    isLoading = false; // Clear loading for short queries
  }
}

function handleOpenChange(isOpen: boolean) {
  open = isOpen;
  if (!isOpen && !selectedCountyKey) {
    searchValue = "";
  }
  // If closing and there's a selected item, ensure input reflects its display name
  if (!isOpen && selectedCountyKey) {
    const currentSelection =
      suggestions.find((s) => s.key === selectedCountyKey) ??
      (searchValue === "" ? undefined : { displayName: searchValue }); // Fallback if suggestions are cleared
    if (currentSelection) {
      searchValue = currentSelection.displayName;
    }
  }
}

type ItemChildrenProps = ComponentProps<Combobox.Item>["children"] extends
  | ((props: infer P) => any)
  | undefined
  ? P
  : never;
</script>

<Combobox.Root
  type="single"
  bind:value={selectedCountyKey}
  bind:open
  onValueChange={handleValueChange}
  onOpenChange={handleOpenChange}
  items={suggestions.map((s) => ({ value: s.key, label: s.displayName }))}
  class="group relative w-full {className}"
>
  <div class="relative w-full">
    <Combobox.Input
      value={searchValue}
      oninput={handleInput}
      {placeholder}
      class="w-full rounded-xs bg-white px-4 py-2 text-lg font-normal text-gray-800
               transition-all duration-200
               ease-in-out placeholder:text-base placeholder:text-gray-400 focus:border-blue-500 focus:ring-2
               focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
      aria-label="Search for a county"
    />
    <Combobox.Trigger
      class="absolute top-1/2 right-3 -translate-y-1/2 rounded-xs p-2
               text-gray-400 transition-colors duration-200
               ease-in-out hover:bg-gray-100 hover:text-gray-600"
      aria-label="Toggle suggestions"
    ></Combobox.Trigger>
  </div>

  <Combobox.Portal>
    <Combobox.Content
      class="z-50 mt-2 max-h-[320px] w-[var(--bits-combobox-anchor-width)] overflow-hidden rounded-xs
               border border-gray-200 bg-white shadow-xl"
      sideOffset={5}
    >
      <Combobox.Viewport class="viewport max-h-[304px] overflow-y-auto p-1.5">
        {#if isLoading}
          <div class="flex items-center justify-center gap-3 p-6 text-center text-sm text-gray-500">
            <div
              class="h-4 w-4 animate-spin rounded-sm border-2 border-gray-300 border-t-blue-500"
            ></div>
            Loading counties...
          </div>
        {:else if searchValue.length >= 3 && suggestions.length === 0}
          <div class="p-6 text-center text-sm text-gray-500">No counties found</div>
        {:else if searchValue.length < 3 && !open}
          <!-- Optionally show this message only when dropdown is not forced open -->
          <div class="p-6 text-center text-sm text-gray-500">
            Type at least 3 characters to search
          </div>
        {:else if searchValue.length < 3 && open && suggestions.length === 0}
          <div class="p-6 text-center text-sm text-gray-500">
            Type at least 3 characters to search
          </div>
        {:else}
          {#each suggestions as suggestion (suggestion.key)}
            <Combobox.Item
              value={suggestion.key}
              label={suggestion.displayName}
              class="mb-0.5 cursor-pointer rounded-sm px-3.5 py-2.5 transition-colors duration-150
                       ease-in-out outline-none last:mb-0
                       data-[highlighted]:bg-gray-100 data-[selected]:bg-blue-100 data-[selected]:text-blue-700"
            >
              {#snippet children({ selected }: ItemChildrenProps)}
                <div class="flex w-full items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-medium text-gray-800 data-[selected]:text-blue-700">
                      {suggestion.displayName}
                    </div>
                    <div
                      class="mt-0.5 text-xs leading-snug text-gray-500 data-[selected]:text-blue-600"
                    >
                      {suggestion.originalLocation}
                    </div>
                  </div>
                  {#if selected}
                    <Check class="h-4 w-4 shrink-0 text-blue-600" />
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

<style global>
/* Custom scrollbar for WebKit browsers (Chrome, Safari, Edge, Opera) */
.viewport::-webkit-scrollbar {
  width: 8px;
}

.viewport::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 10px;
}

.viewport::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 10px;
  border: 2px solid #f1f5f9;
}
.viewport::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.viewport {
  scrollbar-width: thin;
  scrollbar-color: #94a3b8 #f1f5f9;
}
</style>
