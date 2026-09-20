import { expect, test } from "vitest";
import { parseExploreQuery, per10k, rated } from "$lib/explore/model";
import type { Context } from "$lib/explore/sdoh";
import { contextRows, nationalStat, reliableRate, shareSearch } from "$lib/explore/summary";

const context = (values: Partial<Context>) => values as Context;

test("a rate is printed from twenty closures on", () => {
  expect(reliableRate(rated(19, 10_000))).toBeNull();
  expect(reliableRate(rated(20, 10_000))).toBe(20);
  expect(reliableRate(rated(null, 10_000))).toBeNull();
  // Closures without residents have no rate at any count.
  expect(reliableRate(rated(500, null))).toBeNull();
  // A minor Type's rate keeps two significant digits instead of rounding to 0.01.
  expect([per10k(4.756), per10k(0.0059), per10k(0), per10k(null)]).toEqual([
    "4.76",
    "0.0059",
    "0.00",
    "—",
  ]);
});

test("the national rate divides summed closures by summed residents", () => {
  const stat = nationalStat(["01", "02", "72"], [30, null, 5], { "01": 1_000, "02": 3_000 });
  // Puerto Rico has no residents in the table, so neither its closures nor its people are counted.
  expect(stat).toEqual({ closed: 30, per10k: 75 });
  expect(nationalStat(["01"], [null], { "01": 1_000 }).closed).toBeNull();
});

test("the context table shows what the place has, beside its state", () => {
  const state = context({ pop2010: 3_574_097, n_medincome: 67_740, p_renter: 31.2 });
  const tract = contextRows(context({ pop2010: 4_000, n_medincome: 41_000 }), state);
  expect(tract.map((row) => [row.key, row.place, row.state])).toEqual([
    ["pop2010", "4,000", "3,574,097"],
    ["n_medincome", "$41,000", "$67,740"],
  ]);
  // A ZIP has no income: the next measure it does have takes the row.
  const zip = contextRows(context({ pop2010: 900, p_renter: 40, p_pct_65p: 12 }), state);
  expect(zip.map((row) => [row.key, row.state])).toEqual([
    ["pop2010", "3,574,097"],
    ["p_renter", "31.2%"],
    ["p_pct_65p", "—"],
  ]);
  expect(contextRows(null, state)).toEqual([]);
});

test("the printed link leaves out a Focus that marks an address", () => {
  const search = "where=09009361402&level=tract&from=2010&to=2019&at=-72.92000,41.31000";
  expect(shareSearch(parseExploreQuery(new URLSearchParams(search)))).toContain("at=");
  const looked = shareSearch(parseExploreQuery(new URLSearchParams(`${search}&near=address`)));
  expect(looked).not.toContain("at=");
  expect(looked).not.toContain("near=");
  expect(looked).toContain("where=09009361402");
});
