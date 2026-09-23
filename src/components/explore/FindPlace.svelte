<script lang="ts">
import { onDestroy } from "svelte";
import { prefersReducedMotion } from "svelte/motion";
import { scale } from "svelte/transition";
import { Search } from "lucide-svelte";
import { geocode, looksLikeAddress, search, warm, type Hit } from "$lib/explore/gazetteer";
import { fmt, type Level, type LngLat } from "$lib/explore/model";

let {
  value,
  byId,
  onpick,
  label = "Find a place",
  class: wrapper = "min-h-14 items-center px-5",
  icon = true,
}: {
  /** Label of the Location that set the Focus, or "" when the map did. */
  value: string;
  /** Reported closures by state GEOID for the current window and type, where the page has them. */
  byId?: Map<string, number | null>;
  /** A Location only says where to look; one that is itself a Unit also names its Level. */
  onpick: (pick: {
    at: LngLat;
    level?: Level;
    geoid?: string;
    near: string;
    address?: string;
  }) => void;
  label?: string;
  /** Size, padding and alignment of the field inside its bar. */
  class?: string;
  /** False where a search button next to the field carries the magnifier (Home). */
  icon?: boolean;
} = $props();

// What the user has typed since the last pick; null shows the Focus's Location.
let draft = $state<{ selection: string; text: string } | null>(null);
let open = $state(false);
let hits = $state.raw<Hit[]>([]);
let active = $state(0);
// Why the list is empty, or how the address lookup is going.
let note = $state("");
let busy = $state(false);
let shown = $derived(draft?.selection === value ? draft.text : value);
let address = $derived(looksLikeAddress(shown));
// An address is not in any table: the last option sends it to the Geocoder.
let options = $derived(open ? hits.length + (address ? 1 : 0) : 0);

// The newest keystroke owns the list.
let ticket = 0;
onDestroy(() => ticket++);
async function find(text: string) {
  const mine = ++ticket;
  hits = [];
  busy = false;
  note = "";
  active = 0;
  if (text.trim().length < 2) return;
  // An address is searched too, for a ZIP inside it ("06511 New Haven"), but the lookup keeps Enter.
  const street = looksLikeAddress(text);
  if (!street) note = "Finding places…";
  try {
    const found = await search(text);
    if (mine !== ticket) return;
    hits = found;
    active = street ? found.length : 0;
    note =
      !found.length && !street && text.trim().length > 2
        ? "No state, county, ZIP code or city matches. For a street address, start with the house number."
        : "";
  } catch {
    if (mine === ticket && !street)
      note = "The list of places could not be loaded. Check your connection and type again.";
  }
}

function pick(hit: Hit) {
  draft = null;
  close();
  onpick({ at: hit.at, level: hit.unit?.level, geoid: hit.unit?.geoid, near: hit.label });
}

async function lookUp() {
  const mine = ++ticket;
  const enteredAddress = shown;
  busy = true;
  note = "Looking up the address…";
  try {
    const match = await geocode(enteredAddress);
    if (mine !== ticket) return;
    if (match) {
      close();
      // Keep the original text visible until the parent accepts it; the URL carries only the Focus.
      onpick({ at: match.at, near: "address", address: enteredAddress });
    } else
      note =
        "No address matches. Check the house number and street, add the city or ZIP code, or search for the city instead.";
  } catch {
    if (mine === ticket)
      note = "Address lookup is not available right now. Search for a city or a ZIP code instead.";
  } finally {
    if (mine === ticket) busy = false;
  }
}

/** Acts on the typed text as Enter does; false when the field is empty, so a form can go on. */
export function go() {
  if (!shown.trim()) return false;
  if (hits.length || address) choose(active);
  else {
    document.getElementById("find-input")?.focus();
    void find(shown);
  }
  return true;
}

function close() {
  open = false;
  hits = [];
  note = "";
}

function choose(index: number) {
  if (index < hits.length) pick(hits[index]);
  else if (address && !busy) void lookUp();
}

function onkeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    open = true;
    if (options) active = (active + (event.key === "ArrowDown" ? 1 : options - 1)) % options;
  } else if (event.key === "Enter") {
    // An empty field lets Home's form go on to the map; typed text must not be dropped on the way.
    if (options || shown.trim()) event.preventDefault();
    if (options) choose(active);
  } else if (event.key === "Escape") open = false;
}

function meta(hit: Hit) {
  if (hit.unit?.level !== "state" || !byId) return hit.kind;
  const closed = byId.get(hit.unit.geoid) ?? null;
  return closed === null ? "State · no data" : `State · ${fmt(closed)} reported closures`;
}
</script>

<div class="field relative z-10 flex cursor-text gap-3 {wrapper}">
  {#if icon}
    <Search
      size={18}
      strokeWidth={1.75}
      aria-hidden="true"
      class="field-icon text-muted shrink-0"
    />
  {/if}
  <label class="flex min-w-0 flex-1 flex-col gap-1">
    <span class="label-caps">{label}</span>
    <input
      id="find-input"
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-expanded={options > 0}
      aria-controls={open && (options || note) ? "find-options" : undefined}
      aria-autocomplete="list"
      aria-activedescendant={options ? `find-option-${active}` : undefined}
      aria-describedby={open && note ? "find-note" : undefined}
      value={shown}
      oninput={(event) => {
        draft = { selection: value, text: event.currentTarget.value };
        open = true;
        void find(event.currentTarget.value);
      }}
      onfocus={() => {
        open = true;
        warm();
      }}
      onblur={() => (open = false)}
      {onkeydown}
      placeholder="City, county, ZIP code, state or address"
      class="text-ink placeholder:text-faint w-full bg-transparent text-[16px] leading-6 text-ellipsis outline-none"
    />
  </label>
  {#if open && (options || note)}
    <div
      transition:scale={{
        start: prefersReducedMotion.current ? 1 : 0.98,
        duration: prefersReducedMotion.current ? 100 : 180,
      }}
      class="place-suggestions dropdown absolute top-full -right-px -left-px z-20 origin-top-left cursor-default"
    >
      <div id="find-options" role="listbox" aria-label="Places">
        {#each hits as hit, index (`${hit.label}|${hit.kind}|${hit.at}`)}
          <button
            type="button"
            role="option"
            tabindex="-1"
            id="find-option-{index}"
            aria-selected={index === active}
            data-highlighted={index === active ? "" : undefined}
            onmousedown={(event) => event.preventDefault()}
            onmousemove={() => (active = index)}
            onclick={() => choose(index)}
            class="dropdown-option px-5"
          >
            <span>{hit.label}</span>
            <span class="text-muted ml-auto pl-3 text-[12px] whitespace-nowrap tabular-nums"
              >{meta(hit)}</span
            >
          </button>
        {/each}
        {#if address}
          <button
            type="button"
            role="option"
            tabindex="-1"
            id="find-option-{hits.length}"
            aria-selected={active === hits.length}
            data-highlighted={active === hits.length ? "" : undefined}
            disabled={busy}
            onmousedown={(event) => event.preventDefault()}
            onmousemove={() => (active = hits.length)}
            onclick={() => choose(hits.length)}
            class="dropdown-option px-5"
          >
            <span>Look up the address “{shown.trim()}”</span>
            <span class="text-muted ml-auto pl-3 text-[12px] whitespace-nowrap"
              >Street address · Enter</span
            >
          </button>
        {/if}
      </div>
      <p
        id="find-note"
        role="status"
        class="text-muted px-5 text-[12.5px] leading-normal text-pretty {note ? 'py-2' : ''}"
      >
        {note}
      </p>
    </div>
  {/if}
</div>

<style>
@media (prefers-reduced-motion: reduce) {
  .place-suggestions {
    transform: none !important;
  }
}
</style>
