import { expect, it } from "vitest";
import { parseBlockGroupMetrics } from "../../scripts/prebuild-blockgroup.mjs";
import release from "../../data-raw/blockgroup-release.json";
import { LEGENDS, blockGroupLabel, parseExploreQuery } from "$lib/explore/model";

it("shards block-group counts by state, keeps zero, drops missing, and rejects bad releases", () => {
  const header = "geoid,2007_2024,2010_2015\n";
  const valid = "090010101011,2,0\n090010101013,,1\n";
  const parse = (body: string) => parseBlockGroupMetrics(header + body, { states: ["09"] });
  expect(parse(valid)).toEqual({
    windows: ["2007_2024", "2010_2015"],
    geoidCount: 2,
    shards: {
      "2007_2024": { "09": { "090010101011": 2 } },
      "2010_2015": { "09": { "090010101011": 0, "090010101013": 1 } },
    },
  });
  expect(() => parse(valid + valid)).toThrow(/Duplicate/);
  expect(() => parse(valid.replace("0900", "3600"))).toThrow(/GEOID/);
  expect(() => parse(valid.replace("090010101011", "90010101011"))).toThrow(/GEOID/);
  expect(() => parse(valid.replace(",2,0", ",1.5,0"))).toThrow(/Invalid/);
  expect(() => parseBlockGroupMetrics("geoid,closed\n", { states: ["09"] })).toThrow(/columns/);
  // Counts stay preliminary until distinct-business counting is verified against ABI records.
  expect(release.validation.status).toBe("preliminary");
});

it("reads the level from the URL and labels whole-count classes and block groups", () => {
  expect(parseExploreQuery(new URLSearchParams("level=blockgroup")).level).toBe("blockgroup");
  expect(parseExploreQuery(new URLSearchParams("level=tract")).level).toBe("state");
  expect(LEGENDS.blockgroup.classes.map((cls) => cls.label)).toEqual([
    "0",
    "1",
    "2–3",
    "4–7",
    "8+",
  ]);
  expect(blockGroupLabel("090010101011")).toBe("Tract 101.01 · Block group 1");
  expect(blockGroupLabel("090093614002")).toBe("Tract 3614 · Block group 2");
});
