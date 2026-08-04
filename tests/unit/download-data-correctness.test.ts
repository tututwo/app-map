import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RequestHandler } from "@sveltejs/kit";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

vi.mock("$app/server", () => ({
  read(asset: string) {
    const pathname = decodeURIComponent(new URL(asset, "http://localhost").pathname);
    const filePath = pathname.startsWith("/@fs/")
      ? pathname.slice("/@fs".length)
      : resolve(process.cwd(), pathname.replace(/^\//, ""));
    return new Response(readFileSync(filePath));
  },
}));

import { GET as downloadData } from "../../src/routes/api/download_data/+server";

async function download(path: string): Promise<JSZip> {
  const response = await (downloadData as RequestHandler)({
    url: new URL(path, "http://localhost"),
  } as unknown as Parameters<RequestHandler>[0]);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/zip");
  return JSZip.loadAsync(await response.arrayBuffer());
}

async function csv(zip: JSZip, name: string): Promise<string> {
  const file = zip.file(name);
  expect(file, `${name} present in archive`).toBeTruthy();
  return file!.async("string");
}

describe("download-data GEOID correctness", () => {
  it("uses the national GEOID for every data source when GEOID is omitted", async () => {
    const zip = await download("/api/download_data?from=2003&to=2011");

    const mapCsv = await csv(zip, "map_data.csv");
    const mapRows = mapCsv.trim().split("\n");
    expect(mapRows).toHaveLength(2); // header + the single national row
    expect(mapRows[1]).toContain("00000");
    expect(mapRows[1]).toContain("US, United States");

    // National selections publish no side metrics.
    expect(await csv(zip, "statistics.csv")).toBe("");

    const lineCsv = await csv(zip, "line_chart_data.csv");
    const years = lineCsv
      .trim()
      .split("\n")
      .slice(1)
      .map((row) => Number(row.split(",")[0]));
    expect(Math.min(...years)).toBeGreaterThanOrEqual(2003);
    expect(Math.max(...years)).toBeLessThanOrEqual(2011);
  });

  it("ships an empty map CSV for Connecticut planning regions without map rows", async () => {
    const zip = await download("/api/download_data?from=2003&to=2011&geoid=09110");

    expect(await csv(zip, "map_data.csv")).toBe("");

    const lineCsv = await csv(zip, "line_chart_data.csv");
    expect(lineCsv.trim().split("\n").length).toBeGreaterThan(1);
  });

  it("normalizes South Central Connecticut to its New Haven County fallback", async () => {
    const zip = await download("/api/download_data?from=2003&to=2011&geoid=09170");

    const mapCsv = await csv(zip, "map_data.csv");
    const mapRows = mapCsv.trim().split("\n");
    expect(mapRows).toHaveLength(2);
    expect(mapRows[1]).toContain("09009");
  });

  it("rejects an illegal year window before reading any dataset", async () => {
    await expect(
      (downloadData as RequestHandler)({
        url: new URL("/api/download_data?from=2001&to=2004", "http://localhost"),
      } as unknown as Parameters<RequestHandler>[0])
    ).rejects.toMatchObject({ status: 400 });
  });
});
