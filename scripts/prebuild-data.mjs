import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, parse, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { csvParse } from "d3";

const BUILD_VERSION = 2;
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

/** @typedef {Record<string, string>} CsvRow */
/** @typedef {{ map: string, line: string, stacked: string, sideMetric: string }} Sources */
/** @typedef {{ year: number, close: number }} LineDatum */
/** @typedef {{ year: number, negative: number, neutral: number, positive: number }} StackedDatum */

/** @param {string} outputDir */
function assertSafeOutputDirectory(outputDir) {
  const resolvedOutput = resolve(outputDir);
  const root = parse(resolvedOutput).root;

  if (resolvedOutput === root || resolvedOutput === repositoryRoot) {
    throw new Error(`Refusing to replace unsafe generated-data directory: ${resolvedOutput}`);
  }
}

/** @param {string} path */
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveDefaultSources() {
  const sideMetricInDataRaw = join(repositoryRoot, "data-raw/sideMetricData.csv");

  return {
    map: join(repositoryRoot, "data-raw/counties_all.csv"),
    line: join(repositoryRoot, "data-raw/brushableLineChartData.csv"),
    stacked: join(repositoryRoot, "data-raw/stackedBarChart.csv"),
    sideMetric: (await exists(sideMetricInDataRaw))
      ? sideMetricInDataRaw
      : join(repositoryRoot, "src/data/sideMetricData.csv"),
  };
}

/** @param {Sources} sources */
async function sourceSignature(sources) {
  const sourceStats = await Promise.all(
    Object.entries(sources).map(async ([name, path]) => {
      const metadata = await stat(path);
      return { name, path: resolve(path), size: metadata.size, mtimeMs: metadata.mtimeMs };
    })
  );
  const scriptMetadata = await stat(scriptPath);
  const input = JSON.stringify({
    version: BUILD_VERSION,
    sources: sourceStats,
    script: { size: scriptMetadata.size, mtimeMs: scriptMetadata.mtimeMs },
  });

  return createHash("sha256").update(input).digest("hex");
}

/** @param {string[]} columns */
function discoverMapRanges(columns) {
  const columnSet = new Set(columns);
  /** @type {string[]} */
  const ranges = [];

  for (const column of columns) {
    const range = /^closure_count_(\d{4}-\d{4})$/.exec(column)?.[1];
    if (
      range &&
      columnSet.has(`closure_rate_per_10000_${range}`) &&
      columnSet.has(`persistence_${range}`) &&
      columnSet.has(`reopening_count_${range}`)
    ) {
      ranges.push(range);
    }
  }

  return ranges;
}

/**
 * Derive the year-window bounds implied by the discovered map ranges, and
 * assert the set is exactly "every window within bounds meeting the minimum
 * gap" — the runtime domain module (src/lib/domain/yearWindow.ts) relies on
 * that algebra describing the generated files completely.
 *
 * @param {string[]} mapRanges
 * @returns {{ minYear: number, maxYear: number, minGap: number }}
 */
