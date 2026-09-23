<script lang="ts">
import { resolve } from "$app/paths";
import { prefersReducedMotion } from "svelte/motion";
import { fade } from "svelte/transition";
import TypeBars from "$components/explore/TypeBars.svelte";
import { CopyLink } from "$lib/copy-link.svelte";
import { fmt, per10k, type Selection, type TypeKey } from "$lib/explore/model";

// The Summary reads the same Query, so its link carries this page's own search.
let {
  selection,
  search,
  ontype,
}: { selection: Selection; search: string; ontype: (type: TypeKey) => void } = $props();

const share = new CopyLink();

let s = $derived(selection.stat);
let stats = $derived([
  {
    value: fmt(s.closed),
    label: "Reported closures",
    style: "text-yale-blue text-[36px] sm:text-[42px]",
  },
  { value: per10k(s.per10k), label: "Per 10,000 residents", style: "text-ink text-[32px]" },
]);
// Zero closures, No observation, a Unit the source lacks and a failed load are four different facts.
let sentence = $derived.by(() => {
  const { status, name, noun, range, levelNoun } = selection;
  if (status === "none")
    return "Search for a place or click the map to say where to look. View by chooses what is reported there: the state, county, ZCTA, tract or block group around that point. A national total is not available in this release.";
  if (status === "locating") return `Finding the ${levelNoun} at this point…`;
  if (status === "outside")
    return `No ${levelNoun} in the data contains this point. Click inside the United States, or search for another place.`;
  if (status === "failed")
    return `The numbers for this ${levelNoun} could not be loaded. Check your connection, then click the map again.`;
  if (status === "uncovered")
    return `${name} is not in the source data, so there is nothing to report for it. That is not the same as zero closures.`;
  if (s.closed === null)
    return `No ${noun} were active in ${name} during ${range}, so there is no closure count.`;
  return `${fmt(s.closed)} ${s.closed === 1 ? "closure" : "closures"} of ${noun} ${s.closed === 1 ? "is" : "are"} reported in ${name} during ${range}. Moves are excluded.`;
});
let title = $derived(
  selection.status === "outside" ? `No ${selection.levelNoun} here` : selection.name
);
</script>

<aside
  aria-label="Selection details"
  class="border-rule flex min-h-0 max-w-full flex-col gap-6 border-t bg-white px-5 py-7 lg:max-h-full lg:flex-[0_0_440px] lg:overflow-auto lg:border-t-0 lg:border-l lg:px-7 lg:py-8"
>
  <header>
    <div class="label-caps">Showing</div>
    {#key title}
      <h2
        in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}
        class="text-ink mt-2 mb-2.5 font-serif leading-[1.1] tracking-[-.025em] text-pretty {title.length >
        30
          ? 'text-[28px]'
          : 'text-[38px]'}"
      >
        {title}
      </h2>
    {/key}
    <div class="text-muted text-[13px] font-medium">{selection.windowText}</div>
    {#if selection.because}
      <div class="text-body mt-3 text-[13.5px] leading-normal text-pretty">{selection.because}</div>
    {/if}
    {#if selection.selected && selection.note}
      <div class="text-muted mt-2 text-[12.5px] leading-normal text-pretty">{selection.note}</div>
    {/if}
  </header>
  <dl class="border-rule grid grid-cols-2 gap-5 border-y py-5">
    {#each stats as stat (stat.label)}
      <div class="flex min-w-0 flex-col gap-2">
        <dt class="text-body order-2 text-[12px] leading-snug font-medium">{stat.label}</dt>
        <dd class="flex min-h-12 items-end">
          {#key stat.value}
            <span
              in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}
              class="font-serif leading-none tracking-[-.025em] tabular-nums {stat.style}"
            >
              {stat.value}
            </span>
          {/key}
        </dd>
      </div>
    {/each}
  </dl>
  <p class="text-body text-[14px] leading-[1.6] text-pretty" aria-live="polite">{sentence}</p>
  {#if selection.status === "ok"}
    <div in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}>
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="text-ink text-[13px] font-semibold">Reported closures by type</h3>
        {#if selection.types.length > 1}
          <span class="text-muted text-[12px]">Click a type to map it</span>
        {/if}
      </div>
      <TypeBars
        class="mt-2 text-[14px]"
        types={selection.types}
        type={selection.type}
        onpick={ontype}
      />
      <p class="text-muted mt-3 text-[12px] leading-relaxed text-pretty">
        {#if selection.inactive.length}
          Not active here in this window, so not counted: {selection.inactive.join(", ")}.
        {/if}
        A place of worship can carry more than one type, so types can add up to more than the total.
      </p>
    </div>
  {/if}
  {#if selection.selected}
    <div in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}>
      <h3 class="text-ink text-[13px] font-semibold">Community context · 2010</h3>
      {#if selection.context.length}
        <ul class="mt-3 flex flex-col gap-2">
          {#each selection.context as row (row.key)}
            <li class="flex items-baseline justify-between gap-4 text-[14px]">
              <span class="text-body">{row.label}</span>
              <span class="text-ink shrink-0 font-semibold tabular-nums">{row.value}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="text-muted mt-3 text-[12px] leading-relaxed text-pretty">
        {#if selection.context.length}
          Census Bureau and County Health Rankings figures on 2010 geography, compiled by the
          research team. They describe the place around 2010, not the selected years. Block groups,
          Alaska and Hawaii have residents only, and ZCTAs fewer measures.
        {:else}
          No community measures are published for this place.
        {/if}
      </p>
    </div>
  {/if}
  <p class="text-muted text-[12px] leading-relaxed">
    Preliminary source counts. The rate divides them by the place's 2010 census residents;
    active-place totals are withheld while source aggregation is reviewed.
  </p>
  <section
    class="border-rule flex flex-col gap-4 border-t pt-5"
    aria-labelledby="selection-summary"
  >
    <div>
      <h3 id="selection-summary" class="text-ink text-[13px] font-semibold">One-page summary</h3>
      <p class="text-body mt-1.5 text-[13px] leading-normal text-pretty">
        A printable page for this selection: the map, the reported closures and the community
        measures. Save it as a PDF to share.
      </p>
    </div>
    <div class="flex gap-2.5">
      <!-- Only a Selection with numbers has a Summary. -->
      {#if selection.status === "ok"}
        <a
          href="{resolve('/summary')}{search}"
          class="motion-control bg-yale-blue flex min-h-11 min-w-0 flex-1 items-center justify-center px-3 py-2.5 text-center text-[13px] font-semibold text-white hover:brightness-[.92]"
        >
          View one-page summary →
        </a>
      {:else}
        <button
          type="button"
          disabled
          title="Choose a place with reported numbers first"
          class="bg-yale-blue min-h-11 min-w-0 flex-1 cursor-not-allowed px-3 py-2.5 text-[13px] font-semibold text-white opacity-40"
        >
          View one-page summary →
        </button>
      {/if}
      <button
        type="button"
        onclick={() => share.copy()}
        aria-live="polite"
        class="motion-control border-field-border text-ink hover:border-ink min-h-11 shrink-0 border bg-white px-4 py-2.5 text-[13px] font-semibold"
      >
        {#key share.copied}
          <span in:fade={{ duration: 120 }}>{share.copied ? "Copied" : "Share"}</span>
        {/key}
      </button>
    </div>
    <p class="text-muted text-[12px] leading-relaxed">
      Counts cover the selected window, including both endpoint years.
    </p>
  </section>
</aside>
