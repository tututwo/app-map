import manifest from "$lib/generated/sdoh-manifest.json";
import { inflated } from "./metrics";

/**
 * Community context (scripts/build-sdoh.py): 2010 census residents for every place the map draws, plus
 * the lab's social-determinant covariates for states, counties, ZIPs and tracts. Block groups, Alaska and
 * Hawaii have residents only, and ZIPs carry fewer covariates.
 */
export type ContextField = (typeof manifest.fields)[number];
export type Context = Record<ContextField, number | null>;

/** Every place of the Shard file that holds `id`; null when that Shard was never published. */
async function placesWith(level: string, id: string, fetcher: typeof fetch) {
  const published = (manifest.levels as Record<string, { release: string; shards: string[] }>)[
    level
  ];
  const shard = published?.shards.length === 1 ? published.shards[0] : id.slice(0, 2);
  if (!published?.shards.includes(shard)) return null;
  const buffer = await inflated(`sdoh/${level}/${published.release}/${shard}.json`, fetcher);
  return JSON.parse(new TextDecoder().decode(buffer)) as Record<string, (number | null)[]>;
}

// Trailing gaps are cut from a place's list, so a missing index is a gap too.
const contextOf = (values: (number | null)[]) =>
  Object.fromEntries(
    manifest.fields.map((field, index) => [field, values[index] ?? null])
  ) as Context;

export async function loadContext(
  level: string,
  id: string,
  fetcher: typeof fetch = fetch
): Promise<Context | null> {
  const values = (await placesWith(level, id, fetcher))?.[id];
  return values ? contextOf(values) : null;
}

/** Every state at once: the Summary sets a place beside its state, and adds up the nation's residents. */
export async function loadStateContexts(
  fetcher: typeof fetch = fetch
): Promise<Record<string, Context>> {
  const places = (await placesWith("state", "", fetcher)) ?? {};
  return Object.fromEntries(Object.entries(places).map(([id, values]) => [id, contextOf(values)]));
}