export function deriveYearWindowBounds(mapRanges) {
  const windows = mapRanges.map((range) => range.split("-").map(Number));
  const minYear = Math.min(...windows.map(([from]) => from));
  const maxYear = Math.max(...windows.map(([, to]) => to));
  const minGap = Math.min(...windows.map(([from, to]) => to - from));

  const expected = new Set();
  for (let from = minYear; from <= maxYear - minGap; from += 1) {
    for (let to = from + minGap; to <= maxYear; to += 1) {
      expected.add(`${from}-${to}`);
    }
  }

  const actual = new Set(mapRanges);
  const missing = [...expected].filter((range) => !actual.has(range));
  const extra = [...actual].filter((range) => !expected.has(range));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Map ranges are not fully described by bounds ${minYear}-${maxYear} with minimum gap ${minGap}` +
        (missing.length ? `; missing: ${missing.join(", ")}` : "") +
        (extra.length ? `; unexpected: ${extra.join(", ")}` : "")
    );
  }

  return { minYear, maxYear, minGap };
}

/**
 * @template {{ year: number }} T
 * @param {CsvRow[]} rows
 * @param {(row: CsvRow) => T} project
 * @returns {Record<string, T[]>}
 */
function groupSeriesByGeoid(rows, project) {
  /** @type {Record<string, T[]>} */
  const byGeoid = {};

  for (const row of rows) {
    (byGeoid[row.geoid] ??= []).push(project(row));
  }

  for (const series of Object.values(byGeoid)) {
    series.sort((a, b) => a.year - b.year);
  }

  return byGeoid;
}

/** @param {CsvRow[]} rows @returns {LineDatum[]} */
function aggregateLineSeries(rows) {
  /** @type {Map<number, number>} */
  const byYear = new Map();

  for (const row of rows) {
    const year = +row.year;
    byYear.set(year, (byYear.get(year) ?? 0) + +row.close);
  }

  return Array.from(byYear, ([year, close]) => ({ year, close })).sort((a, b) => a.year - b.year);
}

/** @param {CsvRow[]} rows @returns {StackedDatum[]} */
function aggregateStackedSeries(rows) {
  /** @type {Map<number, Omit<StackedDatum, "year">>} */
  const byYear = new Map();

  for (const row of rows) {
    const year = +row.year;
    const current = byYear.get(year) ?? { negative: 0, neutral: 0, positive: 0 };
    byYear.set(year, {
      negative: current.negative + +row.negative,
      neutral: current.neutral + +row.neutral,
      positive: current.positive + +row.positive,
    });
  }

  return Array.from(byYear, ([year, values]) => ({ year, ...values })).sort(
    (a, b) => a.year - b.year
  );
}

/** @param {string} outputDir @param {string} signature */
async function outputIsCurrent(outputDir, signature) {
  try {
    /** @type {{ version: number, signature: string, files: string[], mapRanges: string[] }} */
    const manifest = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
    if (manifest.version !== BUILD_VERSION || manifest.signature !== signature) return null;

    const present = await Promise.all(manifest.files.map((file) => exists(join(outputDir, file))));
    if (present.some((value) => !value)) return null;

    return manifest;
  } catch {
    return null;
  }
}

/** @param {string} path @param {unknown} value */
async function writeCompressedJson(path, value) {
  await writeFile(path, gzipSync(JSON.stringify(value), { level: 9 }));
}

/**
 * Compile raw dashboard CSVs into immutable runtime artifacts.
 *
 * @param {{
 *   sources: { map: string, line: string, stacked: string, sideMetric: string },
 *   outputDir: string,
 *   force?: boolean
 * }} options
 */
export async function buildGeneratedData({ sources, outputDir, force = false }) {
  assertSafeOutputDirectory(outputDir);
  const signature = await sourceSignature(sources);

  if (!force) {
    const manifest = await outputIsCurrent(outputDir, signature);
    if (manifest) {
      return { generated: false, mapRanges: manifest.mapRanges };
    }
  }

  const [mapCsv, lineCsv, stackedCsv, sideMetricCsv] = await Promise.all([
    readFile(sources.map, "utf8"),
    readFile(sources.line, "utf8"),
    readFile(sources.stacked, "utf8"),
    readFile(sources.sideMetric, "utf8"),
  ]);
  const mapRows = /** @type {CsvRow[] & { columns: string[] }} */ (csvParse(mapCsv));
  const lineRows = /** @type {CsvRow[]} */ (csvParse(lineCsv));
  const stackedRows = /** @type {CsvRow[]} */ (csvParse(stackedCsv));
  const sideMetricRows = /** @type {CsvRow[]} */ (csvParse(sideMetricCsv));
  const mapRanges = discoverMapRanges(mapRows.columns);

  if (mapRanges.length === 0) {
    throw new Error("No complete map year ranges were found in the source CSV headers");
  }
  deriveYearWindowBounds(mapRanges);

  const temporaryOutput = `${resolve(outputDir)}.tmp-${process.pid}-${Date.now()}`;
  const mapOutput = join(temporaryOutput, "map");
  await mkdir(mapOutput, { recursive: true });

  try {
    await Promise.all(
      mapRanges.map(async (range) => {
        const rows = mapRows.map((row) => ({
          geoid: row.geoid,
          name: row.name,
          closure: +row[`closure_count_${range}`],
          closure_rate_per_10000: +row[`closure_rate_per_10000_${range}`],
          persistence: +row[`persistence_${range}`],
          reopening: +row[`reopening_count_${range}`],
        }));
        await writeCompressedJson(join(mapOutput, `${range}.json.gz`), rows);
      })
    );

    const lineByGeoid = groupSeriesByGeoid(lineRows, (row) => ({
      year: +row.year,
      close: +row.close,
    }));
    lineByGeoid["00000"] = aggregateLineSeries(lineRows);

    const stackedByGeoid = groupSeriesByGeoid(stackedRows, (row) => ({
      year: +row.year,
      negative: +row.negative,
      neutral: +row.neutral,
      positive: +row.positive,
    }));
    stackedByGeoid["00000"] = aggregateStackedSeries(stackedRows);

    const sideMetricByGeoid = Object.fromEntries(
      sideMetricRows.map((row) => [row.geoid, { ...row }])
    );

    await Promise.all([
      writeCompressedJson(join(temporaryOutput, "line_by_geoid.json.gz"), lineByGeoid),
      writeCompressedJson(join(temporaryOutput, "stacked_by_geoid.json.gz"), stackedByGeoid),
      writeCompressedJson(join(temporaryOutput, "side_metric_by_geoid.json.gz"), sideMetricByGeoid),
    ]);

    const files = [
      ...mapRanges.map((range) => `map/${range}.json.gz`),
      "line_by_geoid.json.gz",
      "stacked_by_geoid.json.gz",
      "side_metric_by_geoid.json.gz",
    ];
    await writeFile(
      join(temporaryOutput, "manifest.json"),
      JSON.stringify({
        version: BUILD_VERSION,
        signature,
        mapRanges,
        files,
        sources: Object.fromEntries(
          Object.entries(sources).map(([name, path]) => [name, relative(repositoryRoot, path)])
        ),
      })
    );

    await rm(resolve(outputDir), { recursive: true, force: true });
    await mkdir(dirname(resolve(outputDir)), { recursive: true });
    await rename(temporaryOutput, resolve(outputDir));
  } catch (error) {
    await rm(temporaryOutput, { recursive: true, force: true });
    throw error;
  }

  return { generated: true, mapRanges };
}

async function main() {
  const sources = await resolveDefaultSources();
  const outputDir = join(repositoryRoot, "src/lib/server/data/generated");
  const result = await buildGeneratedData({ sources, outputDir });

  // Client-importable bounds live outside server/ so the browser bundle can
  // use them; rewritten on every run (idempotent) so they never drift.
  const bounds = deriveYearWindowBounds(result.mapRanges);
  const boundsPath = join(repositoryRoot, "src/lib/generated/year-window-bounds.json");
  await mkdir(dirname(boundsPath), { recursive: true });
  await writeFile(boundsPath, `${JSON.stringify(bounds)}\n`);

  const action = result.generated ? "generated" : "current";
  console.log(`[prebuild-data] ${action}: ${result.mapRanges.length} map ranges`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
