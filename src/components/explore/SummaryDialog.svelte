<script lang="ts">
import { fmt, per10k, type Selection } from "$lib/explore/model";

let { selection, open = $bindable(false) }: { selection: Selection; open?: boolean } = $props();

let s = $derived(selection.stat);
let stats = $derived([
  [fmt(s.closed), "Reported closures"],
  [per10k(s.per10k), "Per 10,000 residents"],
  [fmt(s.nOpen), "Active during window"],
]);

// `toggle` (not `close`) mirrors the native state back: Chrome stops firing
// `close` on this element after a client-side navigation.
// The sheet is the only child, so a click on the dialog itself is the backdrop.
function onclick(event: MouseEvent & { currentTarget: HTMLDialogElement }) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}
</script>

<dialog
  {@attach (node: HTMLDialogElement) => (open ? node.showModal() : node.close())}
  ontoggle={(event) => (open = event.newState === "open")}
  {onclick}
  class="m-auto max-h-[calc(100%_-_64px)] w-[min(680px,calc(100%_-_64px))] border-0 bg-transparent p-0 backdrop:bg-[rgba(10,14,22,.55)]"
>
  <div
    class="max-h-full overflow-auto bg-white px-14 pt-11 pb-[52px] text-[#1a1a1a] shadow-[0_30px_80px_-20px_rgba(0,0,0,.5)]"
  >
    <div class="flex items-baseline justify-between gap-4 border-b-2 border-[#1a1a1a] pb-3">
      <div class="text-[10px] font-bold tracking-[.14em] uppercase">
        Yale School of Public Health · One-page summary
      </div>
      <button type="button" onclick={() => (open = false)} class="text-[13px] font-semibold"
        >Close ✕</button
      >
    </div>
    <h2 class="mt-[22px] mb-1.5 font-serif text-[36px] leading-[1.1]">{selection.name}</h2>
    <div class="text-[13px] text-[#666]">{selection.windowText}</div>
    <div class="mt-[26px] flex gap-10">
      {#each stats as [value, label] (label)}
        <div>
          <div class="font-serif text-[30px] leading-none">{value}</div>
          <div class="mt-1.5 text-[9.5px] font-bold tracking-[.14em] text-[#666] uppercase">
            {label}
          </div>
        </div>
      {/each}
    </div>
    <p class="mt-5 text-[12px] text-[#666]">
      Preliminary source counts. Population rates and active-place totals are withheld while source
      aggregation is reviewed.
    </p>
    <div
      class="mt-[26px] flex h-[220px] items-center justify-center p-5 text-center font-mono text-[11px] text-[#777]"
      style="background: repeating-linear-gradient(135deg, #efefef 0 6px, #dedede 6px 8px)"
    >
      map · closure counts · neighborhood indicators — layout designed later
    </div>
  </div>
</dialog>
