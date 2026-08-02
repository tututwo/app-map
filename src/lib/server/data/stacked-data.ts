import stackedByGeoidAsset from "./generated/stacked_by_geoid.json.gz?url";
import { readCompressedJson } from "./compressed-asset";

export type StackedDatum = {
  year: number;
  negative: number;
  neutral: number;
  positive: number;
};

let stackedByGeoidPromise: Promise<Record<string, StackedDatum[]>> | undefined;

export async function readStackedSeries(geoid: string): Promise<StackedDatum[] | undefined> {
  stackedByGeoidPromise ??= readCompressedJson<Record<string, StackedDatum[]>>(stackedByGeoidAsset);
  return (await stackedByGeoidPromise)[geoid];
}
