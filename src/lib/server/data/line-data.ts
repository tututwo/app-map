import lineByGeoidAsset from "./generated/line_by_geoid.json.gz?url";
import { readCompressedJson } from "./compressed-asset";

export type LineDatum = {
  year: number;
  close: number;
};

let lineByGeoidPromise: Promise<Record<string, LineDatum[]>> | undefined;

export async function readLineSeries(geoid: string): Promise<LineDatum[] | undefined> {
  lineByGeoidPromise ??= readCompressedJson<Record<string, LineDatum[]>>(lineByGeoidAsset);
  return (await lineByGeoidPromise)[geoid];
}
