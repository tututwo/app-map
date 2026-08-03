export type SideMetricValueType = "currency" | "number" | "percent";

export interface SideMetricFieldConfig {
  readonly id: string;
  readonly field: string;
  readonly title: string;
  readonly type: SideMetricValueType;
  readonly range: readonly [number, number];
  readonly labels: readonly [string, string];
  readonly average?: number;
  readonly averageLabel?: string;
}

// These are unweighted arithmetic means of each finite field across the 3,221
// county2010 rows in data-raw/sideMetricData.csv. They compare a county with
// the average dataset county; they are not population-weighted US statistics.
const COUNTY_AVERAGE_LABEL = "County average";

export const socialDeterminantMetricConfigs = [
  {
    id: "median-rent",
    field: "n_med_rent",
    title: "Median gross rent (USD)",
    type: "currency",
    range: [200, 10_000],
    labels: ["$200", "$10k"],
    average: 621,
    averageLabel: COUNTY_AVERAGE_LABEL,
  },
  {
    id: "renters-percent",
    field: "p_renter",
    title: "Percentage of occupied housing units that are renter-occupied",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 28,
    averageLabel: COUNTY_AVERAGE_LABEL,
  },
  {
    id: "poverty-level",
    field: "p_poverty",
    title: "Percentage of population below the poverty level",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 16,
    averageLabel: COUNTY_AVERAGE_LABEL,
  },
  {
    id: "mobility-level",
    field: "p_mobility",
    title: "Percentage of residents living in the same house as one year ago",
    type: "percent",
    range: [0, 100],
    labels: ["0%", "100%"],
    average: 86,
    averageLabel: COUNTY_AVERAGE_LABEL,
  },
  {
    id: "community-health-centers",
    field: "n_commhlthcntr",
    title: "Number of community health centers",
    type: "number",
    range: [0, 100],
    labels: ["0", "100"],
    average: 5,
    averageLabel: COUNTY_AVERAGE_LABEL,
  },
] as const satisfies readonly SideMetricFieldConfig[];

export const demographicMetricConfigs = [
  {
    id: "black-population",
    field: "n_pop_black",
    title: "Black population (count)",
    type: "number",
    range: [0, 60_000],
    labels: ["0", "60k"],
    average: 11_680,
    averageLabel: COUNTY_AVERAGE_LABEL,
  },
  {
    id: "hispanic-population",
    field: "n_pop_hisp",
    title: "Hispanic or Latino population (count)",
    type: "number",
    range: [0, 60_000],
    labels: ["0", "60k"],
    average: 15_851,
    averageLabel: COUNTY_AVERAGE_LABEL,
  },
] as const satisfies readonly SideMetricFieldConfig[];
