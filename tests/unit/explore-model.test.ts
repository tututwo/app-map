import { expect, test } from "vitest";
import {
  DEFAULT_QUERY,
  FIXED_BREAKS,
  WINDOWS,
  breaksFor,
  colorIndexOf,
  legendFor,
  formatAt,
  parentOf,
  parseExploreQuery,
  selectionFor,
  unitFor,
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
  expect(selection.stat).toEqual({ closed: 0, per10k: null });
  // Types with a count, largest first; Types with No observation are named apart, never as zero.
  expect(selection.types).toEqual([
    { key: "christian_church", label: "Christian congregations", closed: 5 },
  ]);
  expect(selection.inactive).toContain("Mosques");
  expect(selection.inactive).not.toContain("All places of worship");
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
});

test("the panel tells a missing Unit, a failed load and a Focus outside every Unit apart", () => {
  const query = parseExploreQuery(new URLSearchParams("where=CT"));
  expect(selectionFor(query, { all_religions: 3 }).status).toBe("ok");
  expect(selectionFor(query, null).status).toBe("uncovered");
  expect(selectionFor(query, "failed").status).toBe("failed");
  expect(selectionFor(query, { all_religions: 3 }, null, true).status).toBe("locating");
  expect(selectionFor(query, { all_religions: 3 }, null, "failed").status).toBe("failed");
  expect(selectionFor({ ...query, where: "" }, null).status).toBe("none");
  expect(selectionFor({ ...query, where: "", at: [-70, 30] }, null).status).toBe("outside");
  // A searched Location explains a Unit it does not name; the address itself never reaches the URL.
  const tract = { ...query, level: "tract" as const, where: "48201100000" };
  expect(selectionFor({ ...tract, near: "Houston, TX" }, null).because).toBe(
    "The tract that contains the focus point for Houston, TX."
  );
  expect(selectionFor({ ...tract, near: "address" }, null).because).toContain("address you looked");
  expect(selectionFor({ ...query, near: "Connecticut" }, null).because).toBe("");
});

test("a GEOID is read at the Query's Level and never guessed from its shape", () => {
  expect(unitFor("090010101011", "blockgroup")).toEqual({
    level: "blockgroup",
    id: "090010101011",
    name: "Block group 1, Tract 101.01, Fairfield County, CT",
  });
  // Counties are the 2010 ones: Connecticut keeps its eight counties, and renamed ones keep their old GEOID.
  expect(unitFor("09001", "county")?.name).toBe("Fairfield County, CT");
  expect(unitFor("46113", "county")?.name).toBe("Shannon County, SD");
  // 06037 is Los Angeles County and also a ZIP in Connecticut: the Level decides, the digits never do.
  expect(unitFor("06037", "county")?.name).toBe("Los Angeles County, CA");
  expect(unitFor("06037", "zcta")).toEqual({ level: "zcta", id: "06037", name: "ZIP 06037" });
  expect(unitFor("06037", "tract")).toBeUndefined();
  expect(unitFor("06510", "county")).toBeUndefined();
  expect(unitFor("09009", "state")).toBeUndefined();
  expect(unitFor("09009361402", "tract")?.name).toBe("Tract 3614.02, New Haven County, CT");
  // Home's form and links from before the Focus name a state in words.
  expect(unitFor("connecticut", "state")?.id).toBe("09");
});

test("the Focus travels in the URL, and a coarser Level is a GEOID prefix away", () => {
  const query = parseExploreQuery(new URLSearchParams("at=-72.92790,41.30830&near=New+Haven,+CT"));
  expect(query.at).toEqual([-72.9279, 41.3083]);
  expect(query.near).toBe("New Haven, CT");
  expect(formatAt([-72.927912345, 41.3083])).toBe("-72.92791,41.30830");
  for (const bad of ["", "abc", "1,2,3", "-200,10", "10,90", "10"])
    expect(parseExploreQuery(new URLSearchParams({ at: bad })).at).toBeNull();
  const blockGroup = unitFor("090093614021", "blockgroup")!;
  expect(parentOf(blockGroup, "tract")).toBe("09009361402");
  expect(parentOf(blockGroup, "county")).toBe("09009");
  expect(parentOf(blockGroup, "state")).toBe("09");
  // A ZIP nests in nothing, and nothing is finer than a block group.
  expect(parentOf(blockGroup, "zcta")).toBeUndefined();
  expect(parentOf(unitFor("06511", "zcta")!, "county")).toBeUndefined();
  expect(parentOf(unitFor("09009", "county")!, "tract")).toBeUndefined();
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
