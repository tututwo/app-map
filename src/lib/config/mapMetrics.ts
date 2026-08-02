import type { MapDatum } from "$lib/dashboard/data";

export type MapMetricIndex = 0 | 1 | 2;
export type MapMetricKey = "closure" | "closure_rate_per_10000" | "persistence";

export interface MapMetricConfig {
  readonly label: string;
  readonly description: string;
  readonly value: MapMetricIndex;
  readonly legendText: readonly string[];
  readonly colorKey: MapMetricKey;
  readonly colorRange: readonly string[];
  readonly colorDomain: readonly [number, number];
}

function defineMetric(config: MapMetricConfig): Readonly<MapMetricConfig> {
  return Object.freeze(config);
}

export const mapMetricConfigs = Object.freeze([
  defineMetric({
    label: "Number of closed churches",
    description: "Number of closed churches",
    value: 0,
    legendText: ["1-12", "13-24", "25-36", "37-48", "49-60"],
    colorKey: "closure",
    colorRange: ["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"],
    colorDomain: [0, 60],
  }),
  defineMetric({
    label: "Rate of closed churches per 10,000 population",
    description: "Rate of closed churches per 10,000 population",
    value: 1,
    legendText: ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"],
    colorKey: "closure_rate_per_10000",
    colorRange: ["#FAE2C9", "#E9C39B", "#D9A671", "#CB8944", "#B96308"],
    colorDomain: [0, 1],
  }),
  defineMetric({
    label: "Persistence of open churches",
    description: "Persistence of open churches",
    value: 2,
    legendText: ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"],
    colorKey: "persistence",
    colorRange: ["#F1E0FD", "#CCADE3", "#A272C5", "#7836A7", "#5C168E"],
    colorDomain: [0, 1],
  }),
] satisfies readonly MapMetricConfig[]);

export function getMapMetricValue(datum: MapDatum | undefined, metric: MapMetricConfig): number {
  return datum?.[metric.colorKey] ?? metric.colorDomain[0];
}
