import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RequestHandler } from "@sveltejs/kit";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

const origin = "http://localhost";

vi.mock("$app/server", () => ({
  read(asset: string) {
    const pathname = decodeURIComponent(new URL(asset, origin).pathname);
    const filePath = pathname.startsWith("/@fs/")
      ? pathname.slice("/@fs".length)
      : resolve(process.cwd(), pathname.replace(/^\//, ""));
    return new Response(readFileSync(filePath));
  },
}));

import { GET as downloadData } from "../../src/routes/api/download_data/+server";

function responseFor(url: string): Response {
  if (url.startsWith("/api/line_chart_data")) {
    return Response.json([{ year: 2003, close: 1 }]);
  }
  if (url.startsWith("/api/map_data")) {
    if (url.includes("geoid=09110")) return new Response("missing", { status: 404 });
    return Response.json([{ geoid: "00000", name: "US, United States" }]);
  }
  return Response.json([{ year: 2003, negative: -1, neutral: 2, positive: 1 }]);
}

async function call(path: string, fetch: ReturnType<typeof vi.fn>): Promise<Response> {
  return (downloadData as RequestHandler)({
    url: new URL(path, origin),
    fetch,
  } as unknown as Parameters<RequestHandler>[0]);
}

describe("download-data GEOID correctness", () => {
  it("uses the national GEOID for every data source when GEOID is omitted", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));

    const response = await call("/api/download_data?from=2003&to=2011", fetch);

    expect(response.status).toBe(200);
    expect(fetch.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/line_chart_data?from=2003&to=2011&geoid=00000",
      "/api/map_data?from=2003&to=2011&geoid=00000",
      "/api/stacked_bar_chart_data?from=2003&to=2011&geoid=00000",
    ]);

    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const statistics = await zip.file("statistics.csv")!.async("string");
    expect(statistics).toBe("");
  });

  it("keeps available planning-region series and emits empty CSVs for known data gaps", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));

    const response = await call("/api/download_data?from=2003&to=2011&geoid=09110", fetch);

    expect(response.status).toBe(200);
    expect(fetch.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/line_chart_data?from=2003&to=2011&geoid=09110",
      "/api/map_data?from=2003&to=2011&geoid=09110",
      "/api/stacked_bar_chart_data?from=2003&to=2011&geoid=09110",
    ]);

    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const line = await zip.file("line_chart_data.csv")!.async("string");
    const map = await zip.file("map_data.csv")!.async("string");
    const stacked = await zip.file("stacked_bar_chart_data.csv")!.async("string");
    const statistics = await zip.file("statistics.csv")!.async("string");
    expect(line).toBe("year,close\n2003,1");
    expect(map).toBe("");
    expect(stacked).toBe("year,negative,neutral,positive\n2003,-1,2,1");
    expect(statistics).toBe("");
  });

  it("uses the same proven Connecticut alias for every exported dataset", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));

    const response = await call("/api/download_data?from=2003&to=2011&geoid=09170", fetch);

    expect(response.status).toBe(200);
    expect(fetch.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/line_chart_data?from=2003&to=2011&geoid=09009",
      "/api/map_data?from=2003&to=2011&geoid=09009",
      "/api/stacked_bar_chart_data?from=2003&to=2011&geoid=09009",
    ]);
  });
});
