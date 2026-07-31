import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const clientOutput = fileURLToPath(new URL("../.svelte-kit/output/client", import.meta.url));
const protectedDatasets = [
  {
    name: "community metrics",
    source: new URL("../src/data/sideMetricData.csv", import.meta.url),
    fields: ["geoid", "tarea", "n_medincome"],
  },
  {
    name: "line-chart metrics",
    source: new URL("../src/data/line/brushableLineChartData.csv", import.meta.url),
    fields: ["name", "geoid", "year", "close"],
  },
  {
    name: "stacked-bar metrics",
    source: new URL("../src/data/stackedBar/stackedBarChart.csv", import.meta.url),
    fields: ["name", "geoid", "year", "negative", "neutral", "positive"],
  },
  {
    name: "map metrics",
    source: new URL("../src/data/countyID/counties_all.csv", import.meta.url),
    fields: ["name", "geoid", "closure_rate_per_10000_2006-2011"],
  },
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    })
  );
  return files.flat();
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recordPattern(record, fields) {
  const pairs = fields.map((field) => {
    const key = escapeRegularExpression(field);
    const value = escapeRegularExpression(record[field]);
    return `["']?${key}["']?\\s*:\\s*["']${value}["']`;
  });
  return new RegExp(pairs.join("[\\s\\S]{0,256}"));
}

async function leakagePatterns(dataset) {
  const contents = await readFile(dataset.source, "utf8");
  const [headerLine, ...dataLines] = contents.split(/\r?\n/, 4);
  const headers = parseCsvLine(headerLine);

  return dataLines.slice(0, 2).map((line) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    if (dataset.fields.some((field) => !record[field])) {
      throw new Error(`Could not derive a leakage check for ${dataset.name}.`);
    }
    return recordPattern(record, dataset.fields);
  });
}

const clientFiles = await filesUnder(clientOutput);
const clientContents = await Promise.all(clientFiles.map((file) => readFile(file, "utf8")));

for (const dataset of protectedDatasets) {
  const patterns = await leakagePatterns(dataset);
  if (patterns.some((pattern) => clientContents.some((contents) => pattern.test(contents)))) {
    throw new Error(`Protected ${dataset.name} were found in the public client bundle.`);
  }
}

console.log("Verified: protected research datasets are absent from the client bundle.");
