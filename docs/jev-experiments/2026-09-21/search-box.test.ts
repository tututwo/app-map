// Throwaway: runs the REAL search (src/lib/explore/gazetteer.ts) over cases.mjs and writes what it did.
// Run: npx vitest run docs/jev-experiments/2026-09-21/search-box.test.ts   (OUT=after.json for a second run)
import { readFileSync, writeFileSync } from "node:fs";
import { test, vi } from "vitest";
import { looksLikeAddress, search } from "$lib/explore/gazetteer";
// @ts-expect-error plain JS data
import { CASES } from "./cases.mjs";

vi.stubGlobal("fetch", async (url: string) => {
  const name = String(url).split("/gazetteer/")[1];
  return new Response(readFileSync(`static/gazetteer/${name}`), { status: 200 });
});

test("what the search box does with each case", async () => {
  const rows = [];
  for (const { text, kind, want } of CASES) {
    // FindPlace.svelte: address-looking text keeps Enter for the Geocoder. Before 2026-09-21 (OLD=1) it was
    // not searched at all; now it is searched for a ZIP inside it.
    const street = looksLikeAddress(text);
    const started = performance.now();
    const hits = street && process.env.OLD ? [] : await search(text);
    const offered = hits.slice(0, 3).map((hit) => hit.label);
    rows.push({
      text,
      kind,
      want,
      enter: street ? "geocoder" : (offered[0] ?? null),
      offered,
      ms: +(performance.now() - started).toFixed(2),
      // Right when: Enter sends an address to the Geocoder; a place or ZIP is among the first three
      // options; anything else is told nothing matches instead of being sent somewhere wrong.
      right:
        kind === "street_address"
          ? street
          : want
            ? offered.includes(want)
            : !street && hits.length === 0,
    });
  }
  const out = new URL(`./${process.env.OUT ?? "baseline.json"}`, import.meta.url);
  writeFileSync(out, JSON.stringify(rows, null, 1));
  const byKind: Record<string, [number, number]> = {};
  for (const row of rows) {
    const tally = (byKind[row.kind] ??= [0, 0]);
    tally[0] += +row.right;
    tally[1]++;
  }
  console.log(byKind, "total right:", rows.filter((row) => row.right).length, "/", rows.length);
});
