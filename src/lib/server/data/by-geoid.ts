import lineByGeoidAsset from "./generated/line_by_geoid.json.gz?url";
import stackedByGeoidAsset from "./generated/stacked_by_geoid.json.gz?url";
import sideMetricByGeoidAsset from "./generated/side_metric_by_geoid.json.gz?url";
import { readCompressedJson } from "./compressed-asset";
import type { LineDatum, SideMetricDatum, StackedDatum } from "$lib/dashboard/data";

function createByGeoidReader<T>(asset: string): (geoid: string) => Promise<T | undefined> {
  let byGeoidPromise: Promise<Record<string, T>> | undefined;
  return async (geoid) => {
    byGeoidPromise ??= readCompressedJson<Record<string, T>>(asset);
    return (await byGeoidPromise)[geoid];
  };
}

export const readLineSeries = createByGeoidReader<LineDatum[]>(lineByGeoidAsset);
export const readStackedSeries = createByGeoidReader<StackedDatum[]>(stackedByGeoidAsset);
export const readSideMetric = createByGeoidReader<SideMetricDatum>(sideMetricByGeoidAsset);
