import sideMetricByGeoidAsset from "./generated/side_metric_by_geoid.json.gz?url";
import { readCompressedJson } from "./compressed-asset";

export type SideMetricRow = Record<string, string> & { geoid: string };

let sideMetricByGeoidPromise: Promise<Record<string, SideMetricRow>> | undefined;

export async function readSideMetric(geoid: string): Promise<SideMetricRow | undefined> {
  sideMetricByGeoidPromise ??=
    readCompressedJson<Record<string, SideMetricRow>>(sideMetricByGeoidAsset);
  return (await sideMetricByGeoidPromise)[geoid];
}
