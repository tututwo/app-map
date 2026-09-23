<script lang="ts">
import { beforeNavigate, goto, replaceState } from "$app/navigation";
import { resolve } from "$app/paths";
import { navigating, page } from "$app/state";
import { onMount } from "svelte";
import { prefersReducedMotion } from "svelte/motion";
import { fade } from "svelte/transition";
import { ChevronDown, RotateCcw } from "lucide-svelte";
import FindPlace from "$components/explore/FindPlace.svelte";
import SelectionPanel from "$components/explore/SelectionPanel.svelte";
import Dropdown from "$components/site/Dropdown.svelte";
import QueryFields from "$components/site/QueryFields.svelte";
import { countsIn, levelBreaks } from "$lib/explore/load";
import { windowIndexOf } from "$lib/explore/metrics";
import { PALETTES, paletteFor } from "$lib/explore/palettes";
import { ExploreNavigation, type AddressText } from "$lib/explore/navigation.svelte";
import {
  LEVEL_NOUNS,
  NO_DATA_COLOR,
  STATE_GEOMETRY_YEAR,
  TILES,
  legendFor,
  manifest,
  formatAt,
  selectionFor,
  writeQuery,
  type Level,
} from "$lib/explore/model";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
// A view without a level has no published data yet.
const VIEWS: { label: string; level?: Level }[] = [
  { label: "State", level: "state" },
  { label: "County", level: "county" },
  { label: "ZCTA", level: "zcta" },
  { label: "Tract", level: "tract" },
  { label: "Block group", level: "blockgroup" },
];
let query = $derived(data.query);
let mapZoom = $state(3.5);
// Below its Reveal zoom a tiled Level still draws states, and the legend follows the map.
let drawnLevel = $derived<Level>(
  query.level !== "state" && mapZoom < TILES[query.level].revealZoom ? "state" : query.level
);
// The state summary holds every Year Window; fine-level map colours load the selected window only.
let yearWindow = $derived(windowIndexOf(query.from, query.to));
let stateCounts = $derived(countsIn(data.states, yearWindow));
let breaks = $derived(levelBreaks(data.states, query.type, yearWindow));
let closedByState = $derived(
  new Map(data.states?.shard.geoids.map((geoid, row) => [geoid, stateCounts[row]]))
);
let palette = $derived(
  paletteFor(page.state.explorePalette ?? page.url.searchParams.get("palette"))
);
let legend = $derived(legendFor(breaks[drawnLevel], palette.colors));
let legendInfo = $state(false);
let MapComponent = $state<typeof import("$components/explore/StateMap.svelte").default>();
let mapControls = $state<{ zoomIn: () => void; zoomOut: () => void; reset: () => void }>();
let mapError = $state<string | null>(null);
let mounted = false;

// Keep address text in this tab, separate from the coordinates in shareable URLs.
let addressText = $state.raw<AddressText>();
const navigation = new ExploreNavigation(
  () => ({ query, address: addressText ?? page.state.exploreAddress }),
  async ({ query: next, address }) => {
    if (!mounted) return;
    addressText = address;
    try {
      if (address) sessionStorage.setItem("explore-address", JSON.stringify(address));
      else sessionStorage.removeItem("explore-address");
    } catch {
      // Storage can be unavailable; the current page still retains the address.
    }
    const url = paletteUrl();
    writeQuery(url.searchParams, next);
    const state = { ...page.state, exploreAddress: address };
    if (url.search === page.url.search && !navigating.to) {
      replaceState(url, state);
      return;
    }
    await goto(resolve("/explore") + url.search, {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
      state,
    });
  },
  async (level, at) => (await import("$lib/explore/locate")).unitAt(level, at)
);
let selection = $derived(selectionFor(query, data.breakdown, data.context, navigation.locating));
let searchValue = $derived.by(() => {
  const { query: current, address } = navigation.current;
  return current.near === "address"
    ? address && current.at && address.at === formatAt(current.at)
      ? address.text
      : "Address you looked up"
    : current.near;
});

beforeNavigate(({ to }) => {
  if (to?.route.id !== page.route.id) {
    mounted = false;
    navigation.cancel();
  }
});

async function loadMap() {
  mapError = null;
  try {
    const module = await import("$components/explore/StateMap.svelte");
    if (mounted) MapComponent = module.default;
  } catch {
    if (mounted) mapError = "The map could not be loaded.";
  }
}

