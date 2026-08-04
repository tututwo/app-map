import type { StandardSchemaV1 } from "@standard-schema/spec";
import { error } from "@sveltejs/kit";
import { prerender } from "$app/server";
import { NATIONAL_GEOID, isNationalGeoid } from "$lib/domain/countyGeoid";
import { legalYearWindows, yearWindowViolation, type YearWindow } from "$lib/domain/yearWindow";
import { readLineSeries, readSideMetric, readStackedSeries } from "$lib/server/data/by-geoid";
import { readMapRange } from "$lib/server/data/map-data";
import type { LineDatum, MapDatum, SideMetricDatum, StackedDatum } from "./data";

/**
 * The dashboard's data is immutable per deployment, so every function here is
 * a `prerender` remote function: enumerated inputs are compiled to static
 * payloads served from the CDN (and cached client-side via the Cache API),
 * while `dynamic: true` keeps a server fallback for anything else — server
 * `load` calls during SSR included.
 */

/** Minimal Standard Schema (https://standardschema.dev) over the domain validators. */
function schema<T>(
  validate: (value: unknown) => StandardSchemaV1.Result<T>
): StandardSchemaV1<T, T> {
  return { "~standard": { version: 1, vendor: "app-map", validate } };
}

const yearWindowSchema = schema<YearWindow>((value) => {
  const { from, to } = (value ?? {}) as Record<string, unknown>;
  if (typeof from !== "number" || typeof to !== "number") {
    return { issues: [{ message: "from and to must be valid integers" }] };
  }
  const violation = yearWindowViolation(from, to);
  return violation ? { issues: [{ message: violation }] } : { value: { from, to } };
});

const geoidSchema = schema<string>((value) =>
  typeof value === "string" && /^\d{5}$/.test(value)
    ? { value }
    : { issues: [{ message: "Invalid geoid" }] }
);

export const getMapData = prerender(
  yearWindowSchema,
  async ({ from, to }): Promise<MapDatum[]> => {
    const dataText = await readMapRange(`${from}-${to}`);
    if (!dataText) error(404, `Data not available for year range ${from}-${to}`);
    return JSON.parse(dataText) as MapDatum[];
  },
  { dynamic: true, inputs: legalYearWindows }
);

export const getLineSeries = prerender(
  geoidSchema,
  async (geoid): Promise<LineDatum[]> => {
    const series = await readLineSeries(geoid);
    if (!series) error(404, `No data found for geoid ${geoid}`);
    return series;
  },
  { dynamic: true, inputs: () => readLineSeries.keys() }
);

export const getStackedSeries = prerender(
  geoidSchema,
  async (geoid): Promise<StackedDatum[]> => {
    const series = await readStackedSeries(geoid);
    if (!series) error(404, `No data found for geoid ${geoid}`);
    return series;
  },
  { dynamic: true, inputs: () => readStackedSeries.keys() }
);

export const getSideMetric = prerender(
  geoidSchema,
  async (geoid): Promise<SideMetricDatum> => {
    // The side-metric dataset publishes no national values; the sentinel gets
    // an explicit empty response instead of a county row.
    if (isNationalGeoid(geoid)) return { geoid: NATIONAL_GEOID };
    const metric = await readSideMetric(geoid);
    if (!metric) error(404, `No data found for geoid ${geoid}`);
    return metric;
  },
  { dynamic: true, inputs: async () => [NATIONAL_GEOID, ...(await readSideMetric.keys())] }
);
