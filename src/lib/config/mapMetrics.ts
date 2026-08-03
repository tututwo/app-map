import type { MapDatum } from "$lib/dashboard/data";
import { getAccessibleTextColor } from "$lib/utils/accessibleTextColor";
import { scaleQuantize } from "d3-scale";

export type MapMetricIndex = 0 | 1 | 2;
export type MapMetricKey = "closure" | "closure_rate_per_10000" | "persistence";

export interface MapMetricDefinition {
  readonly label: string;
  readonly value: MapMetricIndex;
  readonly colorKey: MapMetricKey;
  readonly colorRange: readonly string[];
}

export interface MapMetricPresentation extends MapMetricDefinition {
  readonly legendText: readonly string[];
  readonly colorDomain: readonly [number, number];
}

function defineMetric(config: MapMetricDefinition): Readonly<MapMetricDefinition> {
  return Object.freeze({
    ...config,
    colorRange: Object.freeze([...config.colorRange]),
  });
}

export const mapMetricDefinitions = Object.freeze([
  defineMetric({
    label: "Number of closed churches",
    value: 0,
    colorKey: "closure",
    colorRange: ["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"],
  }),
  defineMetric({
    label: "Rate of closed churches per 10,000 population",
    value: 1,
    colorKey: "closure_rate_per_10000",
    colorRange: ["#FAE2C9", "#E9C39B", "#D9A671", "#CB8944", "#B96308"],
  }),
  defineMetric({
    label: "Persistence of open churches",
    value: 2,
    colorKey: "persistence",
    colorRange: ["#F1E0FD", "#CCADE3", "#A272C5", "#7836A7", "#5C168E"],
  }),
] satisfies readonly MapMetricDefinition[]);

function formatBoundary(value: number): string {
  const rounded = Number(value.toFixed(12));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function createMapMetricPresentations(
  data: readonly MapDatum[]
): readonly MapMetricPresentation[] {
  if (data.length === 0) return Object.freeze([]);

  return Object.freeze(
    mapMetricDefinitions.map((metric) => {
      const values = data
        .map((datum) => datum[metric.colorKey])
        .filter((value) => Number.isFinite(value));
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);
      const lowerBound = Math.min(0, Math.floor(minimum));
      const upperBound = Math.max(0, Math.ceil(maximum));
      const colorDomain: [number, number] = [
        lowerBound,
        lowerBound === upperBound ? upperBound + 1 : upperBound,
      ];
      const thresholds = scaleQuantize<number>()
        .domain(colorDomain)
        .range(metric.colorRange.map((_, index) => index))
        .thresholds();
      const boundaries = [colorDomain[0], ...thresholds, colorDomain[1]];
      const legendText = metric.colorRange.map((_, index) => {
        const closingBracket = index === metric.colorRange.length - 1 ? "]" : ")";
        return `[${formatBoundary(boundaries[index])}, ${formatBoundary(
          boundaries[index + 1]
        )}${closingBracket}`;
      });

      return Object.freeze({
        ...metric,
        colorDomain: Object.freeze(colorDomain),
        legendText: Object.freeze(legendText),
      });
    })
  );
}

export function getMapMetricValue(
  datum: MapDatum | undefined,
  metric: Pick<MapMetricDefinition, "colorKey">
): number | undefined {
  return datum?.[metric.colorKey];
}

export interface LegendRow {
  readonly label: string;
  readonly color: string;
  readonly textColor: string;
}

/** Legend rows for a metric — the one place bucket labels meet colors. */
export function createLegendRows(presentation: MapMetricPresentation): LegendRow[] {
  return presentation.legendText.map((label, index) => ({
    label,
    color: presentation.colorRange[index],
    textColor: getAccessibleTextColor(presentation.colorRange[index], "normal"),
  }));
}

/**
 * Which legend bucket a value falls into (0-based), or -1 when there is no
 * value. Uses the same quantize thresholds the legend text was built from —
 * the one bucket algebra shared by the legend and the map's quantile dimming.
 */
export function quantileIndexOf(
  presentation: Pick<MapMetricPresentation, "colorDomain" | "colorRange">,
  value: number | undefined
): number {
  if (value === undefined) return -1;
  return scaleQuantize<number>()
    .domain(presentation.colorDomain)
    .range(presentation.colorRange.map((_, index) => index))(value);
}
