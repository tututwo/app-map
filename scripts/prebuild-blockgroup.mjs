import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { csvParse } from "d3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wide CSV (geoid, one count column per window) to window → state Shard → geoid → count.
 * A missing observation is left out, so the map reads an absent key as No data; zero stays zero.
 * @param {string} csv
 * @param {{ states: string[] }} release
 */
export function parseBlockGroupMetrics(csv, release) {
  const parsed = csvParse(csv);
  const [first, ...windows] = parsed.columns;
  if (first !== "geoid" || !windows.length || windows.some((key) => !/^\d{4}_\d{4}$/.test(key)))
    throw new Error(`Unexpected block-group columns: ${parsed.columns.join(",")}`);
  const seen = new Set();
  /** @type {Record<string, Record<string, Record<string, number>>>} */
  const shards = Object.fromEntries(
    windows.map((key) => [key, Object.fromEntries(release.states.map((state) => [state, {}]))])
  );
  for (const row of parsed) {
    const state = row.geoid.slice(0, 2);
    if (!/^\d{12}$/.test(row.geoid) || !release.states.includes(state))
      throw new Error(`Invalid block-group GEOID: ${row.geoid}`);
    if (seen.has(row.geoid)) throw new Error(`Duplicate block group: ${row.geoid}`);
    seen.add(row.geoid);
    for (const key of windows) {
      if (row[key] === "") continue;
      const count = Number(row[key]);
      if (!row[key].trim() || !Number.isSafeInteger(count) || count < 0)
        throw new Error(`Invalid ${row.geoid}/${key}: ${JSON.stringify(row[key])}`);
      shards[key][state][row.geoid] = count;
    }
  }
  if (!seen.size) throw new Error("Block-group release has no rows");
  return { windows, shards, geoidCount: seen.size };
}

async function main() {
  const csv = await readFile(resolve(root, "data-raw/blockgroup_metrics.csv"), "utf8");
  const release = JSON.parse(
    await readFile(resolve(root, "data-raw/blockgroup-release.json"), "utf8")
  );
  const { windows, shards, geoidCount } = parseBlockGroupMetrics(csv, release);
  const manifest = {
    ...release,
    csvSha256: createHash("sha256").update(csv).digest("hex"),
    level: "blockgroup",
    closureVariant: "no_moves",
    windows,
    religions: ["all_religions"],
    geoidCount,
  };
  const serverPath = resolve(
    root,
    "src/lib/server/data/generated-blockgroup/blockgroup-metrics.json"
  );
  const manifestPath = resolve(root, "src/lib/generated/blockgroup-manifest.json");
  await mkdir(dirname(serverPath), { recursive: true });
  await Promise.all([
    writeFile(serverPath, `${JSON.stringify(shards)}\n`),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
  console.log(
    `[prebuild-blockgroup] ${geoidCount} block groups; ${windows.length} windows; ${release.states.length} state shard(s)`
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
