import { readCompressedText } from "./compressed-asset";

const mapAssets = import.meta.glob("./generated/map/*.json.gz", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export async function readMapRange(range: string): Promise<string | undefined> {
  const asset = mapAssets[`./generated/map/${range}.json.gz`];
  return asset ? readCompressedText(asset) : undefined;
}
