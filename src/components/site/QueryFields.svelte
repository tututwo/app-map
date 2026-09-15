<script lang="ts">
import { ChevronDown } from "lucide-svelte";
import { FROM_YEARS, GAP, TO_MAX, TYPES, type TypeKey } from "$lib/explore/model";

// FROM — TO · 5+ YEARS LATER and TYPE: the same pair on the landing bar (small)
// and the Explore toolbar (large).
let {
  from = $bindable(),
  to = $bindable(),
  type = $bindable(),
  large = false,
}: { from: number; to: number; type: TypeKey; large?: boolean } = $props();

let toYears = $derived(Array.from({ length: TO_MAX - from - GAP + 1 }, (_, i) => from + GAP + i));

// Changing From bumps To to at least From + 5. To is written first so a
// URL-backed parent folds both writes into one navigation.
function changeFrom(event: Event & { currentTarget: HTMLSelectElement }) {
  const next = Number(event.currentTarget.value);
  if (to < next + GAP) to = next + GAP;
  from = next;
}

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yale-blue";
let field = $derived(large ? "flex flex-col gap-1" : "flex flex-col gap-1.5");
let select = $derived(
  `${focus} cursor-pointer appearance-none ${large ? "pr-[22px] text-[16px] font-medium" : "pr-5 text-[14px] font-semibold"}`
);
let caret = $derived(`pointer-events-none absolute text-muted ${large ? "right-1" : "right-0.5"}`);
</script>

<div
  class="border-rule flex items-center gap-3.5 border-r {large
    ? 'h-14 px-5'
    : 'px-5 pt-3.5 pb-[13px]'}"
>
  <label class={field}>
    <span class="label-caps">From</span>
    <span class="text-ink relative flex items-center">
      <select name="from" value={from} onchange={changeFrom} class={select}>
        {#each FROM_YEARS as year (year)}
          <option value={year}>{year}</option>
        {/each}
      </select>
      <ChevronDown size={10} strokeWidth={1.5} class={caret} />
    </span>
  </label>
  <span class="text-faint {large ? 'mt-3.5' : 'mt-[18px]'}">—</span>
  <label class={field}>
    <span class="label-caps whitespace-nowrap">To · 5+ years later</span>
    <span class="text-ink relative flex items-center">
      <select name="to" bind:value={to} class={select}>
        {#each toYears as year (year)}
          <option value={year}>{year}</option>
        {/each}
      </select>
      <ChevronDown size={10} strokeWidth={1.5} class={caret} />
    </span>
  </label>
</div>
<div
  class={large
    ? "border-rule flex h-14 items-center border-r px-5"
    : "flex min-w-0 flex-[1_1_220px] flex-col px-5 pt-3.5 pb-[13px]"}
>
  <label class="{field} {large ? '' : 'w-full'}">
    <span class="label-caps">Type</span>
    <span class="text-ink relative flex items-center">
      <select name="type" bind:value={type} class="{select} {large ? '' : 'w-full'}">
        {#each Object.entries(TYPES) as [key, t] (key)}
          <option value={key}>{t.label}</option>
        {/each}
      </select>
      <ChevronDown size={10} strokeWidth={1.5} class={caret} />
    </span>
  </label>
</div>
