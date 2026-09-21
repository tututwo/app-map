<script lang="ts">
import { resolve } from "$app/paths";
import { page } from "$app/state";
import { onMount } from "svelte";
import { countsIn, levelBreaks } from "$lib/explore/load";
import { windowIndexOf } from "$lib/explore/metrics";
import {
  LEVEL_NOUNS,
  NO_DATA_COLOR,
  STATES,
  TILES,
  fmt,
  legendFor,
  manifest,
  parentOf,
  per10k,
  rated,
  selectionFor,
  unitFor,
  type Level,
} from "$lib/explore/model";
import {
  RELIABLE_FROM,
  contextRows,
  nationalStat,
  reliableRate,
  shareSearch,
} from "$lib/explore/summary";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
let query = $derived(data.query);
let selection = $derived(selectionFor(query, data.breakdown, data.context));
let unit = $derived(selection.selected);
let s = $derived(selection.stat);
let yearWindow = $derived(windowIndexOf(query.from, query.to));

// A ZIP nests in no state. The state at its Focus is read from the tiles, which only a browser can do,
// so it arrives after the page and is kept here rather than derived.
let zipState = $state<string>();
$effect(() => {
  const zip = unit?.level === "zcta" ? unit : undefined;
  const at = query.at;
  zipState = undefined;
  if (!zip) return;
  let live = true;
  void (async () => {
    const point = at ?? (await (await import("$lib/explore/gazetteer")).pointOf(zip));
    const id = point && (await (await import("$lib/explore/locate")).unitAt("state", point));
    if (live && id) zipState = id;
  })().catch(() => {});
  return () => {
    live = false;
  };
});
let stateId = $derived(
  unit && (unit.level === "state" ? unit.id : (parentOf(unit, "state") ?? zipState))
);
let stateName = $derived(STATES.find(({ id }) => id === stateId)?.name);
let stateContext = $derived((stateId && data.stateContexts?.[stateId]) || null);
let beside = $derived(unit?.level !== "state" && stateName ? stateName : undefined);

let place = $derived(
  unit?.level === "zcta" && stateName ? `${selection.name}, ${stateName}` : selection.name
);
let own = $derived(unit?.level === "state" ? selection.name : `This ${selection.levelNoun}`);
let title = $derived(
  `${selection.noun.replace(/^./, (first) => first.toUpperCase())} closed in ${place}, ${selection.range}`
);

// The count is the page's message. The rate only sets it beside the state and the nation.
let stateCounts = $derived(countsIn(data.states, yearWindow));
let compare = $derived.by(() => {
  const rows = [{ label: own, stat: s, own: true }];
  const row = stateId === undefined ? undefined : data.states?.shard.row.get(stateId);
  if (beside && row !== undefined)
    rows.push({
      label: beside,
      stat: rated(stateCounts[row], stateContext?.pop2010 ?? null),
      own: false,
    });
  if (data.states && data.stateContexts) {
    const residents = Object.fromEntries(
      Object.entries(data.stateContexts).map(([id, context]) => [id, context.pop2010])
    );
    rows.push({
      label: "United States",
      stat: nationalStat(data.states.shard.geoids, stateCounts, residents),
      own: false,
    });
  }
  return rows;
});
let withheld = $derived(
  compare.some(({ stat }) => stat.per10k !== null && stat.closed! < RELIABLE_FROM)
);

// Block groups have residents only, so the table describes the tract around them.
let tract = $derived(
  unit?.level === "blockgroup" ? unitFor(parentOf(unit, "tract") ?? "", "tract") : undefined
);
let tractLabel = $derived(tract?.name.split(",")[0]);
let measures = $derived(contextRows(tract ? data.tractContext : data.context, stateContext));

// Paper has one page: Types that closed take a cell each, the rest share a sentence.
let closedTypes = $derived(selection.types.filter((type) => type.closed));
let noneClosed = $derived(selection.types.filter((type) => !type.closed).map((type) => type.label));

let mapZoom = $state(3.5);
// Below its Reveal zoom a tiled Level still draws states, and the legend follows the map.
let drawnLevel = $derived<Level>(
  query.level !== "state" && mapZoom < TILES[query.level].revealZoom ? "state" : query.level
);
let breaks = $derived(levelBreaks(data, yearWindow));
let legend = $derived(legendFor(breaks[drawnLevel]));

