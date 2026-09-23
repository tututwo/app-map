<script lang="ts">
import { ChevronDown } from "lucide-svelte";
import Dropdown from "$components/site/Dropdown.svelte";
import { FROM_YEARS, WINDOWS, TYPES, type TypeKey } from "$lib/explore/model";

// Both entry points expose only published windows. The two cells (`search-dates`, `search-type`) are
// placed by the bar around them, which draws the hairlines between cells.
let {
  from = $bindable(),
  to = $bindable(),
  type = $bindable(),
}: { from: number; to: number; type: TypeKey } = $props();

const fromOptions = FROM_YEARS.map((year) => ({ value: String(year), label: String(year) }));
const typeOptions = Object.entries(TYPES).map(([key, t]) => ({ value: key, label: t.label }));
// Windows include both endpoint years.
let toOptions = $derived(
  WINDOWS.filter((window) => window.from === from).map((window) => ({
    value: String(window.to),
    label: String(window.to),
    meta: `${window.to - window.from + 1} years`,
  }))
);

// Keep the selected pair inside the published window list.
function changeFrom(value: string) {
  const next = Number(value);
  const windows = WINDOWS.filter((window) => window.from === next);
  to = windows.find((window) => window.to === to)?.to ?? windows[0].to;
  from = next;
}

// Every field is a caps label over a 16px value, so labels and values line up across the row.
const field =
  "field flex min-h-14 cursor-pointer flex-col justify-center gap-1 self-stretch text-left";
const shown = "text-ink flex items-center gap-2 text-[16px] leading-6 font-medium";
</script>

{#snippet caret()}
  <ChevronDown
    size={12}
    strokeWidth={1.75}
    aria-hidden="true"
    class="field-icon field-caret text-muted shrink-0"
  />
{/snippet}

<div class="search-dates flex items-center bg-white">
  <Dropdown
    label="From"
    name="from"
    value={String(from)}
    options={fromOptions}
    onchange={changeFrom}
    class="{field} pr-3 pl-5"
  >
    {#snippet trigger()}
      <span class="label-caps">From</span>
      <span class={shown}>{from}{@render caret()}</span>
    {/snippet}
  </Dropdown>
  <!-- Built like a field so the dash sits on the values' line. -->
  <span class="flex flex-col gap-1" aria-hidden="true">
    <span class="label-caps invisible">–</span>
    <span class="text-faint text-[16px] leading-6">—</span>
  </span>
  <Dropdown
    label="To, inclusive"
    name="to"
    value={String(to)}
    options={toOptions}
    onchange={(value) => (to = Number(value))}
    class="{field} pr-5 pl-3"
  >
    {#snippet trigger()}
      <span class="label-caps whitespace-nowrap">To · inclusive</span>
      <span class={shown}>{to}{@render caret()}</span>
    {/snippet}
  </Dropdown>
</div>
<div class="search-type flex min-w-0 bg-white">
  <Dropdown
    label="Type"
    name="type"
    value={type}
    options={typeOptions}
    onchange={(value) => (type = value as TypeKey)}
    class="{field} w-full min-w-0 px-5"
  >
    {#snippet trigger()}
      <span class="label-caps">Type</span>
      <span class="{shown} justify-between">
        <span class="truncate">{TYPES[type].label}</span>{@render caret()}
      </span>
    {/snippet}
  </Dropdown>
</div>
