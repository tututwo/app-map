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

    for (const level of ["tract", "zcta", "blockgroup"]) {
      const slice = setup();
      const colors = await slice.request(`map/${level}/012345abcdef/all_religions/17.bin.gz`);
      expect(colors.status).toBe(200);
      expect(colors.headers.get("cache-control")).toContain("immutable");
      expect(colors.headers.has("content-encoding")).toBe(false);
      expect(slice.cache.put).toHaveBeenCalledOnce();
      expect((await setup().request(`map/${level}/012345abcdef/geoids.json.gz`)).status).toBe(200);
    }
  });

  it("returns normalized byte ranges and does not download a body for HEAD", async () => {
    for (const name of ["tract", "zcta", "bg"]) {
      const tiles = setup();
      const key = `${name}-2010-v2.pmtiles`;
      expect((await tiles.request(key, { range: "bytes=0-9" })).status).toBe(206);
      expect(tiles.bucket.get.mock.calls[0][0]).toBe(key);
    }
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

    // A validator that still matches gets its range: the PMTiles reader aborts on a whole archive.
    for (const validator of ['"current"', "Sat, 19 Sep 2026 00:00:00 GMT"]) {
      const next = setup();
      const part = await next.request(archive, { range: "bytes=2-4", "if-range": validator });
      expect(part.status).toBe(206);
      expect(part.headers.get("content-range")).toBe("bytes 2-4/10");
      expect(next.bucket.get.mock.calls[0][1].range).toEqual({ offset: 2, length: 3 });
    }
    const stale = setup();
    const whole = await stale.request(archive, {
      range: "bytes=2-4",
      "if-range": "Fri, 18 Sep 2026 00:00:00 GMT",
    });
    expect(whole.status).toBe(200);
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
      "sdoh/msa/012345abcdef/06.json.gz",
      "sdoh/tract/latest/06.json.gz",
      "metrics/blockgroup/012345abcdef/06/rows.json",
      "metrics/blockgroup/012345abcdef/rows.bin",
      "map/tract/latest/all_religions/17.bin.gz",
      "map/tract/012345abcdef/../17.bin.gz",
      "map/tract/012345abcdef/all_religions/-1.bin.gz",
      "map/tract/012345abcdef/all_religions/17.bin",
      "map/unknown/012345abcdef/all_religions/17.bin.gz",
      "bg-2010-v3.pmtiles",
    ])
      expect((await server.request(key)).status).toBe(404);
    expect(server.bucket.get).not.toHaveBeenCalled();
    expect((await server.request("sdoh/tract/012345abcdef/06.json.gz")).status).toBe(200);
    // One place is read out of rows.bin by byte range: immutable, and never through the whole-file cache.
    const rows = setup();
    const place = await rows.request("metrics/blockgroup/012345abcdef/06/rows.bin", {
      range: "bytes=4-7",
    });
    expect(place.status).toBe(206);
    expect(place.headers.get("content-range")).toBe("bytes 4-7/10");
    expect(place.headers.get("cache-control")).toContain("immutable");
    expect(rows.bucket.get.mock.calls[0][1].range).toEqual({ offset: 4, length: 4 });
    expect(rows.cache.put).not.toHaveBeenCalled();
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
