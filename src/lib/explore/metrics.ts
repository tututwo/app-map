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

// Files are immutable per release, so a settled request is kept for the life of the page (or server).
const cache = new Map<string, Promise<ArrayBuffer>>();

function file(level: Level, shard: string, name: string, fetcher: typeof fetch) {
  const url = `${env.PUBLIC_TILES_URL ?? "/tiles"}/metrics/${level}/${manifest.levels[level].release}/${shard}/${name}.gz`;
  let hit = cache.get(url);
  if (!hit) {
    hit = fetcher(url).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status} for ${url}`);
      const body = await response.arrayBuffer();
      const [a, b] = new Uint8Array(body, 0, 2);
      // A host that already inflated the file (Content-Encoding) hands over the plain bytes.
      if (a !== 0x1f || b !== 0x8b) return body;
      const inflated = new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Response(inflated).arrayBuffer();
    });
    hit.catch(() => cache.delete(url)); // a failed request may be retried
    cache.set(url, hit);
  }
  return hit;
}

const shards = new Map<string, Promise<Shard>>();
export function loadShard(level: Level, shard: string, fetcher: typeof fetch = fetch) {
  const key = `${level}/${shard}`;
  let hit = shards.get(key);
  if (!hit) {
    hit = file(level, shard, "geoids.json", fetcher).then((buffer) => {
      const geoids: string[] = JSON.parse(new TextDecoder().decode(buffer));
      return { geoids, row: new Map(geoids.map((geoid, index) => [geoid, index])) };
    });
    hit.catch(() => shards.delete(key));
    shards.set(key, hit);
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
