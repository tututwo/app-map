import { read } from "$app/server";

export async function readCompressedText(asset: string): Promise<string> {
  const body = read(asset).body;
  if (!body) throw new Error("Generated dashboard asset had no response body");

  return new Response(body.pipeThrough(new DecompressionStream("gzip"))).text();
}

export async function readCompressedJson<T>(asset: string): Promise<T> {
  return JSON.parse(await readCompressedText(asset)) as T;
}
