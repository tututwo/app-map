import { expect, test, vi } from "vitest";

const environment = vi.hoisted(() => ({ browser: false }));
vi.mock("$app/environment", () => environment);
vi.mock("$env/dynamic/public", () => ({ env: {} }));

test.each([false, true])(
  "community data parses once in the browser, but stays request-scoped on the server (browser=%s)",
  async (browser) => {
    environment.browser = browser;
    vi.resetModules();
    const { loadContext, loadStateContexts } = await import("$lib/explore/sdoh");
    const decode = vi.spyOn(TextDecoder.prototype, "decode");
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ "09": [3_574_097] }));
    try {
      const [place, states] = await Promise.all([
        loadContext("state", "09", fetcher),
        loadStateContexts(fetcher),
      ]);
      expect(place).toEqual(states["09"]);
      expect(place).toMatchObject({ pop2010: 3_574_097, n_medincome: null });
      const nextRequest = vi.fn<typeof fetch>(async () => Response.json({ "09": [10] }));
      expect(await loadContext("state", "09", nextRequest)).toMatchObject({
        pop2010: browser ? 3_574_097 : 10,
      });
      expect(fetcher).toHaveBeenCalledTimes(browser ? 1 : 2);
      expect(nextRequest).toHaveBeenCalledTimes(browser ? 0 : 1);
      expect(decode).toHaveBeenCalledTimes(browser ? 1 : 3);
    } finally {
      decode.mockRestore();
    }
  }
);

test("a failed community-data request can retry, and unpublished places stay missing", async () => {
  environment.browser = true;
  vi.resetModules();
  const { loadContext } = await import("$lib/explore/sdoh");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ "06037": [9_818_605] }));
  await expect(loadContext("county", "06037", fetcher)).rejects.toThrow("503");
  await expect(loadContext("county", "06037", fetcher)).resolves.toMatchObject({
    pop2010: 9_818_605,
  });
  await expect(loadContext("county", "99999", fetcher)).resolves.toBeNull();
  await expect(loadContext("blockgroup", "990000000001", fetcher)).resolves.toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("malformed community data is not retained and every source read has a deadline", async () => {
  environment.browser = true;
  vi.resetModules();
  const { loadContext } = await import("$lib/explore/sdoh");
  const signal = AbortSignal.abort();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("broken JSON"))
    .mockResolvedValueOnce(Response.json({ "06037": [9_818_605] }));
  try {
    await expect(loadContext("county", "06037", fetcher)).rejects.toThrow();
    await expect(loadContext("county", "06037", fetcher)).resolves.toMatchObject({
      pop2010: 9_818_605,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, options]) => options?.signal === signal)).toBe(true);
    expect(timeout).toHaveBeenCalledWith(10_000);
  } finally {
    timeout.mockRestore();
  }
});
