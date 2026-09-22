import { gunzipSync, inflateRawSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import manifest from "../../src/lib/generated/metrics-manifest.json" with { type: "json" };

test.beforeEach(() => {
  test.skip(
    process.env.PLAYWRIGHT_WORKER !== "1" && !process.env.PLAYWRIGHT_BASE_URL,
    "Real R2 delivery requires PLAYWRIGHT_WORKER=1 or PLAYWRIGHT_BASE_URL."
  );
});

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

for (const [level, shard, geoid] of [
  ["county", "us", "06037"],
  ["blockgroup", "06", "060014001001"],
] as const) {
  test(`R2 ${level} rows match the released matrices using two byte ranges`, async ({
    request,
  }) => {
    const { release, dtype } = manifest.levels[level];
    const path = `/map-assets/metrics/${level}/${release}/${shard}`;
    const index = await request.get(`${path}/geoids.json.gz`);
    expect(index.status()).toBe(200);
    const geoids: string[] = JSON.parse(gunzipSync(await index.body()).toString());
    const row = geoids.indexOf(geoid);
    expect(row).toBeGreaterThanOrEqual(0);

    const head = await request.head(`${path}/rows.bin`);
    expect(head.status()).toBe(200);
    const size = Number(head.headers()["content-length"]);
    const dataOffset = (geoids.length + 1) * 4;
    expect(size).toBeGreaterThan(dataOffset);
    expect(head.headers()["cache-control"]).toContain("immutable");
    const offsets = await request.get(`${path}/rows.bin`, {
      headers: { Range: `bytes=${row * 4}-${row * 4 + 7}` },
    });
    expect(offsets.status()).toBe(206);
    expect(offsets.headers()["content-range"]).toBe(`bytes ${row * 4}-${row * 4 + 7}/${size}`);
    const entry = await offsets.body();
    expect(entry.length).toBe(8);
    const start = dataOffset + entry.readUInt32LE(0);
    const end = dataOffset + entry.readUInt32LE(4) - 1;
    expect(end).toBeGreaterThanOrEqual(start);
    expect(end).toBeLessThan(size);
    const packed = await request.get(`${path}/rows.bin`, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    expect(packed.status()).toBe(206);
    expect(packed.headers()["content-range"]).toBe(`bytes ${start}-${end}/${size}`);
    const compressed = await packed.body();
    expect(compressed.length).toBe(end - start + 1);
    const counts = inflateRawSync(compressed);
    const windowBytes = manifest.windows.length * (dtype === "u8" ? 1 : 2);
    expect(counts.length).toBe(manifest.religions.length * windowBytes);
    for (const [type, religion] of manifest.religions.entries()) {
      const response = await request.get(`${path}/${religion}.bin.gz`);
      expect(response.status()).toBe(200);
      const matrix = gunzipSync(await response.body());
      expect(matrix.length).toBe(geoids.length * windowBytes);
      expect(counts.subarray(type * windowBytes, (type + 1) * windowBytes)).toEqual(
        matrix.subarray(row * windowBytes, (row + 1) * windowBytes)
      );
    }
  });
}
