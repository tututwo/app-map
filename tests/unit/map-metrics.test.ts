import { describe, expect, test } from "vitest";
import { scaleQuantize } from "d3-scale";

import {
  createMapMetricPresentations,
  getMapMetricValue,
  mapMetricDefinitions,
} from "$lib/config/mapMetrics";

const mapData = [
  {
    geoid: "01001",
    name: "Low county",
    closure: 0,
    closure_rate_per_10000: 0,
    persistence: 0,
    reopening: 0,
  },
  {
    geoid: "01003",
    name: "High county",
    closure: 10,
    closure_rate_per_10000: 2.6,
    persistence: 5,
    reopening: 0,
  },
];

const defaultLikeMapData = [
  [0, 0, 0],
  [1, 0.2, 1],
  [3, 0.8, 2],
  [5, 1.4, 4],
  [7, 2.2, 7],
  [10, 3.69, 10],
].map(([closure, closureRate, persistence], index) => ({
  geoid: String(index).padStart(5, "0"),
  name: `County ${index}`,
  closure,
  closure_rate_per_10000: closureRate,
  persistence,
  reopening: 0,
}));

describe("map metric presentations", () => {
  test("calibrates every metric to the supplied data and labels exact quantize intervals", () => {
    const presentations = createMapMetricPresentations(mapData);

    expect(presentations.map(({ colorDomain }) => colorDomain)).toEqual([
      [0, 10],
      [0, 3],
      [0, 5],
    ]);
    expect(presentations[0].legendText).toEqual([
      "[0, 2)",
      "[2, 4)",
      "[4, 6)",
      "[6, 8)",
      "[8, 10]",
    ]);
    expect(presentations[1].legendText).toEqual([
      "[0, 0.6)",
      "[0.6, 1.2)",
      "[1.2, 1.8)",
      "[1.8, 2.4)",
      "[2.4, 3]",
    ]);
    expect(presentations[2].legendText).toEqual(["[0, 1)", "[1, 2)", "[2, 3)", "[3, 4)", "[4, 5]"]);
  });

  test("preserves a missing metric value as unavailable rather than fabricating zero", () => {
    expect(getMapMetricValue(undefined, mapMetricDefinitions[0])).toBeUndefined();
    expect(getMapMetricValue(mapData[0], mapMetricDefinitions[0])).toBe(0);
    expect(createMapMetricPresentations([])).toEqual([]);
  });

  test("keeps default-like nonzero values distributed across the quantize colors", () => {
    const occupiedBucketCounts = createMapMetricPresentations(defaultLikeMapData).map((metric) => {
      const bucketFor = scaleQuantize<number>()
        .domain(metric.colorDomain)
        .range(metric.colorRange.map((_, index) => index));
      const occupiedBuckets = new Set(
        defaultLikeMapData
          .map((datum) => getMapMetricValue(datum, metric))
          .filter((value): value is number => value !== undefined && value > 0)
          .map(bucketFor)
      );

      return occupiedBuckets.size;
    });

    expect(occupiedBucketCounts).toEqual([5, 4, 5]);
  });

  test("defines the three dashboard map metrics as immutable shared configuration", () => {
    expect(
      mapMetricDefinitions.map(({ value, colorKey, colorRange }) => ({
        value,
        colorKey,
        colorRange,
      }))
    ).toEqual([
      {
        value: 0,
        colorKey: "closure",
        colorRange: ["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"],
      },
      {
        value: 1,
        colorKey: "closure_rate_per_10000",
        colorRange: ["#FAE2C9", "#E9C39B", "#D9A671", "#CB8944", "#B96308"],
      },
      {
        value: 2,
        colorKey: "persistence",
        colorRange: ["#F1E0FD", "#CCADE3", "#A272C5", "#7836A7", "#5C168E"],
      },
    ]);
    expect(Object.isFrozen(mapMetricDefinitions)).toBe(true);
    expect(mapMetricDefinitions.every(Object.isFrozen)).toBe(true);
    expect(mapMetricDefinitions.every(({ colorRange }) => Object.isFrozen(colorRange))).toBe(true);

    const presentations = createMapMetricPresentations(mapData);
    expect(Object.isFrozen(presentations)).toBe(true);
    expect(presentations.every(Object.isFrozen)).toBe(true);
    expect(presentations.every(({ colorDomain }) => Object.isFrozen(colorDomain))).toBe(true);
    expect(presentations.every(({ legendText }) => Object.isFrozen(legendText))).toBe(true);
  });
});
