import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { csvParse } from "d3";
import { describe, expect, it } from "vitest";

import { demographicMetricConfigs, socialDeterminantMetricConfigs } from "$lib/config/sideMetrics";
import { createSideMetricData } from "$lib/utils/sideMetricTransformation";

describe("side-metric domain contract", () => {
  it("defines social determinants with reproducible county-average benchmarks", () => {
    expect(socialDeterminantMetricConfigs).toEqual([
      {
        id: "median-rent",
        field: "n_med_rent",
        title: "Median gross rent (USD)",
        type: "currency",
        range: [200, 10_000],
        labels: ["$200", "$10k"],
        average: 621,
        averageLabel: "County average",
      },
      {
        id: "renters-percent",
        field: "p_renter",
        title: "Percentage of occupied housing units that are renter-occupied",
        type: "percent",
        range: [0, 100],
        labels: ["0%", "100%"],
        average: 28,
        averageLabel: "County average",
      },
      {
        id: "poverty-level",
        field: "p_poverty",
        title: "Percentage of population below the poverty level",
        type: "percent",
        range: [0, 100],
        labels: ["0%", "100%"],
        average: 16,
        averageLabel: "County average",
      },
      {
        id: "mobility-level",
        field: "p_mobility",
        title: "Percentage of residents living in the same house as one year ago",
        type: "percent",
        range: [0, 100],
        labels: ["0%", "100%"],
        average: 86,
        averageLabel: "County average",
      },
      {
        id: "community-health-centers",
        field: "n_commhlthcntr",
        title: "Number of community health centers",
        type: "number",
        range: [0, 100],
        labels: ["0", "100"],
        average: 5,
        averageLabel: "County average",
      },
    ]);
  });

  it("defines count-appropriate demographic metrics and ranges", () => {
    expect(demographicMetricConfigs).toEqual([
      {
        id: "black-population",
        field: "n_pop_black",
        title: "Black population (count)",
        type: "number",
        range: [0, 60_000],
        labels: ["0", "60k"],
        average: 11_680,
        averageLabel: "County average",
      },
      {
        id: "hispanic-population",
        field: "n_pop_hisp",
        title: "Hispanic or Latino population (count)",
        type: "number",
        range: [0, 60_000],
        labels: ["0", "60k"],
        average: 15_851,
        averageLabel: "County average",
      },
    ]);
  });

  it("keeps every county-average benchmark synchronized with the source data", () => {
    const rows = csvParse(
      readFileSync(resolve(process.cwd(), "data-raw/sideMetricData.csv"), "utf8")
    ).filter((row) => row.spatial_level === "county2010" && row.geoid !== "00000");

    expect(rows).toHaveLength(3_221);
    for (const config of [...socialDeterminantMetricConfigs, ...demographicMetricConfigs]) {
      const values = rows
        .map((row) => row[config.field])
        .filter((value): value is string => value !== undefined && value.trim() !== "")
        .map(Number)
        .filter((value) => Number.isFinite(value));
      const roundedMean = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

      expect(config.average).toBe(roundedMean);
      expect(config.averageLabel).toBe("County average");
    }
  });
});

describe("createSideMetricData", () => {
  it("formats finite source values and carries the shared presentation contract", () => {
    const metrics = createSideMetricData(
      {
        n_med_rent: "769",
        p_renter: "24.5932446466545",
        n_commhlthcntr: "1",
      },
      [
        socialDeterminantMetricConfigs[0],
        socialDeterminantMetricConfigs[1],
        socialDeterminantMetricConfigs[4],
      ]
    );

    expect(metrics).toEqual([
      {
        id: "median-rent",
        title: "Median gross rent (USD)",
        currentValueDisplay: "$769",
        currentValue: 769,
        minValue: 200,
        maxValue: 10_000,
        minLabel: "$200",
        maxLabel: "$10k",
        averageValue: 621,
        averageLabel: "County average",
      },
      {
        id: "renters-percent",
        title: "Percentage of occupied housing units that are renter-occupied",
        currentValueDisplay: "25%",
        currentValue: 25,
        minValue: 0,
        maxValue: 100,
        minLabel: "0%",
        maxLabel: "100%",
        averageValue: 28,
        averageLabel: "County average",
      },
      {
        id: "community-health-centers",
        title: "Number of community health centers",
        currentValueDisplay: "1",
        currentValue: 1,
        minValue: 0,
        maxValue: 100,
        minLabel: "0",
        maxLabel: "100",
        averageValue: 5,
        averageLabel: "County average",
      },
    ]);
  });

  it.each([undefined, null])("returns no metrics when the source row is %s", (rawData) => {
    expect(createSideMetricData(rawData, socialDeterminantMetricConfigs)).toEqual([]);
  });

  it("omits only metrics whose source field is absent or non-finite", () => {
    expect(
      createSideMetricData(
        {
          n_med_rent: "NaN",
          p_renter: "36.4",
        },
        socialDeterminantMetricConfigs.slice(0, 3)
      )
    ).toEqual([
      {
        id: "renters-percent",
        title: "Percentage of occupied housing units that are renter-occupied",
        currentValueDisplay: "36%",
        currentValue: 36,
        minValue: 0,
        maxValue: 100,
        minLabel: "0%",
        maxLabel: "100%",
        averageValue: 28,
        averageLabel: "County average",
      },
    ]);
  });
});
