import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { buildGeneratedData, deriveYearWindowBounds } from "../../scripts/prebuild-data.mjs";

const temporaryDirectories: string[] = [];

async function readCompressedText(path: string) {
  return gunzipSync(await readFile(path)).toString("utf8");
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "app-map-data-test-"));
  temporaryDirectories.push(root);

  const sourcePaths = {
    map: join(root, "map.csv"),
    line: join(root, "line.csv"),
    stacked: join(root, "stacked.csv"),
    sideMetric: join(root, "side-metric.csv"),
  };

  await Promise.all([
    writeFile(
      sourcePaths.map,
      [
        "geoid,name,closure_count_2001-2006,closure_rate_per_10000_2001-2006,persistence_2001-2006,reopening_count_2001-2006",
        '01001,"Autauga County, AL",3,0,4,0',
        '00000,"US, United States",0.4,0.2,0.5,0.6',
      ].join("\n")
    ),
    writeFile(
      sourcePaths.line,
      ["geoid,year,close", "01001,2002,4", "01001,2001,3", "01003,2001,5", "01003,2002,6"].join(
        "\n"
      )
    ),
    writeFile(
      sourcePaths.stacked,
      ["geoid,year,negative,neutral,positive", "01001,2001,-2,3,4", "01003,2001,-5,6,7"].join("\n")
    ),
    writeFile(
      sourcePaths.sideMetric,
      ["geoid,n_med_rent,p_renter", "01001,0769,25.4", "00000,1200,36"].join("\n")
    ),
  ]);

  return {
    root,
    sourcePaths,
    outputDir: join(root, "generated"),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("dashboard data prebuild", () => {
  it("generates exact map artifacts, sorted series, national aggregates, and string metrics", async () => {
    const fixture = await createFixture();

    const result = await buildGeneratedData({
      sources: fixture.sourcePaths,
      outputDir: fixture.outputDir,
      force: true,
    });

    expect(result).toEqual({ generated: true, mapRanges: ["2001-2006"] });
    expect(await readdir(join(fixture.outputDir, "map"))).toEqual(["2001-2006.json.gz"]);
    expect(await readCompressedText(join(fixture.outputDir, "map/2001-2006.json.gz"))).toBe(
      JSON.stringify([
        {
          geoid: "01001",
          name: "Autauga County, AL",
          closure: 3,
          closure_rate_per_10000: 0,
          persistence: 4,
          reopening: 0,
        },
        {
          geoid: "00000",
          name: "US, United States",
          closure: 0.4,
          closure_rate_per_10000: 0.2,
          persistence: 0.5,
          reopening: 0.6,
        },
      ])
    );
    expect(
      JSON.parse(await readCompressedText(join(fixture.outputDir, "line_by_geoid.json.gz")))
    ).toEqual({
      "01001": [
        { year: 2001, close: 3 },
        { year: 2002, close: 4 },
      ],
      "01003": [
        { year: 2001, close: 5 },
        { year: 2002, close: 6 },
      ],
      "00000": [
        { year: 2001, close: 8 },
        { year: 2002, close: 10 },
      ],
    });
    expect(
      JSON.parse(await readCompressedText(join(fixture.outputDir, "stacked_by_geoid.json.gz")))
    ).toEqual({
      "01001": [{ year: 2001, negative: -2, neutral: 3, positive: 4 }],
      "01003": [{ year: 2001, negative: -5, neutral: 6, positive: 7 }],
      "00000": [{ year: 2001, negative: -7, neutral: 9, positive: 11 }],
    });
    expect(
      JSON.parse(await readCompressedText(join(fixture.outputDir, "side_metric_by_geoid.json.gz")))
    ).toEqual({
      "01001": { geoid: "01001", n_med_rent: "0769", p_renter: "25.4" },
      "00000": { geoid: "00000", n_med_rent: "1200", p_renter: "36" },
    });
  });

  it("skips complete current output and regenerates if an artifact is missing", async () => {
    const fixture = await createFixture();

    await buildGeneratedData({
      sources: fixture.sourcePaths,
      outputDir: fixture.outputDir,
      force: true,
    });

    await expect(
      buildGeneratedData({ sources: fixture.sourcePaths, outputDir: fixture.outputDir })
    ).resolves.toEqual({ generated: false, mapRanges: ["2001-2006"] });

    await rm(join(fixture.outputDir, "map/2001-2006.json.gz"));

    await expect(
      buildGeneratedData({ sources: fixture.sourcePaths, outputDir: fixture.outputDir })
    ).resolves.toEqual({ generated: true, mapRanges: ["2001-2006"] });
  });
});

describe("deriveYearWindowBounds", () => {
  it("derives bounds from a complete range set", () => {
    expect(deriveYearWindowBounds(["2001-2006"])).toEqual({
      minYear: 2001,
      maxYear: 2006,
      minGap: 5,
    });
    expect(deriveYearWindowBounds(["2001-2006", "2001-2007", "2002-2007"])).toEqual({
      minYear: 2001,
      maxYear: 2007,
      minGap: 5,
    });
  });

  it("rejects a range set the bounds algebra cannot fully describe", () => {
    expect(() => deriveYearWindowBounds(["2001-2006", "2001-2008"])).toThrow(
      /missing: 2001-2007, 2002-2007, 2002-2008, 2003-2008/
    );
  });
});
