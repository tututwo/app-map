import { deflateRawSync, gzipSync } from "node:zlib";
import { expect, test, vi } from "vitest";
import manifest from "$lib/generated/metrics-manifest.json";

const environment = vi.hoisted(() => ({ browser: false }));
vi.mock("$app/environment", () => environment);
vi.mock("$env/dynamic/public", () => ({ env: {} }));

test.each([false, true])(
  "matrices cache only their typed counts in the browser (browser=%s)",
  async (browser) => {
    environment.browser = browser;
    vi.resetModules();
    const { loadCounts, valueAt } = await import("$lib/explore/metrics");
    const counts = new Uint8Array(manifest.windows.length);
    counts[17] = 42;
    counts[18] = 255;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(new Uint8Array(gzipSync(counts))))
      .mockResolvedValueOnce(new Response(counts));
    const first = await loadCounts("blockgroup", "06", "all_religions", fetcher);
    expect(valueAt(first, 0, 17)).toBe(42);
    expect(valueAt(first, 0, 18)).toBeNull();
    expect(await loadCounts("blockgroup", "06", "all_religions", fetcher)).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(browser ? 1 : 2);
  }
);

test("a failed row request surfaces the error and can retry", async () => {
  environment.browser = true;
  vi.resetModules();
  const { loadBreakdown } = await import("$lib/explore/metrics");
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith("geoids.json.gz")
      ? Response.json(["060010001001"])
      : new Response(null, { status: 404 })
  );
  for (let i = 0; i < 2; i++)
    await expect(loadBreakdown("blockgroup", "060010001001", 17, fetcher)).rejects.toThrow("404");
  expect(fetcher).toHaveBeenCalledTimes(3);
});

test.each([
  [206, false],
  [200, false],
  [206, true],
  [200, true],
] as const)(
  "one place is read from rows.bin by byte range (host=%i, browser=%s)",
  async (status, browser) => {
    environment.browser = browser;
    vi.resetModules();
    const { loadBreakdown, RELIGIONS } = await import("$lib/explore/metrics");
    const windows = manifest.windows.length;
    // Two places. The second has the Type's index as its count in window 17, and no observation of the last.
    const place = (offset: number) => {
      const counts = new Uint8Array(RELIGIONS.length * windows);
      RELIGIONS.forEach((_, type) => (counts[type * windows + 17] = type + offset));
      counts[(RELIGIONS.length - 1) * windows + 17] = 255;
      return deflateRawSync(counts);
    };
    const rows = [place(100), place(0)];
    const index = new Uint32Array([0, rows[0].length, rows[0].length + rows[1].length]);
    const file = Buffer.concat([Buffer.from(index.buffer), ...rows]);
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("geoids.json.gz")) return Response.json(["other", "060010001001"]);
      expect(url).toMatch(/\/metrics\/blockgroup\/[a-f0-9]{12}\/06\/rows\.bin$/);
      const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get("range")!)!;
      return status === 206
        ? new Response(new Uint8Array(file.subarray(+from, +to + 1)), { status })
        : new Response(new Uint8Array(file), { status });
    });
    expect(await loadBreakdown("blockgroup", "060010001001", 17, fetcher)).toEqual(
      Object.fromEntries(
        RELIGIONS.map((religion, type) => [religion, type === RELIGIONS.length - 1 ? null : type])
      )
    );
    // The place list, then the offsets and the place; a host without Range is asked once.
    const calls = status === 206 ? 3 : 2;
    expect(fetcher).toHaveBeenCalledTimes(calls);
    await loadBreakdown("blockgroup", "060010001001", 18, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(browser ? calls : calls * 2);
  }
);

test("a truncated but valid compressed row fails instead of returning undefined counts", async () => {
  environment.browser = false;
  vi.resetModules();
  const { loadBreakdown } = await import("$lib/explore/metrics");
  const packed = deflateRawSync(new Uint8Array(1));
  const file = Buffer.concat([Buffer.from(new Uint32Array([0, packed.length]).buffer), packed]);
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith("geoids.json.gz")
      ? Response.json(["060010001001"])
      : new Response(new Uint8Array(file))
  );
  await expect(loadBreakdown("blockgroup", "060010001001", 17, fetcher)).rejects.toThrow(
    "Invalid row counts"
  );
});
