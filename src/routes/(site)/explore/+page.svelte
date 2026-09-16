<script lang="ts">
import { goto } from "$app/navigation";
import { navigating, page } from "$app/state";
import { onMount } from "svelte";
import FindPlace from "$components/explore/FindPlace.svelte";
import SelectionPanel from "$components/explore/SelectionPanel.svelte";
import SummaryDialog from "$components/explore/SummaryDialog.svelte";
import QueryFields from "$components/site/QueryFields.svelte";
import {
  BREAKS,
  CLASSES,
  DEFAULT_QUERY,
  NO_DATA_COLOR,
  STATES,
  manifest,
  selectionFor,
  type ExploreQuery,
} from "$lib/explore/model";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const VIEWS = ["State", "County", "ZIP", "Tract"] as const;
let query = $derived(data.query);
let selection = $derived(selectionFor(query, data.rows));
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
  return () => {
    mounted = false;
  };
});

// Consecutive From/To writes preserve the whole pending URL.
let pending: URL | null = null;
function update(patch: Partial<ExploreQuery>) {
  const url = new URL(pending ?? page.url);
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  pending = url;
  void goto(url, { replaceState: true, keepFocus: true, noScroll: true }).finally(() => {
    if (pending === url) pending = null;
  });
}

function pickState(id: string) {
  update({ where: STATES.find((state) => state.id === id)?.name ?? "" });
}

function reset() {
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
    <FindPlace value={selection.selected?.name ?? ""} byId={selection.byId} onpick={pickState} />
    <QueryFields
      large
      bind:from={() => query.from, (from) => update({ from })}
      bind:to={() => query.to, (to) => update({ to })}
      bind:type={() => query.type, (type) => update({ type })}
    />
    <div class="flex h-14 flex-auto items-center justify-end gap-3 px-5">
      <span class="text-muted text-[12.5px] whitespace-nowrap">View by</span>
      <div class="bg-seg inline-flex gap-0.5 rounded-[5px] p-[3px]">
        {#each VIEWS as option (option)}
          <button
            type="button"
            disabled={option !== "State"}
            aria-pressed={option === "State"}
            title={option === "State"
              ? "State view"
              : `${option} data is not available in this release`}
            class="text-ink rounded-[3px] px-[11px] py-1.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 {option ===
            'State'
              ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,.14)]'
              : ''}"
          >
            {option}
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
  {:else if navigating.to}
    <div role="status" class="bg-white px-6 py-2 text-sm text-muted">Updating selection…</div>
  {/if}

  <div class="flex min-h-0 flex-1">
    <div class="bg-map relative min-h-0 min-w-0 flex-auto overflow-hidden">
      {#if MapComponent}
        <MapComponent
          bind:this={mapControls}
          rows={data.rows}
          selected={selection.selected?.id ?? null}
          onselect={pickState}
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
          {#each CLASSES as cls (cls.label)}
            <div class="flex min-w-0 flex-col gap-2">
              <div class="h-2.5" style:background={cls.color}></div>
              <span class="text-body text-[11.5px] whitespace-nowrap">{cls.label}</span>
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
            Fixed breaks at {BREAKS.map((value) => value.toLocaleString("en-US")).join(", ")} reported
            closures apply across all published windows. Gray means the count is unavailable; zero remains
            in the lightest class. Moves are excluded. Counts cover the full window, so longer windows
            can contain more closures. Census data vintage: {manifest.boundaryYear}; generalized map
            boundaries: {manifest.geometry.boundaryYear}. These vintages differ.
          </p>
        {/if}
      </div>
    </div>
    <SelectionPanel {selection} onsummary={() => (summaryOpen = true)} />
  </div>
</main>

<SummaryDialog bind:open={summaryOpen} {selection} />