onMount(() => {
  mounted = true;
  void loadMap();
  try {
    const saved = JSON.parse(sessionStorage.getItem("explore-address") ?? "null");
    if (saved && typeof saved.at === "string" && typeof saved.text === "string")
      addressText = page.state.exploreAddress ?? saved;
  } catch {
    // A saved address is optional; invalid or inaccessible storage does not block the map.
  }
  // The Focus is the authority: `where` only lets the server render a shared link. A link that carries
  // a Focus alone, or a `where` that someone edited, is put right here.
  if (query.at) void navigation.look({ quiet: true });
  // Or a Unit alone (Home's form, older links): give it a Focus, so View by can answer at other Levels.
  else if (!query.at && selection.selected) {
    const unit = selection.selected;
    const { where, level } = query;
    void import("$lib/explore/gazetteer")
      .then(({ pointOf }) => pointOf(unit))
      .then((at) => {
        const current = navigation.current.query;
        if (at && mounted && !current.at && current.where === where && current.level === level)
          return navigation.update({ at });
      })
      .catch(() => {});
  }
  return () => {
    mounted = false;
    navigation.cancel();
  };
});

// Shallow routing updates page.state; page.url stays at the last full navigation.
function paletteUrl(id = palette.id) {
  const url = new URL(page.url);
  if (id === "yale") url.searchParams.delete("palette");
  else url.searchParams.set("palette", id);
  return url;
}

function changePalette(id: string) {
  const chosen = paletteFor(id);
  replaceState(paletteUrl(chosen.id), { ...page.state, explorePalette: chosen.id });
}

// A palette's classes as equal hard-edged steps, for its swatch in the list.
const ramp = (colors: readonly string[]) =>
  `linear-gradient(to right, ${colors.map((color, i) => `${color} ${(i * 100) / colors.length}% ${((i + 1) * 100) / colors.length}%`).join(", ")})`;

function reset() {
  void navigation.reset();
  mapControls?.reset();
  legendInfo = false;
}
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape" && legendInfo) {
      legendInfo = false;
      document.getElementById("legend-help-toggle")?.focus();
    }
  }}
/>

<svelte:head>
  <title>Explore · Where are places of worship closing?</title>
</svelte:head>

<!-- Below desktop width the map sits above the panel instead of beside it. -->
<main
  id="main-content"
  tabindex="-1"
  class="flex flex-col lg:h-[max(720px,calc(100vh_-_65px))]"
  aria-busy={!!navigating.to || navigation.locating === true}
