import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, test } from "vitest";
import countyBreaks from "$lib/generated/county-breaks.json";
import manifest from "$lib/generated/metrics-manifest.json";
import { breaksFor } from "$lib/explore/model";

const county = manifest.levels.county;
const folder = `static/tiles/metrics/county/${county.release}/us`;
const missing = county.dtype === "u8" ? 255 : 65535;

test("saved county classes match the original counts in a clean checkout", () => {
  // Raw county counts from this release: 2000–2004, 2000–2025, and 2021–2025 for every Type.
  const fixture: {
    release: string;
    windows: number[];
    counts: Record<string, number[][]>;
  } = JSON.parse(
    gunzipSync(readFileSync("tests/fixtures/county-window-counts.json.gz")).toString()
  );
  expect(fixture.release).toBe(county.release);
  expect(Object.keys(fixture.counts)).toEqual(manifest.religions);
  for (const [religion, windows] of Object.entries(fixture.counts)) {
    const built = countyBreaks.breaks[religion as keyof typeof countyBreaks.breaks];
    expect(windows).toHaveLength(fixture.windows.length);
    for (const [index, counts] of windows.entries()) {
      expect(counts).toHaveLength(county.places);
      expect(built[fixture.windows[index]], `${religion} window ${fixture.windows[index]}`).toEqual(
        breaksFor(counts.map((value) => (value === missing ? null : value)))
      );
    }
  }
});

test("the county legend's classes were built for the release the manifest names", () => {
  expect(countyBreaks.release).toBe(county.release);
  for (const religion of manifest.religions)
    expect(countyBreaks.breaks[religion as keyof typeof countyBreaks.breaks]).toHaveLength(
      manifest.windows.length
    );
});

// scripts/build-county-breaks.py is a port of breaksFor; where the release's files are on disk, they must agree.
test.skipIf(!existsSync(`${folder}/geoids.json.gz`))(
  "the built classes are breaksFor over the counties' counts, in every Type and Year Window",
  () => {
    const windows = manifest.windows.length;
    const places = JSON.parse(
      gunzipSync(readFileSync(`${folder}/geoids.json.gz`)).toString()
    ).length;
    for (const religion of manifest.religions) {
      const bytes = Uint8Array.from(gunzipSync(readFileSync(`${folder}/${religion}.bin.gz`)));
      const counts = county.dtype === "u8" ? bytes : new Uint16Array(bytes.buffer);
      expect(counts).toHaveLength(places * windows);
      const built = countyBreaks.breaks[religion as keyof typeof countyBreaks.breaks];
      for (let window = 0; window < windows; window++) {
        const values = Array.from({ length: places }, (_, row) => {
          const value = counts[row * windows + window];
          return value === missing ? null : value;
        });
        expect(built[window], `${religion} window ${window}`).toEqual(breaksFor(values));
      }
    }
  }
);
