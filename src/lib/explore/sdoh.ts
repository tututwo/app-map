import manifest from "$lib/generated/sdoh-manifest.json";
import { inflated } from "./metrics";

/**
 * Community context (scripts/build-sdoh.py): 2010 census residents for every place the map draws, plus
 * the lab's social-determinant covariates for states, counties, ZIPs and tracts. Block groups, Alaska and
 * Hawaii have residents only, and ZIPs carry fewer covariates.
 */
export type ContextField = (typeof manifest.fields)[number];
export type Context = Record<ContextField, number | null>;

export async function loadContext(
  level: string,
  id: string,
  fetcher: typeof fetch = fetch
): Promise<Context | null> {
  const published = (manifest.levels as Record<string, { release: string; shards: string[] }>)[
    level
  ];
  const shard = published?.shards.length === 1 ? published.shards[0] : id.slice(0, 2);
  if (!published?.shards.includes(shard)) return null;
  const buffer = await inflated(`sdoh/${level}/${published.release}/${shard}.json`, fetcher);
  const places: Record<string, (number | null)[]> = JSON.parse(new TextDecoder().decode(buffer));
  const values = places[id];
  return values
    ? // Trailing gaps are cut from a place's list, so a missing index is a gap too.
      (Object.fromEntries(
        manifest.fields.map((field, index) => [field, values[index] ?? null])
      ) as Context)
    : null;
}
