<script lang="ts">
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { navigating, page } from "$app/state";
import { onMount } from "svelte";
import FindPlace from "$components/explore/FindPlace.svelte";
import SelectionPanel from "$components/explore/SelectionPanel.svelte";
import SummaryDialog from "$components/explore/SummaryDialog.svelte";
import QueryFields from "$components/site/QueryFields.svelte";
import { valueAt, windowIndexOf } from "$lib/explore/metrics";
import {
  DEFAULT_QUERY,
  FIXED_BREAKS,
  LEVEL_NOUNS,
  NO_DATA_COLOR,
  STATE_GEOMETRY_YEAR,
  TILES,
  breaksFor,
  legendFor,
  manifest,
  parentOf,
  selectionFor,
  whereOf,
  writeQuery,
  type ExploreQuery,
  type Level,
  type LngLat,
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
const countsIn = (national: typeof data.states) =>
  national?.shard.geoids.map((_, row) => valueAt(national.counts, row, yearWindow)) ?? [];
let stateCounts = $derived(countsIn(data.states));
let breaks = $derived({
  state: breaksFor(stateCounts),
  county: breaksFor(countsIn(data.counties)),
  ...FIXED_BREAKS,
});
let closedByState = $derived(
  new Map(data.states?.shard.geoids.map((geoid, row) => [geoid, stateCounts[row]]))
);
let legend = $derived(legendFor(breaks[drawnLevel]));
// True while the Unit under the Focus is being read from the tiles; "failed" when that read failed.
let locating = $state<boolean | "failed">(false);
let selection = $derived(selectionFor(query, data.breakdown, data.context, locating));
let legendInfo = $state(false);
let summaryOpen = $state(false);
let MapComponent = $state<typeof import("$components/explore/StateMap.svelte").default>();
let mapControls = $state<{ zoomIn: () => void; zoomOut: () => void; reset: () => void }>();
let mapError = $state<string | null>(null);
let mounted = false;

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
  // A link may carry a Focus alone; the Selection is derived here, never on the server.
  if (query.at && !selection.selected) void look({});
  return () => {
    mounted = false;
  };
});

// Consecutive From/To writes preserve the whole pending URL.
let pending: URL | null = null;
function update(patch: Partial<ExploreQuery>) {
  const url = new URL(pending ?? page.url);
  writeQuery(url.searchParams, patch);
  pending = url;
  void goto(resolve("/explore") + url.search, {
    replaceState: true,
    keepFocus: true,
    noScroll: true,
  }).finally(() => {
    if (pending === url) pending = null;
  });
}

// The newest request wins: a slower lookup must not overwrite the Selection that followed it.
let ticket = 0;
/**
 * Say where to look (`at`), what to report there (`level`), or both; the Selection follows (ADR-0003).
 * A new Focus may name the Unit it was taken from. The same Focus at a coarser Level is the Selection's
 * parent. Anything else is read from the tiles.
 */
async function look(next: { at?: LngLat; level?: Level; geoid?: string; near?: string }) {
  const mine = ++ticket;
  const level = next.level ?? query.level;
  const at = next.at ?? query.at;
  let id =
    next.geoid ??
    (next.at || !selection.selected ? undefined : parentOf(selection.selected, level));
  locating = false;
  if (!id && at) {
    locating = true;
    let failed = false;
    try {
      const { unitAt } = await import("$lib/explore/locate");
      id = (await unitAt(level, at)) ?? undefined;
    } catch {
      failed = true;
    }
    if (mine !== ticket) return;
    locating = failed ? "failed" : false;
  }
  update({
    at,
    level,
    near: next.at ? (next.near ?? "") : query.near,
    where: whereOf(level, id),
  });
}

function reset() {
  ticket++;
  locating = false;
  update(DEFAULT_QUERY);
  mapControls?.reset();
  legendInfo = false;
}
</script>

<svelte:head>
  <title>Explore · Where are places of worship closing?</title>
</svelte:head>

<main class="flex h-[max(720px,calc(100vh_-_65px))] flex-col" aria-busy={!!navigating.to}>
  <div class="border-rule relative z-[4] flex flex-wrap items-stretch border-b bg-white">
    <FindPlace
      value={query.near === "address" ? "Address you looked up" : query.near}
      byId={closedByState}
      onpick={look}
    />
    <QueryFields
      large
      bind:from={() => query.from, (from) => update({ from })}
      bind:to={() => query.to, (to) => update({ to })}
      bind:type={() => query.type, (type) => update({ type })}
    />
    <div class="flex h-14 flex-auto items-center justify-end gap-3 px-5">
      <span class="text-muted text-[12.5px] whitespace-nowrap">View by</span>
      <div class="bg-seg inline-flex gap-0.5 rounded-[5px] p-[3px]">
        {#each VIEWS as { label, level } (label)}
          <button
            type="button"
            disabled={!level}
            aria-pressed={level === query.level}
            title={level
              ? `${label} view`
              : `${label} boundaries are not available in this release`}
            onclick={() => level && look({ level })}
            class="text-ink rounded-[3px] px-[11px] py-1.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 {level ===
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
        class="border-field-border text-ink hover:border-ink h-[34px] rounded-[3px] border bg-white px-3.5 text-[11px] font-bold tracking-[.1em] uppercase"
      >
        Reset
      </button>
    </div>
  </div>

  {#if data.error}
    <div
      role="alert"
      class="flex items-center justify-between gap-4 bg-red-50 px-6 py-3 text-sm text-red-800"
    >
      <span>{data.error}</span>
      <button type="button" onclick={() => window.location.reload()} class="font-semibold underline"
        >Retry data</button
      >
    </div>
  {/if}

  <div class="flex min-h-0 flex-1">
    <div class="bg-map relative min-h-0 min-w-0 flex-auto overflow-hidden">
      {#if MapComponent}
        <MapComponent
          bind:this={mapControls}
          bind:zoom={mapZoom}
          selected={selection.selected?.id ?? null}
          focus={query.at}
          onpick={look}
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
          <button type="button" onclick={loadMap} class="font-semibold underline">Retry map</button>
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
          class="border-rule text-ink hover:bg-footer size-[42px] border-b text-[18px] disabled:opacity-40"
          >+</button
        >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!mapControls}
          onclick={() => mapControls?.zoomOut()}
          class="text-ink hover:bg-footer size-[42px] text-[18px] disabled:opacity-40">−</button
        >
      </div>

      <div
        class="border-rule absolute bottom-8 left-6 flex w-[min(470px,calc(100%_-_48px))] flex-col gap-3 rounded border bg-white px-[22px] pt-[18px] pb-4 shadow-[0_6px_20px_-10px_rgba(0,0,0,.18)]"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-4">
          <span class="text-ink text-[15px] font-semibold">Reported closures</span>
          <button
            type="button"
            onclick={() => (legendInfo = !legendInfo)}
            class="text-medium-blue text-[13px] hover:underline">How are colors chosen?</button
          >
        </div>
        <p class="text-muted text-[12px]">Preliminary source counts · {selection.range}</p>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-x-2 gap-y-3">
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
          <p
            class="border-rule text-muted mt-0.5 border-t pt-3 text-[12.5px] leading-normal text-pretty"
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
          </p>
        {/if}
      </div>
    </div>
    <SelectionPanel {selection} onsummary={() => (summaryOpen = true)} />
  </div>
</main>

<SummaryDialog bind:open={summaryOpen} {selection} />
