<script lang="ts">
import { beforeNavigate, goto, replaceState } from "$app/navigation";
import { resolve } from "$app/paths";
import { navigating, page } from "$app/state";
import { onMount } from "svelte";
import { prefersReducedMotion } from "svelte/motion";
import { fade, scale } from "svelte/transition";
import FindPlace from "$components/explore/FindPlace.svelte";
import SelectionPanel from "$components/explore/SelectionPanel.svelte";
import QueryFields from "$components/site/QueryFields.svelte";
import { countsIn, levelBreaks } from "$lib/explore/load";
import { windowIndexOf } from "$lib/explore/metrics";
import { ExploreNavigation, type AddressText } from "$lib/explore/navigation.svelte";
import {
  FIXED_BREAKS,
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
  { label: "ZIP", level: "zcta" },
  { label: "Tract", level: "tract" },
  { label: "Block group", level: "blockgroup" },
];
let query = $derived(data.query);
let mapZoom = $state(3.5);
// Below its Reveal zoom a tiled Level still draws states, and the legend follows the map.
let drawnLevel = $derived<Level>(
  query.level !== "state" && mapZoom < TILES[query.level].revealZoom ? "state" : query.level
);
// Every Year Window is already in memory, so a new window is a lookup into the same arrays.
let yearWindow = $derived(windowIndexOf(query.from, query.to));
let stateCounts = $derived(countsIn(data.states, yearWindow));
let breaks = $derived(levelBreaks(data.states, query.type, yearWindow));
let closedByState = $derived(
  new Map(data.states?.shard.geoids.map((geoid, row) => [geoid, stateCounts[row]]))
);
let legend = $derived(legendFor(breaks[drawnLevel]));
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
    const url = new URL(page.url);
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
  <div class="border-rule relative z-[4] flex flex-wrap items-stretch border-b bg-white">
    <FindPlace value={searchValue} byId={closedByState} onpick={(pick) => navigation.look(pick)} />
    <QueryFields
      large
      bind:from={() => query.from, (from) => navigation.update({ from })}
      bind:to={() => query.to, (to) => navigation.update({ to })}
      bind:type={() => query.type, (type) => navigation.update({ type })}
    />
    <div
      class="flex min-h-14 min-w-0 flex-auto flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2 lg:justify-end"
    >
      <span class="text-muted text-[12.5px] whitespace-nowrap">View by</span>
      <div class="bg-seg inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[5px] p-[3px]">
        {#each VIEWS as { label, level } (label)}
          <button
            type="button"
            disabled={!level}
            aria-pressed={level === query.level}
            title={level
              ? `${label} view`
              : `${label} boundaries are not available in this release`}
            onclick={() => level && navigation.look({ level })}
            class="motion-control text-ink rounded-[3px] px-[11px] py-1.5 text-[13px] font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 {level ===
            query.level
              ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,.14)]'
              : ''}"
          >
            {label}
          </button>
        {/each}
      </div>
      <button
        type="button"
        onclick={reset}
        class="motion-control border-field-border text-ink hover:border-ink h-[34px] rounded-[3px] border bg-white px-3.5 text-[11px] font-bold tracking-[.1em] uppercase"
      >
        Reset
      </button>
    </div>
  </div>

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
        class="border-rule absolute top-5 right-[22px] flex flex-col overflow-hidden rounded-[3px] border bg-white shadow-[0_2px_6px_rgba(0,0,0,.06)]"
      >
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!mapControls}
          onclick={() => mapControls?.zoomIn()}
          class="motion-control border-rule text-ink hover:bg-footer size-[42px] border-b text-[18px] disabled:opacity-40"
          >+</button
        >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!mapControls}
          onclick={() => mapControls?.zoomOut()}
          class="motion-control text-ink hover:bg-footer size-[42px] text-[18px] disabled:opacity-40"
          >−</button
        >
      </div>

      <div
        class="border-rule absolute right-2 bottom-7 left-2 flex flex-col gap-3 rounded border bg-white px-3 pt-2.5 pb-2 shadow-[0_6px_20px_-10px_rgba(0,0,0,.18)] lg:right-auto lg:bottom-8 lg:left-6 lg:w-[min(470px,calc(100%_-_48px))] lg:px-[22px] lg:pt-[18px] lg:pb-4"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span class="text-ink text-[13px] font-semibold lg:text-[15px]">Reported closures</span>
          <button
            id="legend-help-toggle"
            type="button"
            aria-expanded={legendInfo}
            aria-controls={legendInfo ? "legend-help" : undefined}
            onclick={() => (legendInfo = !legendInfo)}
            class="motion-control text-medium-blue text-[13px] hover:underline"
            >How are colors chosen?</button
          >
        </div>
        <p class="text-muted text-[12px] max-lg:hidden">
          Preliminary source counts · {selection.range}
        </p>
        <div
          class="grid grid-cols-6 gap-x-1.5 gap-y-3 lg:grid-cols-[repeat(auto-fit,minmax(64px,1fr))] lg:gap-x-2"
        >
          {#each legend.classes as cls (cls.label)}
            <div class="flex min-w-0 flex-col gap-2">
              <div class="h-2.5" style:background={cls.color}></div>
              <span class="text-body text-[11.5px]">{cls.label}</span>
            </div>
          {/each}
          <div class="flex min-w-0 flex-col gap-2">
            <div class="h-2.5" style:background={NO_DATA_COLOR}></div>
            <span class="text-body text-[11.5px]">No data</span>
          </div>
        </div>
        {#if legendInfo}
          <!-- The scrollable color guide must support keyboard scrolling. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            id="legend-help"
            role="region"
            aria-label="Map color guide"
            tabindex="0"
            transition:scale={{
              start: prefersReducedMotion.current ? 1 : 0.98,
              duration: prefersReducedMotion.current ? 100 : 180,
            }}
            class="legend-help border-rule text-body absolute right-0 bottom-[calc(100%_+_8px)] left-0 max-h-[min(30vh,11rem)] origin-bottom-right overflow-auto rounded-lg border bg-white p-4 text-[12.5px] leading-normal text-pretty shadow-[0_8px_28px_-8px_rgba(0,0,0,.2)] lg:max-h-80"
          >
            {#if drawnLevel !== "state" && drawnLevel !== "county"}
              Fixed breaks at {FIXED_BREAKS[drawnLevel].join(", ")} reported closures apply to every
              window and type. {LEVEL_NOUNS[drawnLevel].many.replace(/^./, (first) =>
                first.toUpperCase()
              )} use
              {manifest.boundaryYear} census boundaries.
            {:else}
              Classes are quintiles of the {drawnLevel === "county" ? "counties'" : "states'"} counts
              for this window and type, so a color does not mean the same count in another window.
              {#if drawnLevel === "county"}
                Counties use {manifest.boundaryYear} census boundaries.
              {:else}
                Census data vintage: {manifest.boundaryYear}; generalized map boundaries:
                {STATE_GEOMETRY_YEAR}. These vintages differ.
              {/if}
            {/if}
            Gray means no place of worship of this type was active there in the window; zero stays in
            the lightest class. Moves are excluded. Counts cover the full window, so longer windows can
            contain more closures.
          </div>
        {/if}
      </div>
    </div>
    <SelectionPanel {selection} search={page.url.search} />
  </div>
</main>

<style>
@media (prefers-reduced-motion: reduce) {
  .legend-help {
    transform: none !important;
  }
}
</style>
