<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/state";
import FindPlace from "$components/explore/FindPlace.svelte";
import SelectionPanel from "$components/explore/SelectionPanel.svelte";
import SummaryDialog from "$components/explore/SummaryDialog.svelte";
import QueryFields from "$components/site/QueryFields.svelte";
import {
  CLASSES,
  DEFAULT_QUERY,
  STATES,
  parseExploreQuery,
  selectionFor,
  type ExploreQuery,
} from "$lib/explore/model";

const VIEWS = ["State", "County", "ZIP", "Tract"] as const;

// The URL is the applied query: controls write to it, everything derives from it.
let query = $derived(parseExploreQuery(page.url.searchParams));
let selection = $derived(selectionFor(query));

let view = $state<(typeof VIEWS)[number]>("State");
let legendInfo = $state(false);
let summaryOpen = $state(false);

// Consecutive writes (From then To) fold into one pending target so neither
// navigation overwrites the other.
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
  update({ where: STATES.find((s) => s.id === id)?.name ?? "" });
  view = "State";
}

function reset() {
  update(DEFAULT_QUERY);
  view = "State";
  legendInfo = false;
}
</script>

<svelte:head>
  <title>Explore · Where are places of worship closing?</title>
</svelte:head>

<main class="flex h-[max(720px,calc(100vh_-_65px))] flex-col">
  <div class="border-rule relative z-[4] flex flex-wrap items-stretch border-b bg-white">
    <FindPlace
      value={selection.selected?.name ?? ""}
      byId={selection.byId}
      onpick={pickState}
      onlocate={() => pickState("CT")}
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
        {#each VIEWS as option (option)}
          <button
            type="button"
            onclick={() => (view = option)}
            class="text-ink rounded-[3px] px-[11px] py-1.5 text-[13px] font-medium {view === option
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

  <div class="flex min-h-0 flex-1">
    <div
      class="bg-map relative min-h-0 min-w-0 flex-auto overflow-hidden [background-image:linear-gradient(rgba(0,30,70,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,30,70,.06)_1px,transparent_1px)] [background-size:36px_36px]"
    >
      <!-- Map slot: MapLibre lands here next. The prototype's tile grid is intentionally not built. -->
      <div
        class="absolute inset-0 flex items-center justify-center pt-[50px] pr-[100px] pb-[130px] pl-[60px] transition-opacity duration-200 {view ===
        'State'
          ? ''
          : 'opacity-35'}"
      >
        <p class="text-faint font-mono text-[11px]">map · MapLibre — next step</p>
      </div>

      <div
        class="border-rule absolute top-5 right-[22px] flex flex-col overflow-hidden rounded-[3px] border bg-white shadow-[0_2px_6px_rgba(0,0,0,.06)]"
      >
        <button
          type="button"
          aria-label="Zoom in"
          class="border-rule text-ink hover:bg-footer size-[42px] border-b text-[18px]">+</button
        >
        <button
          type="button"
          aria-label="Zoom out"
          class="text-ink hover:bg-footer size-[42px] text-[18px]">−</button
        >
      </div>

      <div
        class="border-rule absolute bottom-6 left-6 flex w-[min(470px,calc(100%_-_48px))] flex-col gap-3 rounded border bg-white px-[22px] pt-[18px] pb-4 shadow-[0_6px_20px_-10px_rgba(0,0,0,.18)]"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-4">
          <span class="text-ink text-[15px] font-semibold">
            Closure rate over {query.to - query.from} years
          </span>
          <button
            type="button"
            onclick={() => (legendInfo = !legendInfo)}
            class="text-medium-blue text-[13px] hover:underline"
          >
            How are colors chosen?
          </button>
        </div>
        <div class="flex items-start gap-[22px]">
          <div class="flex flex-1">
            {#each CLASSES as cls (cls.label)}
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <div class="h-2.5" style:background={cls.color}></div>
                <span class="text-body text-[11.5px] whitespace-nowrap">{cls.label}</span>
              </div>
            {/each}
          </div>
          <div class="flex flex-[0_0_68px] flex-col gap-2">
            <div class="hatch-sm h-2.5"></div>
            <span class="text-body text-[11.5px]">No data</span>
          </div>
        </div>
        {#if legendInfo}
          <p
            class="border-rule text-muted mt-0.5 border-t pt-3 text-[12.5px] leading-normal text-pretty"
          >
            Fixed breaks at 2, 4, 6 and 9 percent, so the same shade means the same closure rate in
            every view and time window. Areas with fewer than 15 places of worship in the baseline
            year are hatched rather than colored.
          </p>
        {/if}
      </div>

      <div class="text-faint absolute right-[22px] bottom-5 text-[11px]">
        Data: [project] · U.S. Census Bureau
      </div>

      {#if view !== "State"}
        <div
          class="border-rule absolute top-[44%] left-1/2 max-w-80 -translate-x-1/2 -translate-y-1/2 rounded border bg-white px-[22px] py-4 text-center shadow-[0_12px_30px_-14px_rgba(0,0,0,.3)]"
        >
          <div class="text-ink text-[14px] font-semibold">{view} view — in build</div>
          <div class="text-muted mt-1 text-[12.5px] leading-normal">
            Finer geographies arrive with the full dataset. The state view is live.
          </div>
        </div>
      {/if}
    </div>

    <SelectionPanel {selection} from={query.from} onsummary={() => (summaryOpen = true)} />
  </div>
</main>

<SummaryDialog bind:open={summaryOpen} {selection} from={query.from} />
