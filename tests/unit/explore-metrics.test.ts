import { gzipSync } from "node:zlib";
import { expect, test, vi } from "vitest";
import manifest from "$lib/generated/metrics-manifest.json";

const environment = vi.hoisted(() => ({ browser: false }));
vi.mock("$app/environment", () => environment);
vi.mock("$env/dynamic/public", () => ({ env: {} }));

test.each([false, true])(
  "metric loading keeps request memory scoped (browser=%s)",
  async (browser) => {
    environment.browser = browser;
    vi.resetModules();
    const { loadBreakdown, RELIGIONS } = await import("$lib/explore/metrics");
    const geoid = "060010001001";
    const yearWindow = 17;
    let active = 0;
    let peak = 0;
    const fetcherFor = (offset: number) =>
      vi.fn<typeof fetch>(async (input) => {
        peak = Math.max(peak, ++active);
        await Promise.resolve();
        active--;
        const url = String(input);
        if (url.endsWith("geoids.json.gz"))
          return Response.json(offset ? [geoid, "other"] : ["other", geoid]);
        const type = RELIGIONS.findIndex((religion) => url.endsWith(`/${religion}.bin.gz`));
        expect(type).toBeGreaterThanOrEqual(0);
        const counts = new Uint8Array(manifest.windows.length * 2);
        counts[(offset ? 0 : manifest.windows.length) + yearWindow] =
          type === RELIGIONS.length - 1 ? 255 : type + offset;
        // Hosts may serve the gzip file as-is or decompress it via Content-Encoding.
        return new Response(new Uint8Array(type % 2 ? gzipSync(counts) : counts).buffer);
      });
    const expected = (offset: number) =>
      Object.fromEntries(
        RELIGIONS.map((religion, index) => [
          religion,
          index === RELIGIONS.length - 1 ? null : index + offset,
        ])
      );

    const first = fetcherFor(0);
    expect(await loadBreakdown("blockgroup", geoid, yearWindow, first)).toEqual(expected(0));
    expect(first).toHaveBeenCalledTimes(RELIGIONS.length + 1);
    if (browser) expect(peak).toBeGreaterThan(1);
    else expect(peak).toBe(1);

    const nextRequest = fetcherFor(10);
    expect(await loadBreakdown("blockgroup", geoid, yearWindow, nextRequest)).toEqual(
      expected(browser ? 0 : 10)
    );
    expect(nextRequest).toHaveBeenCalledTimes(browser ? 0 : RELIGIONS.length + 1);
  }
);