// The link printed on the page. Paper shows it in full; the PDF keeps it clickable.
let share = $derived(shareSearch(query));

let MapComponent = $state<typeof import("$components/explore/StateMap.svelte").default>();
let mapFailed = $state(false);
// The reader's own date, so it is set in the browser and again whenever the page goes to paper.
let printed = $state("");
const stamp = () => (printed = new Date().toLocaleDateString("en-US", { dateStyle: "long" }));
onMount(() => {
  stamp();
  import("$components/explore/StateMap.svelte").then(
    (module) => (MapComponent = module.default),
    () => (mapFailed = true)
  );
});

// One type scale for the sheet: a phone reads it larger, paper and the desktop sheet at print sizes.
const table = "w-full border-collapse text-[14px] @[720px]:text-[12.5px]";
const columnHead = "pb-1.5 font-medium whitespace-nowrap";
const cell = "py-1 ps-3 text-end tabular-nums";
const small = "text-muted text-[12.5px] leading-[1.45] text-pretty @[720px]:text-[10.5px]";
</script>

<svelte:window onbeforeprint={stamp} />

<svelte:head>
  <title>{selection.status === "ok" ? title : "One-page summary"}</title>
  <!-- US Letter. The sheet draws its own margins, so the browser has no room for its header and footer. -->
  <style>
  @page {
    size: letter;
    margin: 0;
  }
  </style>
</svelte:head>

<main
  id="main-content"
  tabindex="-1"
  class="bg-footer min-h-[calc(100vh_-_65px)] px-4 pt-5 pb-12 print:min-h-0 print:bg-white print:p-0"
