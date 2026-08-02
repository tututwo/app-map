import { describe, expect, test } from "vitest";

import { parseDashboardParams } from "$lib/dashboard/params";

describe("parseDashboardParams", () => {
  test("uses the dashboard defaults when parameters are absent", () => {
    expect(parseDashboardParams(new URL("https://example.test/"))).toEqual({
      from: 2003,
      to: 2011,
      geoid: "00000",
    });
  });

  test("accepts a valid year range and five-digit GEOID", () => {
    const url = new URL("https://example.test/?from=2001&to=2006&geoid=01001");

    expect(parseDashboardParams(url)).toEqual({
      from: 2001,
      to: 2006,
      geoid: "01001",
    });
  });

  test("normalizes the proven Connecticut planning-region alias before any data loads", () => {
    const url = new URL("https://example.test/?from=2003&to=2011&geoid=09170");

    expect(parseDashboardParams(url).geoid).toBe("09009");
  });

  test("uses the default for a year that is not a strict integer", () => {
    const url = new URL("https://example.test/?from=2003x&to=2012");

    expect(parseDashboardParams(url)).toEqual({
      from: 2003,
      to: 2012,
      geoid: "00000",
    });
  });

  test("uses per-parameter defaults for years outside 2001 through 2021", () => {
    expect(parseDashboardParams(new URL("https://example.test/?from=2000&to=2012"))).toEqual({
      from: 2003,
      to: 2012,
      geoid: "00000",
    });
    expect(parseDashboardParams(new URL("https://example.test/?from=2004&to=2022"))).toEqual({
      from: 2004,
      to: 2011,
      geoid: "00000",
    });
  });

  test("accepts a five-calendar-year inclusive range", () => {
    expect(parseDashboardParams(new URL("https://example.test/?from=2001&to=2005"))).toEqual({
      from: 2001,
      to: 2005,
      geoid: "00000",
    });
  });

  test("uses the default range for fewer than five calendar years", () => {
    expect(parseDashboardParams(new URL("https://example.test/?from=2001&to=2004"))).toEqual({
      from: 2003,
      to: 2011,
      geoid: "00000",
    });
  });

  test("uses per-parameter defaults when a parameter is repeated", () => {
    expect(
      parseDashboardParams(new URL("https://example.test/?from=2001&from=2002&to=2012&geoid=01001"))
    ).toEqual({ from: 2003, to: 2012, geoid: "01001" });

    expect(
      parseDashboardParams(new URL("https://example.test/?from=2001&to=2010&to=2011"))
    ).toEqual({ from: 2001, to: 2011, geoid: "00000" });

    expect(
      parseDashboardParams(
        new URL("https://example.test/?from=2001&to=2010&geoid=01001&geoid=01003")
      )
    ).toEqual({ from: 2001, to: 2010, geoid: "00000" });
  });

  test.each(["1001", "010010", "abcde", " 01001"])(
    "uses the default for invalid GEOID %j",
    (geoid) => {
      const url = new URL("https://example.test/?from=2001&to=2010");
      url.searchParams.set("geoid", geoid);

      expect(parseDashboardParams(url).geoid).toBe("00000");
    }
  );
});
