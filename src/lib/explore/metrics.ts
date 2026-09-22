import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import manifest from "$lib/generated/metrics-manifest.json";

/**
 * The Metric cube (scripts/build-metrics.py): one file per Level, Type and Shard holds reported
 * closures for every Year Window. Fine-level maps read derived single-window columns instead.
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

/** Cube shards: state/county are national, ZIPs use two-digit ZIP prefixes, tracts/block groups use states. */
export const shardOf = (level: Level, geoid: string) =>
  manifest.levels[level].shards.length === 1 ? manifest.levels[level].shards[0] : geoid.slice(0, 2);
export const shardsOf = (level: Level) => manifest.levels[level].shards;

/** Read a published `.gz` file. Each reader caches its final representation, not another copy of these bytes. */
export async function inflated(path: string, fetcher: typeof fetch) {
  const url = `${env.PUBLIC_TILES_URL ?? "/tiles"}/${path}.gz`;
  const response = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const body = await response.arrayBuffer();
  const [a, b] = new Uint8Array(body);
  // A host that already inflated the file (Content-Encoding) hands over the plain bytes.
  if (a !== 0x1f || b !== 0x8b) return body;
  const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

const file = (level: Level, shard: string, name: string, fetcher: typeof fetch) =>
  inflated(`metrics/${level}/${manifest.levels[level].release}/${shard}/${name}`, fetcher);

const shards = new Map<string, Promise<Shard>>();
function readShard(buffer: ArrayBuffer): Shard {
  const geoids: string[] = JSON.parse(new TextDecoder().decode(buffer));
  return { geoids, row: new Map(geoids.map((geoid, index) => [geoid, index])) };
}
export function loadShard(level: Level, shard: string, fetcher: typeof fetch = fetch) {
  const key = `${level}/${shard}`;
  let hit = browser ? shards.get(key) : undefined;
  if (!hit) {
    hit = file(level, shard, "geoids.json", fetcher).then(readShard);
    if (browser) {
      hit.catch(() => shards.delete(key));
      shards.set(key, hit);
    }
  }
  return hit;
}

// Immutable files stay cached in the browser only. Workers must not share request I/O or retain matrices.
const matrices = new Map<string, Promise<Counts>>();
// ponytail: every Type is a dense rows x windows matrix (California block groups: 4.4 MB inflated each).
// Store sparse rows for the minor Types if memory on phones ever matters.
export async function loadCounts(
  level: Level,
  shard: string,
  religion: string,
  fetcher: typeof fetch = fetch
): Promise<Counts> {
  const key = `${level}/${shard}/${religion}`;
  let hit = browser ? matrices.get(key) : undefined;
  if (!hit) {
    hit = file(level, shard, `${religion}.bin`, fetcher).then((buffer) =>
      manifest.levels[level].dtype === "u8" ? new Uint8Array(buffer) : new Uint16Array(buffer)
    );
    if (browser) {
      hit.catch(() => matrices.delete(key));
      matrices.set(key, hit);
    }
  }
  return hit;
}

/** Reported closures, or null where no place of worship of that Type was active in the window. */
export function valueAt(counts: Counts, row: number, yearWindow: number): number | null {
  const value = counts[row * WINDOW_COUNT + yearWindow];
  return value === (counts instanceof Uint8Array ? 255 : 65535) ? null : value;
}

export interface MapValues {
  shard: Shard;
  /** Only the selected Year Window; null still means no observation, not zero closures. */
  values: (number | null)[];
}
const mapSlices = new Map<string, Promise<MapValues>>();

/** Fine levels load one national column; state and county reuse their small cached matrices. */
export async function loadMapValues(
  level: Level,
  religion: string,
  yearWindow: number,
  fetcher: typeof fetch = fetch
): Promise<MapValues> {
  if (!Number.isInteger(yearWindow) || yearWindow < 0 || yearWindow >= WINDOW_COUNT)
    throw new Error("Invalid map Year Window");
  if (!RELIGIONS.some((type) => type === religion)) throw new Error("Invalid map Type");
  if (level === "state" || level === "county") {
    const [rows, counts] = await Promise.all([
      loadShard(level, "us", fetcher),
      loadCounts(level, "us", religion, fetcher),
    ]);
    return { shard: rows, values: rows.geoids.map((_, row) => valueAt(counts, row, yearWindow)) };
  }

  const folder = `map/${level}/${manifest.levels[level].release}`;
  let rows = browser ? shards.get(folder) : undefined;
  if (!rows) {
    rows = inflated(`${folder}/geoids.json`, fetcher).then(readShard);
    if (browser) {
      rows.catch(() => shards.delete(folder));
      shards.set(folder, rows);
    }
  }
  const key = `${folder}/${religion}/${yearWindow}`;
  let hit = browser ? mapSlices.get(key) : undefined;
  if (!hit) {
    hit = Promise.all([rows, inflated(`${key}.bin`, fetcher)]).then(([shard, buffer]) => {
      const { dtype, places } = manifest.levels[level];
      if (shard.geoids.length !== places || buffer.byteLength !== places * (dtype === "u8" ? 1 : 2))
        throw new Error(`Invalid map slice for ${key}`);
      const counts = dtype === "u8" ? new Uint8Array(buffer) : new Uint16Array(buffer);
      const missing = dtype === "u8" ? 255 : 65535;
      return { shard, values: Array.from(counts, (value) => (value === missing ? null : value)) };
    });
    if (browser) {
      hit.catch(() => {
        if (mapSlices.get(key) === hit) mapSlices.delete(key);
      });
      mapSlices.set(key, hit);
    }
  } else {
    mapSlices.delete(key);
    mapSlices.set(key, hit);
  }
  // Keep recent filter choices without retaining all 253 windows for every Type.
  if (mapSlices.size > 8) mapSlices.delete(mapSlices.keys().next().value!);
  return hit;
}

// One place is a few kilobytes, and a new Year Window reads the same one again.
const places = new Map<string, Promise<Counts>>();
/**
 * One place's counts, Types x Year Windows (scripts/build-rows.py): two small ranged reads of the Shard's
 * rows.bin instead of its ten matrices.
 */
function loadPlace(level: Level, shard: string, row: number, rows: number, fetcher: typeof fetch) {
  const { release, dtype } = manifest.levels[level];
  const url = `${env.PUBLIC_TILES_URL ?? "/tiles"}/metrics/${level}/${release}/${shard}/rows.bin`;
  const key = `${url}#${row}`;
  let hit = browser ? places.get(key) : undefined;
  if (!hit) {
    hit = (async () => {
      // A host that ignores Range answers with the whole file (SvelteKit's own read of a static file
      // does); both reads are then cut from that one copy.
      let whole: ArrayBuffer | undefined;
      const read = async (from: number, to: number) => {
        if (whole) return whole.slice(from, to + 1);
        const response = await fetcher(url, {
          headers: { range: `bytes=${from}-${to}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status === 206) return response.arrayBuffer();
        if (response.status !== 200) {
          await response.body?.cancel();
          throw new Error(`${response.status} for ${url}`);
        }
        whole = await response.arrayBuffer();
        return whole.slice(from, to + 1);
      };
      // The file opens with one little-endian uint32 offset per place, and one more for the end.
      const entry = await read(row * 4, row * 4 + 7);
      if (entry.byteLength !== 8) throw new Error(`Invalid row offsets for ${url}`);
      const offsets = new DataView(entry);
      const data = 4 * (rows + 1);
      const start = offsets.getUint32(0, true);
      const end = offsets.getUint32(4, true);
      if (end <= start) throw new Error(`Invalid row range for ${url}`);
      const packed = await read(data + start, data + end - 1);
      const stream = new Blob([packed])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      const counts = await new Response(stream).arrayBuffer();
      if (counts.byteLength !== RELIGIONS.length * WINDOW_COUNT * (dtype === "u8" ? 1 : 2))
        throw new Error(`Invalid row counts for ${url}`);
      return dtype === "u8" ? new Uint8Array(counts) : new Uint16Array(counts);
    })();
    if (browser) {
      hit.catch(() => places.delete(key));
      places.set(key, hit);
    }
  }
  return hit;
}

/** One Unit, one window, every Type; null when the source does not contain the Unit. */
export async function loadBreakdown(
  level: Level,
  geoid: string,
  yearWindow: number,
  fetcher: typeof fetch = fetch
): Promise<Record<string, number | null> | null> {
  const shard = shardOf(level, geoid);
  // A Shard the source never published (a ZIP prefix with no ZIPs) is a missing Unit, not a failure.
  if (!shardsOf(level).includes(shard)) return null;
  const { row, geoids } = await loadShard(level, shard, fetcher);
  const index = row.get(geoid);
  if (index === undefined) return null;
  const place = await loadPlace(level, shard, index, geoids.length, fetcher);
  return Object.fromEntries(
    RELIGIONS.map((religion, type) => [religion, valueAt(place, type, yearWindow)])
  );
}
