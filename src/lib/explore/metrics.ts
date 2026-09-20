import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import manifest from "$lib/generated/metrics-manifest.json";

/**
 * The Metric cube (scripts/build-metrics.py): one Shard file per Level, Type and Shard holds reported
 * closures for every Year Window, so changing the window is an array lookup and never a request.
 */
export type Level = keyof typeof manifest.levels;
export type Counts = Uint8Array | Uint16Array;
export interface Shard {
  /** Row order of every Counts matrix of this Shard. */
  geoids: string[];
  row: Map<string, number>;
}

export const RELIGIONS = manifest.religions;
const WINDOW_COUNT = manifest.windows.length;
const windowIndex = new Map(manifest.windows.map(([from, to], index) => [`${from}_${to}`, index]));
export const windowIndexOf = (from: number, to: number) => windowIndex.get(`${from}_${to}`) ?? -1;

/** Tracts and block groups ship one state at a time; the other Levels are a single national Shard. */
export const shardOf = (level: Level, geoid: string) =>
  manifest.levels[level].shards.length === 1 ? manifest.levels[level].shards[0] : geoid.slice(0, 2);
export const shardsOf = (level: Level) => manifest.levels[level].shards;

// Immutable files stay cached in the browser only. Workers must not share request I/O or retain matrices.
const cache = new Map<string, Promise<ArrayBuffer>>();

/** A published `.gz` file under PUBLIC_TILES_URL, inflated. */
export function inflated(path: string, fetcher: typeof fetch) {
  const url = `${env.PUBLIC_TILES_URL ?? "/tiles"}/${path}.gz`;
  let hit = browser ? cache.get(url) : undefined;
  if (!hit) {
    hit = fetcher(url).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status} for ${url}`);
      const body = await response.arrayBuffer();
      const [a, b] = new Uint8Array(body, 0, 2);
      // A host that already inflated the file (Content-Encoding) hands over the plain bytes.
      if (a !== 0x1f || b !== 0x8b) return body;
      const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Response(stream).arrayBuffer();
    });
    if (browser) {
      hit.catch(() => cache.delete(url)); // a failed request may be retried
      cache.set(url, hit);
    }
  }
  return hit;
}

const file = (level: Level, shard: string, name: string, fetcher: typeof fetch) =>
  inflated(`metrics/${level}/${manifest.levels[level].release}/${shard}/${name}`, fetcher);

const shards = new Map<string, Promise<Shard>>();
export function loadShard(level: Level, shard: string, fetcher: typeof fetch = fetch) {
  const key = `${level}/${shard}`;
  let hit = browser ? shards.get(key) : undefined;
  if (!hit) {
    hit = file(level, shard, "geoids.json", fetcher).then((buffer) => {
      const geoids: string[] = JSON.parse(new TextDecoder().decode(buffer));
      return { geoids, row: new Map(geoids.map((geoid, index) => [geoid, index])) };
    });
    if (browser) {
      hit.catch(() => shards.delete(key));
      shards.set(key, hit);
    }
  }
  return hit;
}

// ponytail: every Type is a dense rows x windows matrix (California block groups: 4.4 MB inflated each).
// Store sparse rows for the minor Types if memory on phones ever matters.
export async function loadCounts(
  level: Level,
  shard: string,
  religion: string,
  fetcher: typeof fetch = fetch
): Promise<Counts> {
  const buffer = await file(level, shard, `${religion}.bin`, fetcher);
  return manifest.levels[level].dtype === "u8" ? new Uint8Array(buffer) : new Uint16Array(buffer);
}

/** Reported closures, or null where no place of worship of that Type was active in the window. */
export function valueAt(counts: Counts, row: number, yearWindow: number): number | null {
  const value = counts[row * WINDOW_COUNT + yearWindow];
  return value === (counts instanceof Uint8Array ? 255 : 65535) ? null : value;
}

/** One place, one window, every Type. */
export async function loadBreakdown(
  level: Level,
  geoid: string,
  yearWindow: number,
  fetcher: typeof fetch = fetch
): Promise<Record<string, number | null>> {
  const shard = shardOf(level, geoid);
  if (!browser) {
    const { row } = await loadShard(level, shard, fetcher);
    const index = row.get(geoid);
    const breakdown: Record<string, number | null> = {};
    // Read one matrix at a time so a deep link does not retain all ten in a 128 MB Worker.
    for (const religion of RELIGIONS)
      breakdown[religion] =
        index === undefined
          ? null
          : valueAt(await loadCounts(level, shard, religion, fetcher), index, yearWindow);
    return breakdown;
  }
  const [{ row }, ...counts] = await Promise.all([
    loadShard(level, shard, fetcher),
    ...RELIGIONS.map((religion) => loadCounts(level, shard, religion, fetcher)),
  ]);
  const index = row.get(geoid);
  return Object.fromEntries(
    RELIGIONS.map((religion, i) => [
      religion,
      index === undefined ? null : valueAt(counts[i], index, yearWindow),
    ])
  );
}
