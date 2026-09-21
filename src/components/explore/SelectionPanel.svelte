<script lang="ts">
import { resolve } from "$app/paths";
import { prefersReducedMotion } from "svelte/motion";
import { fade } from "svelte/transition";
import { CopyLink } from "$lib/copy-link.svelte";
import { fmt, per10k, type Selection } from "$lib/explore/model";

// The Summary reads the same Query, so its link carries this page's own search.
let { selection, search }: { selection: Selection; search: string } = $props();

const share = new CopyLink();

let s = $derived(selection.stat);
let stats = $derived([
  { value: fmt(s.closed), label: "Reported closures", color: "text-yale-blue" },
  { value: per10k(s.per10k), label: "Per 10,000 residents", color: "text-ink" },
]);
// Zero closures, No observation, a Unit the source lacks and a failed load are four different facts.
let sentence = $derived.by(() => {
  const { status, name, noun, range, levelNoun } = selection;
  if (status === "none")
    return "Search for a place or click the map to say where to look. View by chooses what is reported there: the state, county, ZIP code, tract or block group around that point. A national total is not available in this release.";
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
  class="border-rule flex min-h-0 max-w-full flex-col gap-[18px] border-t bg-white px-5 pt-[30px] pb-[34px] lg:max-h-full lg:flex-[0_0_440px] lg:overflow-auto lg:border-t-0 lg:border-l lg:px-[34px]"
>
  <div>
    <div class="label-caps">Showing</div>
    {#key title}
      <h2
        in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}
        class="text-ink mt-1.5 mb-2 font-serif leading-[1.08] text-pretty {title.length > 30
          ? 'text-[28px]'
          : 'text-[40px]'}"
      >
        {title}
      </h2>
    {/key}
    <div class="text-muted text-[13.5px]">{selection.windowText}</div>
    {#if selection.because}
      <div class="text-body mt-1.5 text-[13.5px] text-pretty">{selection.because}</div>
    {/if}
    {#if selection.selected && selection.note}
      <div class="text-muted mt-1.5 text-[12.5px] leading-normal text-pretty">{selection.note}</div>
    {/if}
  </div>
  <hr class="border-rule" />
  <div class="flex flex-wrap gap-x-14 gap-y-4">
    {#each stats as stat (stat.label)}
      <div>
        {#key stat.value}
          <div
            in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}
            class="font-serif text-[34px] leading-none tabular-nums {stat.color}"
          >
            {stat.value}
          </div>
        {/key}
        <div class="label-caps mt-2">{stat.label}</div>
      </div>
    {/each}
  </div>
  <p class="text-body text-[15px] leading-[1.55] text-pretty" aria-live="polite">{sentence}</p>
  {#if selection.status === "ok"}
    <div in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}>
      <div class="label-caps">Reported closures by type</div>
      <ul class="mt-2.5 flex flex-col gap-1.5">
        {#each selection.types as type (type.key)}
          <li class="flex items-baseline justify-between gap-4 text-[14px]">
            <span class="text-body">{type.label}</span>
            <span class="text-ink font-semibold tabular-nums">{fmt(type.closed)}</span>
          </li>
        {/each}
      </ul>
      <p class="text-muted mt-2.5 text-[12.5px] leading-normal text-pretty">
        {#if selection.inactive.length}
          Not active here in this window, so not counted: {selection.inactive.join(", ")}.
        {/if}
        A place of worship can carry more than one type, so types can add up to more than the total.
      </p>
    </div>
  {/if}
  {#if selection.selected}
    <div in:fade={{ duration: prefersReducedMotion.current ? 100 : 180 }}>
      <div class="label-caps">Community context · 2010</div>
      {#if selection.context.length}
        <ul class="mt-2.5 flex flex-col gap-1.5">
          {#each selection.context as row (row.key)}
            <li class="flex items-baseline justify-between gap-4 text-[14px]">
              <span class="text-body">{row.label}</span>
              <span class="text-ink font-semibold tabular-nums">{row.value}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="text-muted mt-2.5 text-[12.5px] leading-normal text-pretty">
        {#if selection.context.length}
          Census Bureau and County Health Rankings figures on 2010 geography, compiled by the
          research team. They describe the place around 2010, not the selected years. Block groups,
          Alaska and Hawaii have residents only, and ZIP codes fewer measures.
        {:else}
          No community measures are published for this place.
        {/if}
      </p>
    </div>
  {/if}
  <div class="border-rule text-muted border-l-2 pl-3 text-[13.5px] leading-normal">
    Preliminary source counts. The rate divides them by the place's 2010 census residents;
    active-place totals are withheld while source aggregation is reviewed.
  </div>
  <hr class="border-rule" />
  <div class="flex items-start gap-[18px]">
    <div
      class="border-rule flex h-[142px] flex-[0_0_110px] flex-col gap-1.5 border bg-white px-2.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,.08)]"
    >
      <div class="bg-scale-4 h-1.5 w-[70%]"></div>
      <div class="bg-rule h-1 w-1/2"></div>
      <div
        class="mt-1 flex-1"
        style="background: repeating-linear-gradient(135deg, #dce5f1 0 5px, #a6bedf 5px 7px)"
      ></div>
      <div class="bg-rule h-1 w-[90%]"></div>
      <div class="bg-rule h-1 w-[60%]"></div>
    </div>
    <div class="flex min-w-0 flex-col gap-2">
      <div class="label-caps">One-page summary</div>
      <p class="text-body text-[14px] leading-normal text-pretty">
        A printable page for this selection: the map, the reported closures and the community
        measures. Save it as a PDF to share.
      </p>
    </div>
  </div>
  <div class="flex gap-2.5">
    <!-- Only a Selection with numbers has a Summary. -->
    {#if selection.status === "ok"}
      <a
        href="{resolve('/summary')}{search}"
        class="motion-control bg-yale-blue flex h-[46px] flex-1 items-center justify-center rounded-[3px] text-[14px] font-semibold text-white hover:brightness-[.92]"
      >
        View one-page summary →
      </a>
    {:else}
      <button
        type="button"
        disabled
        title="Choose a place with reported numbers first"
        class="bg-yale-blue h-[46px] flex-1 cursor-not-allowed rounded-[3px] text-[14px] font-semibold text-white opacity-40"
      >
        View one-page summary →
      </button>
    {/if}
    <button
      type="button"
      onclick={() => share.copy()}
      aria-live="polite"
      class="motion-control border-field-border text-ink hover:border-ink h-[46px] flex-[0_0_84px] rounded-[3px] border bg-white text-[14px] font-semibold"
    >
      {#key share.copied}
        <span in:fade={{ duration: 120 }}>{share.copied ? "Copied" : "Share"}</span>
      {/key}
    </button>
  </div>
  <div class="text-body text-[14px]">
    Counts cover the selected window, including both endpoint years.
  </div>
</aside>
