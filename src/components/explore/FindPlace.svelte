<script lang="ts">
import { STATES, findState, fmt } from "$lib/explore/model";

let {
  value,
  byId,
  onpick,
}: {
  /** Name of the selected state, or "" for the U.S. */
  value: string;
  /** Reported closures by state GEOID for the current window and type. */
  byId: Map<string, number | null>;
  onpick: (id: string) => void;
} = $props();

// What the user has typed since the last pick; null shows the selection.
let draft = $state<{ selection: string; text: string } | null>(null);
let open = $state(false);
let shown = $derived(draft?.selection === value ? draft.text : value);
let matches = $derived.by(() => {
  const q = shown.trim().toLowerCase();
  if (!open || !q) return [];
  return STATES.filter(
    (s) => s.name.toLowerCase().includes(q) || s.abbreviation.toLowerCase() === q || s.id === q
  ).slice(0, 6);
});

function pick(id: string) {
  draft = null;
  open = false;
  onpick(id);
}

function onkeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    const state = findState(shown);
    if (state) pick(state.id);
  }
  if (event.key === "Escape") open = false;
}

function meta(id: string) {
  const closed = byId.get(id) ?? null;
  return closed === null ? "No data" : `${fmt(closed)} reported closures`;
}
</script>

<div
  class="border-rule relative flex h-14 min-w-60 flex-[0_1_320px] items-center gap-3 border-r px-5"
>
  <label class="flex min-w-0 flex-1 flex-col gap-1">
    <span class="label-caps">Find a place</span>
    <input
      type="text"
      role="combobox"
      aria-expanded={matches.length > 0}
      aria-controls="find-options"
      aria-autocomplete="list"
      value={shown}
      oninput={(event) => {
        draft = { selection: value, text: event.currentTarget.value };
        open = true;
      }}
      onfocus={() => (open = true)}
      onblur={() => (open = false)}
      {onkeydown}
      placeholder="State or territory"
      class="text-ink placeholder:text-faint focus-visible:outline-yale-blue w-full text-[16px] focus-visible:outline-2 focus-visible:outline-offset-4"
    />
  </label>
  {#if matches.length}
    <div
      id="find-options"
      role="listbox"
      class="border-rule absolute top-full -right-px -left-px z-20 border border-t-0 bg-white py-1.5 shadow-[0_16px_28px_-14px_rgba(0,0,0,.3)]"
    >
      {#each matches as state (state.id)}
        <button
          type="button"
          role="option"
          aria-selected="false"
          onmousedown={(event) => event.preventDefault()}
          onclick={() => pick(state.id)}
          class="text-ink hover:bg-footer flex w-full justify-between gap-3 px-6 py-[9px] text-left text-[14px]"
        >
          <span>{state.name}</span>
          <span class="text-muted text-[12px] whitespace-nowrap">{meta(state.id)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
