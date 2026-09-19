import { describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "../../src/routes/map-assets/[...path]/+server";

const archive = "bg-2010.pmtiles";
const metric = "metrics/blockgroup/012345abcdef/06/all_religions.bin.gz";
const metadata = {
  size: 10,
  httpEtag: '"current"',
  uploaded: new Date("2026-09-19T00:00:00Z"),
};

function setup() {
  const body = new Blob(["0123456789"]).stream();
  const bucket = {
    get: vi.fn().mockResolvedValue({ ...metadata, body }),
    head: vi.fn().mockResolvedValue(metadata),
  };
  const cache = {
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const waitUntil = vi.fn();
  const request = (key = archive, headers: HeadersInit = {}, method = "GET") => {
    const url = new URL(`https://example.workers.dev/map-assets/${key}`);
    return (method === "HEAD" ? HEAD : GET)({
      params: { path: key },
      request: new Request(url, { method, headers }),
      url,
      platform: { env: { TILES: bucket }, caches: { open: async () => cache }, ctx: { waitUntil } },
    } as unknown as Parameters<typeof GET>[0]);
  };
  return { request, bucket, cache, waitUntil, body };
}

describe("R2 tile delivery", () => {
  it("streams the body and makes only release-addressed metrics immutable and edge-cacheable", async () => {
    const tiles = setup();
    const response = await tiles.request();
    expect(response.body).toBe(tiles.body);
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("etag")).toBe('"current"');
    expect(response.headers.get("cache-control")).toBe("public, max-age=300, must-revalidate");
    expect(tiles.bucket.head).not.toHaveBeenCalled();
    expect(tiles.cache.put).not.toHaveBeenCalled();

    const metrics = setup();
    const compressed = await metrics.request(metric);
    expect(compressed.headers.get("cache-control")).toContain("immutable");
    expect(compressed.headers.get("content-type")).toBe("application/octet-stream");
    expect(compressed.headers.has("content-encoding")).toBe(false);
    expect(metrics.cache.put).toHaveBeenCalledOnce();
    expect(metrics.waitUntil).toHaveBeenCalledOnce();
    metrics.cache.match.mockResolvedValue(new Response("cached"));
    expect(await (await metrics.request(metric)).text()).toBe("cached");
    expect(metrics.bucket.get).toHaveBeenCalledOnce();
  });

  it("returns normalized byte ranges and does not download a body for HEAD", async () => {
    for (const [range, contentRange, length] of [
      ["bytes=2-4", "bytes 2-4/10", "3"],
      ["bytes=7-100", "bytes 7-9/10", "3"],
      ["bytes=7-", "bytes 7-9/10", "3"],
      ["bytes=-3", "bytes 7-9/10", "3"],
    ]) {
      const server = setup();
      const response = await server.request(archive, { range });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(contentRange);
      expect(response.headers.get("content-length")).toBe(length);
      expect(server.bucket.get.mock.calls[0][1].range).toBeDefined();
    }
    const server = setup();
    const response = await server.request(archive, { range: "bytes=2-4" }, "HEAD");
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get("content-length")).toBe("10");
    expect(server.bucket.get).not.toHaveBeenCalled();

    const resumed = await server.request(archive, { range: "bytes=2-4", "if-range": '"old"' });
    expect(resumed.status).toBe(200);
    expect(server.bucket.get.mock.calls[0][1].range).toBeUndefined();
  });

  it("distinguishes If-Match failure from If-None-Match hits, with strong/weak comparisons and precedence", async () => {
    for (const [headers, status] of [
      [{ "if-match": '"old"' }, 412],
      [{ "if-match": 'W/"current"' }, 412],
      [{ "if-none-match": 'W/"current"' }, 304],
      [{ "if-none-match": '"old", "current"' }, 304],
      [{ "if-none-match": "*" }, 304],
      [{ "if-match": '"old"', "if-none-match": "*" }, 412],
    ] as const) {
      for (const method of ["GET", "HEAD"]) {
        const server = setup();
        server.bucket.get.mockResolvedValue(metadata);
        const response = await server.request(metric, headers, method);
        expect(response.status).toBe(status);
        expect(response.body).toBeNull();
        expect(response.headers.get("etag")).toBe('"current"');
        expect(server.cache.match).not.toHaveBeenCalled();
      }
    }
    const server = setup();
    const response = await server.request(archive, {
      "if-match": '"old", "current"',
      "if-none-match": '"old"',
    });
    expect(response.status).toBe(200);
  });

  it("rejects unrelated paths, handles missing objects and reports unsatisfiable ranges without hiding storage failures", async () => {
    const server = setup();
    for (const key of [
      "../secret",
      "private.json",
      "metrics/blockgroup/latest/06/all_religions.bin.gz",
      "metrics/blockgroup/012345abcdef/../secret.bin.gz",
    ])
      expect((await server.request(key)).status).toBe(404);
    expect(server.bucket.get).not.toHaveBeenCalled();
    server.bucket.get.mockResolvedValue(null);
    expect((await server.request()).status).toBe(404);
    server.bucket.get.mockRejectedValue(new Error("R2 GET failed: InvalidRange (10039)"));
    const invalid = await server.request(archive, { range: "bytes=100-101" });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */10");
    server.bucket.get.mockRejectedValue(new Error("R2 unavailable"));
    await expect(server.request(archive, { range: "bytes=0-1" })).rejects.toThrow("R2 unavailable");
  });
});
