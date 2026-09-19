import { expect, test } from "vitest";
import {
  DEFAULT_QUERY,
  FIXED_BREAKS,
  WINDOWS,
  breaksFor,
  colorIndexOf,
  legendFor,
  parseExploreQuery,
  placeFor,
  selectionFor,
} from "$lib/explore/model";

test("queries use published windows only", () => {
  expect(parseExploreQuery(new URLSearchParams())).toEqual(DEFAULT_QUERY);
  // The lab publishes every window of at least five inclusive years between 2000 and 2025.
  expect(WINDOWS).toHaveLength(253);
  expect(parseExploreQuery(new URLSearchParams("from=2010&to=2014"))).toMatchObject({
    from: 2010,
    to: 2014,
  });
  const snapped = parseExploreQuery(new URLSearchParams("where=CT&from=2011&to=2013&type=all"));
  expect(snapped.type).toBe("all_religions");
  expect(WINDOWS).toContainEqual(expect.objectContaining({ from: snapped.from, to: snapped.to }));
  for (const window of WINDOWS) {
    const parsed = parseExploreQuery(new URLSearchParams(`from=${window.from}&to=${window.to}`));
    expect([parsed.from, parsed.to]).toEqual([window.from, window.to]);
  }
});

test("a selection keeps zero, missing and per-type counts apart", () => {
  const query = parseExploreQuery(new URLSearchParams("where=CT"));
  const selection = selectionFor(query, {
    all_religions: 0,
    christian_church: 5,
    muslim_mosque: null,
  });
  expect(selection.selected).toEqual({ level: "state", id: "09", name: "Connecticut" });
  expect(selection.stat).toEqual({ closed: 0, per10k: null, nOpen: null });
  expect(selection.types[0]).toMatchObject({ key: "christian_church", closed: 5 });
  expect(selection.types.at(-1)?.closed).toBeNull();
  expect(selection.types.map((type) => type.key)).not.toContain("all_religions");
  expect(selectionFor(query, null).stat.closed).toBeNull();
  expect(selectionFor({ ...query, where: "" }, null).selected).toBeUndefined();
  expect(placeFor("090010101011")).toMatchObject({ level: "blockgroup", id: "090010101011" });
  // Counties are the 2010 ones: Connecticut keeps its eight counties, and renamed ones keep their old GEOID.
  expect(placeFor("09001")).toEqual({ level: "county", id: "09001", name: "Fairfield County, CT" });
  expect(placeFor("46113")?.name).toBe("Shannon County, SD");
  // Five digits are a county unless the ZIP view is on or no county has that GEOID (06037 is both).
  expect(placeFor("06037")?.name).toBe("Los Angeles County, CA");
  expect(placeFor("06037", "zcta")).toEqual({ level: "zcta", id: "06037", name: "ZIP 06037" });
  expect(placeFor("06510")?.level).toBe("zcta");
  expect(placeFor("09009361402")).toEqual({
    level: "tract",
    id: "09009361402",
    name: "Tract 3614.02, New Haven County, CT",
  });
});

test("breaks follow the data and classes always span the colour ramp", () => {
  expect(breaksFor([])).toEqual([]);
  expect(breaksFor([0, null, 3, 3, 3])).toEqual([3]);
  const breaks = breaksFor(Array.from({ length: 51 }, (_, index) => (index + 1) * 111));
  expect(breaks).toHaveLength(4);
  expect(breaks).toEqual([...breaks].sort((a, b) => a - b));
  expect(colorIndexOf(null, breaks)).toBe(-1);
  expect(colorIndexOf(0, breaks)).toBe(0);
  expect(colorIndexOf(breaks[0] - 1, breaks)).toBe(0);
  expect(colorIndexOf(breaks[0], breaks)).toBe(1);
  expect(colorIndexOf(1e9, breaks)).toBe(4);
  expect(colorIndexOf(5, [3])).toBe(4);
  expect(colorIndexOf(5, [])).toBe(0);
  expect(legendFor(FIXED_BREAKS.blockgroup).classes.map((cls) => cls.label)).toEqual([
    "0",
    "1",
    "2–3",
    "4–7",
    "8+",
  ]);
});