>
  <!-- The controls live here, outside the sheet: paper gets the sheet alone. -->
  <div
    class="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-5 print:hidden"
  >
    <a
      href="{resolve('/explore')}{page.url.search}"
      class="text-medium-blue text-[14px] font-semibold hover:underline">← Back to the map</a
    >
    {#if selection.status === "ok"}
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="text-muted text-[12.5px]">In the print dialog, choose “Save as PDF”.</span>
        <button
          type="button"
          onclick={() => window.print()}
          class="bg-yale-blue h-[42px] rounded-[3px] px-5 text-[14px] font-semibold whitespace-nowrap text-white hover:brightness-[.92]"
        >
          Save as PDF
        </button>
      </div>
    {/if}
  </div>

  {#if data.error}
    <div
      role="alert"
      class="mx-auto mb-5 flex max-w-[8.5in] items-center justify-between gap-4 bg-red-50 px-5 py-3 text-sm text-red-800 print:hidden"
    >
      <span>{data.error}</span>
      <button type="button" onclick={() => window.location.reload()} class="font-semibold underline"
        >Retry data</button
      >
    </div>
  {/if}

  <!-- The sheet lays itself out by its own width, so a phone, a desktop and paper share one set of rules. -->
  <article
    class="@container mx-auto max-w-[8.5in] bg-white shadow-[0_1px_3px_rgba(0,0,0,.08),0_14px_36px_-18px_rgba(0,0,0,.2)] print:max-w-none print:shadow-none"
  >
    {#if selection.status !== "ok"}
      <div class="flex flex-col items-start gap-4 px-5 py-10 @[720px]:px-[0.6in]">
        <h1 class="text-ink font-serif text-[28px] leading-[1.15]">No summary for this link</h1>
        <p class="text-body max-w-[60ch] text-[15px] leading-[1.55] text-pretty">
          {#if selection.status === "failed"}
            The numbers for this place could not be loaded. Check your connection, then reload the
            page.
          {:else if selection.status === "uncovered"}
            {selection.name} is not in the source data, so there is nothing to report for it. That is
            not the same as zero closures.
          {:else}
            A summary describes one place. Choose a state, county, ZIP code, tract or block group on
            the map, then open its summary from the panel.
          {/if}
        </p>
        <a
          href="{resolve('/explore')}{page.url.search}"
          class="bg-yale-blue flex h-[42px] items-center rounded-[3px] px-5 text-[14px] font-semibold text-white hover:brightness-[.92]"
          >Choose a place on the map →</a
        >
      </div>
    {:else}
      <div
        class="flex flex-col gap-8 px-5 py-7 @[720px]:gap-6 @[720px]:px-[0.6in] @[720px]:py-[0.5in]"
      >
        <header
          class="border-ink text-ink flex items-baseline justify-between gap-4 border-b-2 pb-2.5 text-[10px] font-bold tracking-[.14em] uppercase"
        >
          <span>Yale School of Public Health</span>
          <span>One-page summary</span>
        </header>

        <div class="flex flex-col gap-3">
          <h1 class="flex flex-wrap items-baseline-last gap-x-5 gap-y-1">
            <span
              class="text-yale-blue font-serif text-[68px] leading-[.85] tabular-nums @[720px]:text-[80px]"
              >{fmt(s.closed)}</span
            >
            <span
              class="text-ink min-w-[min(100%,15rem)] flex-1 font-serif text-[22px] leading-[1.2] text-balance @[720px]:text-[24px]"
            >
              {#if s.closed === null}
                No {selection.noun} were active in {place} during {selection.range}, so there is no
                closure count.
              {:else}
                reported {s.closed === 1 ? "closure" : "closures"} of {selection.noun} in {place},
                {selection.range}
              {/if}
            </span>
          </h1>
          <p
            class="text-body max-w-[70ch] text-[15px] leading-[1.5] text-pretty @[720px]:text-[13px]"
          >
            Counted from {query.from} through {query.to}. A closure is a place of worship that was
            active and then inactive for at least four years. Places that moved to another address
            are not counted.
          </p>
        </div>

        <!-- The two messages side by side: where the closures are, and what the community is like. -->
        <div
          class="grid gap-8 @[720px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @[720px]:gap-x-8"
        >
          <section aria-labelledby="where" class="flex flex-col gap-2.5">
            <h2 id="where" class="label-caps">
              Where · reported closures by {LEVEL_NOUNS[drawnLevel].one}
            </h2>
            <div class="bg-map relative h-[320px] overflow-hidden @[720px]:h-[3.15in]">
              {#if MapComponent}
                <MapComponent
                  still
                  bind:zoom={mapZoom}
                  selected={unit?.id ?? null}
                  focus={query.at}
                  onpick={() => {}}
                  level={query.level}
                  {yearWindow}
                  {breaks}
                  religion={query.type}
                />
              {:else}
                <div
                  role="status"
                  class="text-muted absolute inset-0 flex items-center justify-center text-[13px]"
                >
                  {mapFailed ? "The map could not be loaded." : "Loading map…"}
                </div>
              {/if}
            </div>
            <div class="text-body flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11.5px]">
              {#each [...legend.classes, { color: NO_DATA_COLOR, label: "No data" }] as cls (cls.label)}
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    class="size-2.5 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]"
                    style:background={cls.color}
                  ></span>
                  {cls.label}
                </span>
              {/each}
            </div>
            <p class={small}>
              The dark outline is {place}. Colors count the reported closures of {selection.noun} in
              each {LEVEL_NOUNS[drawnLevel].one}. Basemap © OpenStreetMap contributors, © CARTO.
            </p>
          </section>

          <div class="flex flex-col gap-8 @[720px]:gap-6">
            <section aria-labelledby="compare" class="flex flex-col gap-2">
              <h2 id="compare" class="label-caps">How it compares</h2>
              <table class={table}>
                <thead>
                  <tr class="text-muted text-[11px] @[720px]:text-[10.5px]">
                    <th scope="col" class="{columnHead} text-start">Place</th>
                    <th scope="col" class="{columnHead} ps-3 text-end">Closures</th>
                    <th scope="col" class="{columnHead} ps-3 text-end">Per 10,000 residents</th>
                  </tr>
                </thead>
                <tbody>
                  {#each compare as row (row.label)}
                    <tr
                      class="border-rule border-t {row.own
                        ? 'text-ink font-semibold'
                        : 'text-body'}"
                    >
                      <th scope="row" class="py-1 text-start [font-weight:inherit]">{row.label}</th>
                      <td class={cell}>{fmt(row.stat.closed)}</td>
                      <td class={cell}>{per10k(reliableRate(row.stat))}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              {#if withheld}
                <p class={small}>
                  No rate is shown below {RELIABLE_FROM} closures: so few make an unstable rate.
                </p>
              {/if}
            </section>

            <section aria-labelledby="community" class="flex flex-col gap-2">
              <h2 id="community" class="label-caps">The community · around 2010</h2>
              {#if measures.length}
                <table class={table}>
                  <thead>
                    <tr class="text-muted text-[11px] @[720px]:text-[10.5px]">
                      <th scope="col" class="{columnHead} text-start">Measure</th>
                      <th scope="col" class="{columnHead} ps-3 text-end">{tractLabel ?? own}</th>
                      {#if beside}
                        <th scope="col" class="{columnHead} ps-3 text-end">{beside}</th>
                      {/if}
                    </tr>
                  </thead>
                  <tbody>
                    {#each measures as row (row.key)}
                      <tr class="border-rule border-t">
                        <th scope="row" class="text-body py-1 text-start font-normal"
                          >{row.label}</th
                        >
                        <td class="{cell} text-ink font-semibold">{row.place}</td>
                        {#if beside}
                          <td class="{cell} text-body">{row.state}</td>
                        {/if}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {:else}
                <p class="text-body text-[14px] leading-normal @[720px]:text-[12.5px]">
                  No community measures are published for this place.
                </p>
              {/if}
              <!-- The research team's one-sentence finding and its citation go here (Yusuf's copy). Until
                   then the page sets the two side by side and claims no link between them. -->
              <p class={small}>
                {#if tractLabel}
                  Not published for block groups, so {tractLabel} around it is shown.
                {:else if unit?.level === "zcta"}
                  Income, poverty, unemployment and education are not published for ZIP codes.
                {/if}
                {#if measures.length > 1}
                  These measures describe the community around 2010. They do not explain why places
                  of worship closed here.
                {:else if measures.length}
                  Other community measures are not published for this place.
                {/if}
              </p>
            </section>
          </div>
        </div>

        <section aria-labelledby="types" class="flex flex-col gap-2">
          <h2 id="types" class="label-caps">Reported closures by type</h2>
          {#if closedTypes.length}
            <ul
              class="grid gap-x-8 text-[14px] @[440px]:grid-cols-2 @[720px]:grid-cols-3 @[720px]:text-[12.5px]"
            >
              {#each closedTypes as type (type.key)}
                <li
                  class="border-rule flex items-baseline justify-between gap-4 border-t py-1 {type.key ===
                  query.type
                    ? 'text-ink font-semibold'
                    : 'text-body'}"
                >
                  <span>{type.label}</span>
                  <span class="tabular-nums">{fmt(type.closed)}</span>
                </li>
              {/each}
            </ul>
          {/if}
          <p class={small}>
            {#if noneClosed.length}None reported for: {noneClosed.join(", ")}.{/if}
            {#if selection.inactive.length}
              Not active here in these years: {selection.inactive.join(", ")}.
            {/if}
            A place of worship can carry more than one type, so types can add up to more than the total.
          </p>
        </section>

        <footer class="border-rule flex flex-col gap-2.5 border-t pt-3">
          <p class="{small} @[720px]:columns-2 @[720px]:gap-x-8">
            Preliminary counts from the research team’s source data; they may change as the data are
            reviewed. Rates divide closures by the {manifest.boundaryYear} census residents. The United
            States row adds up every state and the District of Columbia. {selection.note}
            Community measures are Census Bureau and County Health Rankings figures on {manifest.boundaryYear}
            geography, compiled by the research team. Places are drawn on {manifest.boundaryYear} census
            boundaries.
          </p>
          <p class="{small} flex flex-wrap justify-between gap-x-6 gap-y-1">
            <a href="{resolve('/summary')}?{share}" class="text-ink break-all"
              >{page.url.host}{resolve("/summary")}?{share}</a
            >
            {#if printed}<span class="whitespace-nowrap">Printed {printed}</span>{/if}
          </p>
        </footer>
      </div>
    {/if}
  </article>
</main>
