import lineByGeoidAsset from "./generated/line_by_geoid.json.gz?url";
import stackedByGeoidAsset from "./generated/stacked_by_geoid.json.gz?url";
import sideMetricByGeoidAsset from "./generated/side_metric_by_geoid.json.gz?url";
import { readCompressedJson } from "./compressed-asset";
import type { LineDatum, SideMetricDatum, StackedDatum } from "$lib/dashboard/data";

interface ByGeoidReader<T> {
  (geoid: string): Promise<T | undefined>;
  /** Every geoid the dataset provides — enumerates prerender inputs. */
  keys(): Promise<string[]>;
}

function createByGeoidReader<T>(asset: string): ByGeoidReader<T> {
  let byGeoidPromise: Promise<Record<string, T>> | undefined;
  const load = () => (byGeoidPromise ??= readCompressedJson<Record<string, T>>(asset));

  return Object.assign(async (geoid: string) => (await load())[geoid], {
    keys: async () => Object.keys(await load()),
  });
}

export const readLineSeries = createByGeoidReader<LineDatum[]>(lineByGeoidAsset);
export const readStackedSeries = createByGeoidReader<StackedDatum[]>(stackedByGeoidAsset);
export const readSideMetric = createByGeoidReader<SideMetricDatum>(sideMetricByGeoidAsset);
