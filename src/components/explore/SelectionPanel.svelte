<script lang="ts">
import { Play } from "lucide-svelte";
import { CopyLink } from "$lib/copy-link.svelte";
import { fmt, pct, type Selection } from "$lib/explore/model";

let { selection, from, onsummary }: { selection: Selection; from: number; onsummary: () => void } =
  $props();

const share = new CopyLink();

let s = $derived(selection.stat);
let stats = $derived([
  { value: s.nodata ? "—" : pct(s.rate), label: "Closure rate", color: "text-yale-blue" },
  { value: s.nodata ? "—" : fmt(s.closed), label: "Closed", color: "text-ink" },
  { value: fmt(s.open), label: `Open in ${from}`, color: "text-ink" },
]);
let sentence = $derived(
  s.nodata
    ? `Fewer than 15 ${selection.noun} were open in ${selection.name} in ${from}, so no closure rate is reported.`
    : `${fmt(s.closed)} of the ${fmt(s.open)} ${selection.noun} open in ${from} closed during ${selection.range}.`
);
let diff = $derived(s.rate - selection.us.rate);
let diffText = $derived(
  Math.abs(diff) < 0.05
    ? `About the same as the U.S. rate (${pct(selection.us.rate)}).`
    : `${Math.abs(diff).toFixed(1)} percentage points ${diff < 0 ? "below" : "above"} the U.S. rate (${pct(selection.us.rate)}).`
);
const bar = (rate: number) => `${Math.min(100, (rate / 14) * 100)}%`;
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
  {#if selection.selected && !s.nodata}
    <div class="flex flex-col gap-2.5">
      <div class="label-caps">Compared with</div>
      <div class="flex items-center gap-3.5">
        <span class="text-ink flex-[0_0_118px] truncate text-[14px] font-semibold">
          {selection.name}
        </span>
        <div class="bg-scale-1 h-2 flex-1">
          <div
            class="bg-yale-blue h-full transition-[width] duration-300"
            style:width={bar(s.rate)}
          ></div>
        </div>
        <span class="text-ink flex-[0_0_44px] text-right text-[13.5px] font-semibold">
          {pct(s.rate)}
        </span>
      </div>
      <div class="flex items-center gap-3.5">
        <span class="text-body flex-[0_0_118px] text-[14px]">United States</span>
        <div class="bg-scale-1 h-2 flex-1">
          <div
            class="bg-scale-3 h-full transition-[width] duration-300"
            style:width={bar(selection.us.rate)}
          ></div>
        </div>
        <span class="text-body flex-[0_0_44px] text-right text-[13.5px]">
          {pct(selection.us.rate)}
        </span>
      </div>
      <div class="text-muted text-[13.5px]">{diffText}</div>
    </div>
  {:else if !selection.selected}
    <div class="border-rule text-muted border-l-2 pl-3 text-[13.5px] leading-normal">
      Click a state on the map to compare it with the national rate.
    </div>
  {/if}
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
        A printable page for this selection: the map, closure counts and neighborhood indicators —
        poverty, education, income.
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
  <div class="text-body text-[14px]">Local context, community indicators and sources.</div>
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
