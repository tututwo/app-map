import manifest from "$lib/generated/sdoh-manifest.json";
import { inflated } from "./metrics";

/**
 * Community context (scripts/build-sdoh.py): the lab's 2010 social-determinant covariates for states,
 * counties, ZIPs and tracts. There is none for block groups, Alaska or Hawaii, and ZIPs carry fewer fields.
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
    ? (Object.fromEntries(manifest.fields.map((field, index) => [field, values[index]])) as Context)
    : null;
}
