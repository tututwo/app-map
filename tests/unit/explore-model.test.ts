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
  // Context rows keep the lab's order and skip what is not published for the place (ZIPs, block groups).
  expect(selectionFor(query, null).context).toEqual([]);
  const context = { pop2010: 35680, n_medincome: null, p_renter: 38, i_gini: 0.4 };
  // The rate is closures per 10,000 of the place's 2010 residents; without residents there is none.
  expect(selectionFor(query, { all_religions: 19 }, context as never).stat.per10k).toBeCloseTo(
    5.325,
    3
  );
  expect(selectionFor(query, { all_religions: 19 }, null).stat.per10k).toBeNull();
  expect(
    selectionFor(query, { all_religions: 19 }, { pop2010: 0 } as never).stat.per10k
  ).toBeNull();
  expect(selectionFor(query, null, context as never).context).toEqual([
    { key: "pop2010", label: "Residents, 2010 census", value: "35,680" },
    { key: "p_renter", label: "Rented housing", value: "38.0%" },
    { key: "i_gini", label: "Gini index of income inequality", value: "0.400" },
  ]);
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
