<script lang="ts">
import { Play } from "lucide-svelte";
import { CopyLink } from "$lib/copy-link.svelte";
import { fmt, per10k, type Selection } from "$lib/explore/model";

let { selection, onsummary }: { selection: Selection; onsummary: () => void } = $props();

const share = new CopyLink();

let s = $derived(selection.stat);
let stats = $derived([
  { value: fmt(s.closed), label: "Reported closures", color: "text-yale-blue" },
  { value: per10k(s.per10k), label: "Per 10,000 residents", color: "text-ink" },
  { value: fmt(s.nOpen), label: "Active during window", color: "text-ink" },
]);
let sentence = $derived(
  !selection.selected
    ? "Select a state, or any place on the map, to see reported closure counts. A national total is not available in this release."
    : s.closed === null
      ? `No ${selection.noun} were active in ${selection.name} during ${selection.range}, so there is no closure count.`
      : `${fmt(s.closed)} closures of ${selection.noun} are reported in ${selection.name} during ${selection.range}. Moves are excluded.`
);
</script>

<aside
  class="border-rule flex max-h-full min-h-0 max-w-full flex-[0_0_440px] flex-col gap-[18px] overflow-auto border-l bg-white px-[34px] pt-[30px] pb-[34px]"
>
  <div>
    <div class="label-caps">Showing</div>
    <h2 class="text-ink mt-1.5 mb-2 font-serif text-[40px] leading-[1.08] text-pretty">
      {selection.name}
    </h2>
    <div class="text-muted text-[13.5px]">{selection.windowText}</div>
  </div>
  <hr class="border-rule" />
  <div class="flex flex-wrap justify-between gap-4">
    {#each stats as stat (stat.label)}
      <div>
        <div class="font-serif text-[34px] leading-none {stat.color}">{stat.value}</div>
        <div class="label-caps mt-2">{stat.label}</div>
      </div>
    {/each}
  </div>
  <p class="text-body text-[15px] leading-[1.55] text-pretty">{sentence}</p>
  {#if selection.selected}
    <div>
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
        A place of worship can carry more than one type, so types can add up to more than the total.
        A dash means no place of that type was active here in this window.
      </p>
    </div>
    <div>
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
          research team in 2024. They describe the place, not the selected years.
        {:else}
          The research team's community measures cover states, counties, ZIP codes and tracts in the
          contiguous United States; none is published for this place.
        {/if}
      </p>
    </div>
  {/if}
  <div class="border-rule text-muted border-l-2 pl-3 text-[13.5px] leading-normal">
    Preliminary source counts. Population rates and active-place totals are withheld while source
    aggregation is reviewed.
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
        A preview of this selection’s reported closure counts.
      </p>
      <div class="text-faint font-mono text-[11px]">
        preview placeholder · layout designed later
      </div>
    </div>
  </div>
  <div class="flex gap-2.5">
    <button
      type="button"
      onclick={onsummary}
      class="bg-yale-blue h-[46px] flex-1 rounded-[3px] text-[14px] font-semibold text-white hover:brightness-[.92]"
    >
      View one-page summary →
    </button>
    <button
      type="button"
      onclick={() => share.copy()}
      class="border-field-border text-ink hover:border-ink h-[46px] flex-[0_0_84px] rounded-[3px] border bg-white text-[14px] font-semibold"
    >
      {share.copied ? "Copied" : "Share"}
    </button>
  </div>
  <div class="text-body text-[14px]">
    Counts cover the selected window, including both endpoint years.
  </div>
  <div>
    <a href="/request-data" class="text-medium-blue text-[14px] font-semibold hover:underline"
      >Request this data →</a
    >
    <div class="text-muted mt-2 text-[13.5px] leading-normal">{selection.requestText}</div>
  </div>
  <hr class="border-rule" />
  <!-- Links James's explainer video once it exists (handoff §6.13). -->
  <button type="button" class="flex items-center gap-4 text-left">
    <div class="hatch flex h-[52px] flex-[0_0_90px] items-center justify-center rounded-[3px]">
      <div
        class="flex size-[26px] items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.15)]"
      >
        <Play size={10} class="fill-ink text-ink ml-0.5" />
      </div>
    </div>
    <div>
      <div class="text-ink text-[14px] font-semibold">How to use this map</div>
      <div class="text-muted mt-0.5 text-[12px]">Video · 1 min · opens in a dialog</div>
    </div>
  </button>
</aside>
