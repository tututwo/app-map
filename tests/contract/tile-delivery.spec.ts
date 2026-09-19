import { expect, test } from "@playwright/test";
import manifest from "../../src/lib/generated/metrics-manifest.json" with { type: "json" };

test("the Worker serves real R2 archives, ranges, validators and compressed metrics", async ({
  request,
}) => {
  const archive = "/map-assets/bg-2010.pmtiles";
  const head = await request.head(archive);
  expect(head.status()).toBe(200);
  const size = Number(head.headers()["content-length"]);
  expect(size).toBeGreaterThan(100_000_000);

  const range = await request.get(archive, { headers: { Range: "bytes=0-126" } });
  expect(range.status()).toBe(206);
  expect(range.headers()["content-range"]).toBe(`bytes 0-126/${size}`);
  const bytes = await range.body();
  expect(bytes.length).toBe(127);
  expect(bytes.subarray(0, 7).toString()).toBe("PMTiles");

  const unchanged = await request.get(archive, {
    headers: { "If-None-Match": head.headers().etag, Range: "bytes=0-126" },
  });
  expect(unchanged.status()).toBe(304);
  const pastEnd = await request.get(archive, { headers: { Range: `bytes=${size}-` } });
  expect(pastEnd.status()).toBe(416);
  expect(pastEnd.headers()["content-range"]).toBe(`bytes */${size}`);

  const metric = await request.get(
    `/map-assets/metrics/state/${manifest.levels.state.release}/us/all_religions.bin.gz`
  );
  expect(metric.status()).toBe(200);
  expect(metric.headers()["cache-control"]).toContain("immutable");
  expect([...(await metric.body()).subarray(0, 2)]).toEqual([0x1f, 0x8b]);
  expect((await request.get("/map-assets/not-a-public-map-file")).status()).toBe(404);
});
