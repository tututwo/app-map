<script lang="ts">
import { fmt, type Selection, type TypeKey } from "$lib/explore/model";

/**
 * Reported closures by Type as bar rows: name | track | count, the handoff's "Compared with" bars. Every
 * row prints its count, so the bars need no axis. The mapped Type is drawn dark and the rest lighter;
 * with every Type mapped, all are dark.
 */
let {
  types,
  type,
  onpick,
  class: className,
}: {
  types: Selection["types"];
  type: TypeKey;
  /** Makes the rows toggles: a Type maps it, the mapped Type again maps them all. */
  onpick?: (type: TypeKey) => void;
  class?: string;
} = $props();

let max = $derived(Math.max(0, ...types.map((row) => row.closed ?? 0)));
// In proportion to the largest, but never so thin that a few closures read as none.
const width = (closed: number | null) =>
  closed && max ? `max(2px, ${(closed / max) * 100}%)` : "0px";
</script>

{#snippet bar(row: Selection["types"][number])}
  <span class={row.key === type ? "text-ink font-semibold" : "text-body"}>{row.label}</span>
  <span aria-hidden="true" class="bg-scale-1 h-2">
    <span
      class={[
        "block h-full rounded-e-[2px] transition-[width] duration-300 ease-out motion-reduce:transition-none",
        type === "all_religions" || row.key === type ? "bg-yale-blue" : "bg-scale-3",
      ]}
      style:width={width(row.closed)}
    ></span>
  </span>
  <span class="text-ink text-end font-semibold tabular-nums">{fmt(row.closed)}</span>
{/snippet}

<!-- Colors must reach paper: browsers drop backgrounds when printing unless told otherwise. -->
<ul
  class={[
    "grid grid-cols-[auto_minmax(3rem,1fr)_auto] gap-x-3 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]",
    onpick && "-mx-2",
    className,
  ]}
>
  {#each types as row (row.key)}
    <li class="col-span-3 grid grid-cols-subgrid items-center">
      {#if onpick}
        <button
          type="button"
          aria-pressed={row.key === type}
          onclick={() => onpick(row.key === type ? "all_religions" : row.key)}
          class="hover:bg-seg focus-visible:outline-yale-blue col-span-full grid grid-cols-subgrid items-center px-2 py-1 text-start transition-colors duration-150 focus-visible:outline-2"
        >
          {@render bar(row)}
        </button>
      {:else}
        <div class="col-span-full grid grid-cols-subgrid items-center py-px leading-tight">
          {@render bar(row)}
        </div>
      {/if}
    </li>
  {/each}
</ul>