>
  <div class="explore-toolbar search-bar border-rule relative z-[4] border-b">
    <FindPlace
      value={searchValue}
      byId={closedByState}
      onpick={(pick) => navigation.look(pick)}
      class="search-where min-h-14 min-w-0 items-center bg-white px-5"
    />
    <QueryFields
      bind:from={() => query.from, (from) => navigation.update({ from })}
      bind:to={() => query.to, (to) => navigation.update({ to })}
      bind:type={() => query.type, (type) => navigation.update({ type })}
    />
    <!-- Phones: five segments do not fit, so View by is a field like the others. -->
    <div class="search-level flex bg-white sm:hidden">
      <Dropdown
        label="View by"
        value={query.level}
        options={VIEWS.flatMap(({ label, level }) => (level ? [{ value: level, label }] : []))}
        onchange={(level) => navigation.look({ level: level as Level })}
        class="field flex min-h-14 w-full cursor-pointer flex-col justify-center gap-1 self-stretch px-5 text-left"
      >
        {#snippet trigger()}
          <span class="label-caps">View by</span>
          <span
            class="text-ink flex items-center justify-between gap-2 text-[16px] leading-6 font-medium"
          >
            {VIEWS.find(({ level }) => level === query.level)?.label}
            <ChevronDown
              size={12}
              strokeWidth={1.75}
              aria-hidden="true"
              class="field-icon field-caret text-muted shrink-0"
            />
          </span>
        {/snippet}
      </Dropdown>
    </div>
    <div class="search-reset flex items-center justify-center bg-white px-2 sm:hidden">
      {@render resetButton()}
    </div>
    <div
      class="search-view flex min-h-14 min-w-0 items-center gap-3 bg-white px-5 py-2 max-sm:hidden"
    >
      <span class="text-muted text-[12.5px] whitespace-nowrap">View by</span>
      <div class="bg-seg inline-flex max-w-full gap-0.5 overflow-x-auto p-1">
        {#each VIEWS as { label, level } (label)}
          <button
            type="button"
            disabled={!level}
            aria-pressed={level === query.level}
            title={level
              ? `${label} view`
              : `${label} boundaries are not available in this release`}
            onclick={() => level && navigation.look({ level })}
            class="motion-control text-ink min-h-9 px-[11px] py-1.5 text-[13px] font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 {level ===
            query.level
              ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,.14)]'
              : ''}"
          >
            {label}
          </button>
        {/each}
      </div>
      <span class="ml-auto">{@render resetButton()}</span>
    </div>
  </div>

  {#snippet resetButton()}
    <button
      type="button"
      onclick={reset}
      class="motion-control text-body hover:bg-seg inline-flex min-h-11 items-center gap-1.5 px-3 text-[12px] font-medium"
    >
      <RotateCcw size={13} strokeWidth={1.75} aria-hidden="true" />
      Reset
    </button>
  {/snippet}

  {#if navigation.notice}
    <p in:fade={{ duration: 140 }} role="status" class="bg-footer text-body px-5 py-3 text-sm">
      {navigation.notice}
    </p>
  {/if}

  {#if data.error}
    <div
      in:fade={{ duration: 140 }}
      role="alert"
      class="flex items-center justify-between gap-4 bg-red-50 px-6 py-3 text-sm text-red-800"
    >
      <span>{data.error}</span>
      <button
        type="button"
        onclick={() => window.location.reload()}
        class="motion-control font-semibold underline">Retry data</button
      >
    </div>
  {/if}

  <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
    <div
      class="bg-map relative h-[58vh] min-h-[340px] min-w-0 flex-none overflow-hidden lg:h-auto lg:min-h-0 lg:flex-auto"
    >
      {#if MapComponent}
        <MapComponent
          bind:this={mapControls}
          bind:zoom={mapZoom}
          selected={selection.selected?.id ?? null}
          focus={query.at}
          onpick={(pick) => navigation.look(pick)}
          level={query.level}
          {yearWindow}
          {breaks}
          religion={query.type}
          colors={palette.colors}
        />
      {:else if mapError}
        <div
          role="alert"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm"
        >
          <p>{mapError}</p>
          <button type="button" onclick={loadMap} class="motion-control font-semibold underline"
            >Retry map</button
          >
        </div>
      {:else}
        <div
          role="status"
          class="text-muted absolute inset-0 flex items-center justify-center text-sm"
        >
          Loading map…
        </div>
      {/if}

      <div
        class="map-material absolute top-4 right-4 flex flex-col overflow-hidden border lg:top-5 lg:right-5"
      >
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!mapControls}
          onclick={() => mapControls?.zoomIn()}
          class="motion-control border-rule text-ink hover:bg-footer size-11 border-b text-[18px] disabled:opacity-40"
          >+</button
        >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!mapControls}
          onclick={() => mapControls?.zoomOut()}
          class="motion-control text-ink hover:bg-footer size-11 text-[18px] disabled:opacity-40"
          >−</button
        >
      </div>

      <div role="group" aria-label="Map legend" class="map-legend map-material">
        <div class="flex shrink-0 items-start justify-between gap-3">
          <div class="min-w-0 pt-1">
            <h2 class="text-ink text-sm font-semibold tracking-[-.015em]">Reported closures</h2>
            <p class="mt-1 text-xs text-body">
              Per {LEVEL_NOUNS[drawnLevel].one} <span aria-hidden="true">·</span>
              {selection.range}
            </p>
          </div>
          <Dropdown
            label="Color palette"
            value={palette.id}
            options={PALETTES.map(({ id, label, group }) => ({ value: id, label, group }))}
            onchange={changePalette}
            class="group flex w-32 shrink-0 cursor-pointer flex-col gap-1 text-left outline-none"
          >
            {#snippet trigger()}
              <span class="text-body text-[11px]">Color palette</span>
              <span
                class="border-field-border text-ink group-hover:border-ink group-data-[state=open]:border-yale-blue group-focus-visible:outline-yale-blue flex min-h-9 items-center justify-between gap-2 border bg-white px-2.5 text-xs transition-colors group-focus-visible:outline-2 group-focus-visible:-outline-offset-2"
              >
                {palette.label}
                <ChevronDown
                  size={12}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  class="text-muted group-data-[state=open]:text-yale-blue transition-transform group-data-[state=open]:rotate-180"
                />
              </span>
            {/snippet}
            {#snippet option(item)}
              <span
                class="h-2 w-12 shrink-0 self-center"
                style:background={ramp(paletteFor(item.value).colors)}
              ></span>
              <span>{item.label}</span>
            {/snippet}
          </Dropdown>
        </div>
        <div class="shrink-0">
          <div
            class="legend-scale flex h-3 gap-px overflow-hidden"
            aria-label="Closure color scale"
          >
            {#each legend.classes as cls (cls.label)}
              <span
                class="min-w-0 flex-1"
                style:background={cls.color}
                title={`${cls.label} reported closures`}
              >
                <span class="sr-only">{cls.label} reported closures</span>
              </span>
            {/each}
          </div>
          <div class="text-body mt-1.5 flex justify-between text-[11px] font-medium tabular-nums">
            <span>{legend.classes[0].label}</span>
            <span>{legend.classes[legend.classes.length - 1].label}</span>
          </div>
        </div>
        <div class="order-2 flex shrink-0 items-center justify-between gap-3 text-[11px] text-body">
          <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span class="size-2.5" style:background={NO_DATA_COLOR}></span>
            No data
          </span>
          <button
            id="legend-help-toggle"
            type="button"
            aria-expanded={legendInfo}
            aria-controls={legendInfo ? "legend-help" : undefined}
            onclick={() => (legendInfo = !legendInfo)}
            class="motion-control legend-toggle text-yale-blue -my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-xs font-semibold"
          >
            Color key
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              class={legendInfo ? "rotate-180" : ""}
            />
          </button>
        </div>
        {#if legendInfo}
          <!-- The color guide is scrollable on short screens and keyboard accessible. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            id="legend-help"
            role="region"
            aria-label="Map color guide"
            tabindex="0"
            in:fade={{ duration: prefersReducedMotion.current ? 0 : 120 }}
            class="legend-help border-rule order-1 min-h-0 overflow-auto border-t pt-3 text-xs leading-relaxed text-body"
          >
            <p class="mb-2 font-semibold text-ink">Closures per {LEVEL_NOUNS[drawnLevel].one}</p>
            <ul
              class="mb-3 grid grid-flow-col grid-rows-5 gap-x-5 gap-y-2"
              aria-label="Color intervals"
            >
              {#each legend.classes as cls (cls.label)}
                <li class="flex items-center gap-2 tabular-nums">
                  <span class="h-2.5 w-5 shrink-0" style:background={cls.color}></span>
                  {cls.label}
                </li>
              {/each}
            </ul>
            <p>
              {#if drawnLevel !== "state" && drawnLevel !== "county"}
                These ranges stay the same across all time windows and types.
              {:else}
                Ranges group {LEVEL_NOUNS[drawnLevel].many} by positive closure counts for this window
                and type. They use deciles, with duplicate thresholds merged, so some selections have
                fewer than ten colors. Ranges can change with your filters.
              {/if}
            </p>
            <p class="mt-2">
              Gray means no place of worship of this type was active during the window. Zero
              closures use the lightest shade. Moves are excluded.
            </p>
            <p class="mt-2">
              Counts cover the full window; longer windows can contain more closures.
              {#if drawnLevel === "state"}
                Census data: {manifest.boundaryYear}. Generalized map boundaries: {STATE_GEOMETRY_YEAR}.
              {:else}
                Boundaries: {manifest.boundaryYear} Census.
              {/if}
            </p>
            <p class="mt-2 text-[11px]">Preliminary source counts.</p>
            {#if palette.id !== "yale"}
              <p class="mt-2 text-[11px]">
                <a
                  href="https://colorbrewer2.org/"
                  target="_blank"
                  rel="noreferrer"
                  class="underline underline-offset-2">ColorBrewer</a
                >
                sequential palette, interpolated to 10 colors using D3.
              </p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    <SelectionPanel
      {selection}
      search={paletteUrl().search}
      ontype={(type) => navigation.update({ type })}
    />
  </div>
</main>

<style>
/* Toolbar layouts; the hairlines come from .search-bar (app.css). Phones: place, then the window
   with Reset, then type with View by. From 640px View by is the segmented control; from 834px the
   fields share a row; from 1280px everything does. */
.explore-toolbar {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "where where"
    "dates reset"
    "type level";
  box-shadow: 0 2px 8px rgb(22 41 66 / 3%);
}
.search-level {
  grid-area: level;
}
.search-reset {
  grid-area: reset;
}
.search-view {
  grid-area: view;
}
@media (min-width: 640px) {
  .explore-toolbar {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      "where where"
      "dates type"
      "view view";
  }
}
@media (min-width: 834px) {
  .explore-toolbar {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas:
      "where dates type"
      "view view view";
  }
}
@media (min-width: 1280px) {
  .explore-toolbar {
    grid-template-columns: minmax(15rem, 1fr) auto auto auto;
    grid-template-areas: "where dates type view";
  }
}
.map-material {
  background: white;
  border-color: var(--color-rule);
  box-shadow: 0 2px 8px rgb(22 41 66 / 8%);
}
.map-legend {
  position: absolute;
  left: 1rem;
  bottom: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: min(22.75rem, calc(100% - 2rem));
  max-height: calc(100% - 5rem);
  padding: 1rem;
  border: 1px solid var(--color-rule);
}
.legend-help {
  max-height: 20rem;
  scrollbar-gutter: stable;
}
.legend-toggle:hover,
.legend-toggle[aria-expanded="true"] {
  background: rgb(0 53 107 / 6%);
}
.legend-help:focus-visible {
  outline: 2px solid var(--color-yale-blue);
  outline-offset: -2px;
}
@media (min-width: 1024px) {
  .map-legend {
    left: 1.5rem;
    bottom: 2rem;
  }
}
@media (prefers-contrast: more) {
  .map-material {
    border-color: var(--color-body);
  }
}
</style>
