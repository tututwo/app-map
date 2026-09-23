<script lang="ts">
import { ChevronDown } from "lucide-svelte";
import Dropdown from "$components/site/Dropdown.svelte";
import { FROM_YEARS, WINDOWS, TYPES, type TypeKey } from "$lib/explore/model";

// Both entry points expose only published windows.
let {
  from = $bindable(),
  to = $bindable(),
  type = $bindable(),
  large = false,
}: { from: number; to: number; type: TypeKey; large?: boolean } = $props();

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

let field = $derived(
  `field flex cursor-pointer flex-col justify-center gap-1 self-stretch text-left ${large ? "min-h-14" : "pt-3.5 pb-[13px]"}`
);
let shown = $derived(
  `text-ink flex items-center gap-2 ${large ? "text-[16px] font-medium" : "text-[14px] font-semibold"}`
);
</script>

{#snippet caret()}
  <ChevronDown
    size={12}
    strokeWidth={1.75}
    aria-hidden="true"
    class="field-icon field-caret text-muted shrink-0"
  />
{/snippet}

<div class="border-rule flex items-center border-r">
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
  <span class="text-faint {large ? 'mt-3.5' : 'mt-[18px]'}" aria-hidden="true">—</span>
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
<div class={large ? "border-rule flex border-r" : "flex min-w-0 flex-[1_1_220px]"}>
  <Dropdown
    label="Type"
    name="type"
    value={type}
    options={typeOptions}
    onchange={(value) => (type = value as TypeKey)}
    class="{field} min-w-0 px-5 {large ? '' : 'w-full'}"
  >
    {#snippet trigger()}
      <span class="label-caps">Type</span>
      <span class="{shown} justify-between">
        <span class="truncate">{TYPES[type].label}</span>{@render caret()}
      </span>
    {/snippet}
  </Dropdown>
</div>
