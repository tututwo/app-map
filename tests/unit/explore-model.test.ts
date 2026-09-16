import { expect, test } from "vitest";
import {
  BREAKS,
  DEFAULT_QUERY,
  WINDOWS,
  classOf,
  parseExploreQuery,
  selectionFor,
} from "$lib/explore/model";

test("state queries use published windows, preserve missing data and classify count boundaries", () => {
  expect(parseExploreQuery(new URLSearchParams())).toEqual(DEFAULT_QUERY);
  const query = parseExploreQuery(new URLSearchParams("where=CT&from=2011&to=2014&type=all"));
  expect(query).toMatchObject({ from: 2010, to: 2015, type: "all_religions" });
  for (const window of WINDOWS) {
    const parsed = parseExploreQuery(new URLSearchParams(`from=${window.from}&to=${window.to}`));
    expect([parsed.from, parsed.to]).toEqual([window.from, window.to]);
  }
  const selection = selectionFor(query, [{ geoid: "09", closed: 0, per10k: null, nOpen: null }]);
  expect(selection.selected?.id).toBe("09");
  expect(selection.stat).toMatchObject({ closed: 0, per10k: null, nOpen: null });
  expect(selectionFor(query, []).stat.closed).toBeNull();
  expect(
    selectionFor({ ...query, where: "" }, [{ geoid: "09", closed: 10, per10k: null, nOpen: null }])
      .stat.closed
  ).toBeNull();
  expect(classOf(null)).toBe(-1);
  expect(classOf(0)).toBe(0);
  expect(classOf(BREAKS[0] - 1)).toBe(0);
  expect(classOf(BREAKS[0])).toBe(1);
});
