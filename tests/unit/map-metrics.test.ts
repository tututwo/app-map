import { describe, expect, test } from "vitest";

import { mapMetricConfigs } from "$lib/config/mapMetrics";

describe("mapMetricConfigs", () => {
  test("keeps the closure scale and its displayed ranges in the same units", () => {
    const closure = mapMetricConfigs[0];

    expect(closure.colorKey).toBe("closure");
    expect(closure.colorDomain).toEqual([0, 60]);
    expect(closure.legendText).toEqual(["1-12", "13-24", "25-36", "37-48", "49-60"]);
  });

  test("defines the three dashboard map metrics as immutable shared configuration", () => {
    expect(mapMetricConfigs.map(({ value, colorKey }) => ({ value, colorKey }))).toEqual([
      { value: 0, colorKey: "closure" },
      { value: 1, colorKey: "closure_rate_per_10000" },
      { value: 2, colorKey: "persistence" },
    ]);
    expect(Object.isFrozen(mapMetricConfigs)).toBe(true);
    expect(mapMetricConfigs.every(Object.isFrozen)).toBe(true);
  });
});
