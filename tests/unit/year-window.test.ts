import { describe, expect, test } from "vitest";

import {
  YEAR_WINDOW_BOUNDS,
  clampYearWindow,
  inferAdjustedEdge,
  legalYearWindows,
  yearWindowViolation,
} from "$lib/domain/yearWindow";

describe("inferAdjustedEdge", () => {
  test("names the edge that moved more, defaulting to 'to' on ties", () => {
    expect(inferAdjustedEdge([100, 200], [80, 200])).toBe("from");
    expect(inferAdjustedEdge([100, 200], [100, 230])).toBe("to");
    expect(inferAdjustedEdge([100, 200], [110, 210])).toBe("to");
  });
});

describe("YEAR_WINDOW_BOUNDS", () => {
  test("matches the generated data", () => {
    expect(YEAR_WINDOW_BOUNDS).toEqual({ minYear: 2001, maxYear: 2021, minGap: 5 });
  });
});

describe("legalYearWindows", () => {
  test("enumerates exactly the windows the validator accepts", () => {
    const windows = legalYearWindows();
    const { minYear, maxYear, minGap } = YEAR_WINDOW_BOUNDS;
    const span = maxYear - minYear - minGap + 1;

    expect(windows).toHaveLength((span * (span + 1)) / 2);
    expect(windows.every(({ from, to }) => yearWindowViolation(from, to) === null)).toBe(true);
    expect(new Set(windows.map(({ from, to }) => `${from}-${to}`)).size).toBe(windows.length);
  });
});

describe("clampYearWindow", () => {
  test("returns a legal window unchanged", () => {
    expect(clampYearWindow(2003, 2011)).toEqual({ from: 2003, to: 2011 });
    expect(clampYearWindow(2001, 2006)).toEqual({ from: 2001, to: 2006 });
    expect(clampYearWindow(2016, 2021)).toEqual({ from: 2016, to: 2021 });
  });

  test("clamps out-of-bounds years", () => {
    expect(clampYearWindow(1990, 2012)).toEqual({ from: 2001, to: 2012 });
    expect(clampYearWindow(2004, 2030)).toEqual({ from: 2004, to: 2021 });
    expect(clampYearWindow(1990, 2030)).toEqual({ from: 2001, to: 2021 });
  });

  test("widens an under-sized window from its center", () => {
    expect(clampYearWindow(2010, 2012)).toEqual({ from: 2008, to: 2013 });
    expect(clampYearWindow(2001, 2004)).toEqual({ from: 2001, to: 2006 });
    expect(clampYearWindow(2019, 2021)).toEqual({ from: 2016, to: 2021 });
  });

  test("yields the adjusted edge first when the caller was dragging one", () => {
    expect(clampYearWindow(2010, 2012, "to")).toEqual({ from: 2010, to: 2015 });
    expect(clampYearWindow(2010, 2012, "from")).toEqual({ from: 2007, to: 2012 });
    expect(clampYearWindow(2019, 2021, "to")).toEqual({ from: 2016, to: 2021 });
    expect(clampYearWindow(2001, 2003, "from")).toEqual({ from: 2001, to: 2006 });
  });

  test("is total: any integer pair lands on a legal window", () => {
    const inputs: Array<[number, number]> = [
      [2015, 2003],
      [99999, 2010],
      [-5, 3],
      [2021, 2021],
      [2001, 2001],
    ];
    for (const [from, to] of inputs) {
      const window = clampYearWindow(from, to);
      expect(yearWindowViolation(window.from, window.to)).toBeNull();
    }
  });
});

describe("yearWindowViolation", () => {
  test("accepts every legal window shape", () => {
    expect(yearWindowViolation(2001, 2006)).toBeNull();
    expect(yearWindowViolation(2003, 2011)).toBeNull();
    expect(yearWindowViolation(2001, 2021)).toBeNull();
  });

  test("names the violation", () => {
    expect(yearWindowViolation(NaN, 2011)).toBe("from and to must be valid integers");
    expect(yearWindowViolation(2000, 2012)).toBe("Year range must be within 2001-2021");
    expect(yearWindowViolation(2011, 2003)).toBe("Start year must be before or equal to end year");
    expect(yearWindowViolation(2001, 2005)).toBe("Year range must span at least 6 calendar years");
  });
});
