import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { csvParse } from "d3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredColumns = [
  "geoid",
  "boundaryYear",
  "window",
  "religion",
  "closed",
  "per10k",
  "nOpen",
];

/** @param {string} value @param {string} label @param {boolean} count */
function metric(value, label, count) {
  if (value === "") return null;
  const number = Number(value);
  if (
    !value.trim() ||
    !Number.isFinite(number) ||
    number < 0 ||
    (count && !Number.isSafeInteger(number))
  ) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(value)}`);
  }
  return number;
}

/**
 * Preserve missing observations as null; reject duplicate identities rather than summing them.
 * @param {string} csv
 * @param {{ boundaryYear: number, withheldMetrics?: string[] }} release
 * @param {Set<string>} geometryIds
 */
export function parseStateMetrics(csv, release, geometryIds) {
  const parsed = csvParse(csv);
  for (const column of requiredColumns) {
    if (!parsed.columns.includes(column)) throw new Error(`Missing state column: ${column}`);
  }
  const seen = new Set();
  const rows = parsed.map((row) => {
    if (!/^\d{2}$/.test(row.geoid) || row.geoid === "00")
      throw new Error(`Invalid state GEOID: ${row.geoid}`);
    if (!geometryIds.has(row.geoid)) throw new Error(`State GEOID has no geometry: ${row.geoid}`);
    if (row.boundaryYear !== String(release.boundaryYear))
      throw new Error(`Unexpected boundary year: ${row.boundaryYear}`);
    if (row.religion !== "all_religions") throw new Error(`Unsupported religion: ${row.religion}`);
    const window = /^(\d{4})_(\d{4})$/.exec(row.window);
    if (!window || Number(window[2]) - Number(window[1]) < 4)
      throw new Error(`Invalid state window: ${row.window}`);
    const identity = `${row.geoid}/${row.boundaryYear}/${row.window}/${row.religion}`;
    if (seen.has(identity)) throw new Error(`Duplicate state metric: ${identity}`);
    seen.add(identity);
    return {
      geoid: row.geoid,
      window: row.window,
      religion: row.religion,
      closed: metric(row.closed, `${identity}/closed`, true),
      per10k: metric(row.per10k, `${identity}/per10k`, false),
      nOpen: metric(row.nOpen, `${identity}/nOpen`, true),
    };
  });
  if (!rows.length) throw new Error("State metric release has no rows");
  for (const row of rows) {
    if (release.withheldMetrics?.includes("per10k")) row.per10k = null;
    if (release.withheldMetrics?.includes("nOpen")) row.nOpen = null;
  }
  return rows.sort((a, b) => a.window.localeCompare(b.window) || a.geoid.localeCompare(b.geoid));
}

async function main() {
  const csv = await readFile(resolve(root, "data-raw/state_metrics.csv"), "utf8");
  const release = JSON.parse(await readFile(resolve(root, "data-raw/state-release.json"), "utf8"));
  const geometry = JSON.parse(await readFile(resolve(root, release.geometry.asset), "utf8"));
  const geometryIds = new Set(
    geometry.objects.states.geometries.map(
      /** @param {{ id: string }} feature */ (feature) => String(feature.id)
    )
  );
  if (!/^[a-f0-9]{64}$/.test(release.source.sha256))
    throw new Error("Missing source Parquet SHA-256");
  if (
    !release.breaks.length ||
    release.breaks.some(
      /** @param {number} value @param {number} index */ (value, index) =>
        !Number.isFinite(value) || value <= 0 || (index > 0 && value <= release.breaks[index - 1])
    )
  ) {
    throw new Error("State legend thresholds must be finite, positive and ascending");
  }
  const rows = parseStateMetrics(csv, release, geometryIds);
  const windows = [...new Set(rows.map((row) => row.window))].map((key) => {
    const [from, to] = key.split("_").map(Number);
    return { key, from, to, boundaryYear: release.boundaryYear };
  });
  const manifest = {
    ...release,
    csvSha256: createHash("sha256").update(csv).digest("hex"),
    level: "state",
    closureVariant: "no_moves",
    windows,
    religions: ["all_religions"],
    rowCount: rows.length,
    geoidCount: new Set(rows.map((row) => row.geoid)).size,
    noDataGeoids: [...geometryIds].filter((id) => !rows.some((row) => row.geoid === id)).sort(),
  };
  const serverPath = resolve(root, "src/lib/server/data/generated-state/state-metrics.json");
  const manifestPath = resolve(root, "src/lib/generated/state-manifest.json");
  await Promise.all([
    mkdir(dirname(serverPath), { recursive: true }),
    mkdir(dirname(manifestPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(serverPath, `${JSON.stringify(rows)}\n`),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
  console.log(
    `[prebuild-state] ${rows.length} state rows; ${windows.length} observed windows; boundary ${release.boundaryYear}`
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
