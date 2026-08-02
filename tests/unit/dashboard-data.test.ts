import { describe, expect, test, vi } from "vitest";

import { createDashboardResultCache, loadDashboardData } from "$lib/dashboard/data";

const params = { from: 2003, to: 2011, geoid: "01001" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("loadDashboardData", () => {
  test("loads selected map data without filtering the national map by GEOID", async () => {
    const fetch = vi.fn(async () => Response.json([{ geoid: "01001", name: "Autauga County" }]));
    const depends = vi.fn();

    const results = await loadDashboardData({ fetch, depends }, params, new Set(["map"]));

    expect(results).toEqual({
      map: {
        ok: true,
        data: [{ geoid: "01001", name: "Autauga County" }],
      },
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/map_data?from=2003&to=2011");
    expect(depends).toHaveBeenCalledOnce();
    expect(depends).toHaveBeenCalledWith("app:dashboard");
  });

  test("loads only selected county-specific parts with the GEOID", async () => {
    const payloads: Record<string, unknown> = {
      "/api/line_chart_data?geoid=01001": [{ year: 2003, close: 2 }],
      "/api/stacked_bar_chart_data?geoid=01001": [
        { year: 2003, negative: -2, neutral: 3, positive: 1 },
      ],
      "/api/side_metric_data?geoid=01001": { geoid: "01001", p_renter: "31.5" },
    };
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return Response.json(payloads[url]);
    });

    const results = await loadDashboardData(
      { fetch, depends: vi.fn() },
      params,
      new Set(["line", "stacked", "side"])
    );

    expect(results).toEqual({
      line: { ok: true, data: [{ year: 2003, close: 2 }] },
      stacked: {
        ok: true,
        data: [{ year: 2003, negative: -2, neutral: 3, positive: 1 }],
      },
      side: { ok: true, data: { geoid: "01001", p_renter: "31.5" } },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.map(([input]) => String(input))).toEqual(
      expect.arrayContaining(Object.keys(payloads))
    );
  });

  test("starts every selected request before waiting for any response", async () => {
    const requests = {
      "/api/map_data?from=2003&to=2011": deferred<Response>(),
      "/api/line_chart_data?geoid=01001": deferred<Response>(),
      "/api/stacked_bar_chart_data?geoid=01001": deferred<Response>(),
      "/api/side_metric_data?geoid=01001": deferred<Response>(),
    };
    const fetch = vi.fn((input: RequestInfo | URL) => {
      return requests[String(input) as keyof typeof requests].promise;
    });

    const loading = loadDashboardData(
      { fetch, depends: vi.fn() },
      params,
      new Set(["map", "line", "stacked", "side"])
    );

    expect(fetch).toHaveBeenCalledTimes(4);

    requests["/api/map_data?from=2003&to=2011"].resolve(Response.json([]));
    requests["/api/line_chart_data?geoid=01001"].resolve(Response.json([]));
    requests["/api/stacked_bar_chart_data?geoid=01001"].resolve(Response.json([]));
    requests["/api/side_metric_data?geoid=01001"].resolve(Response.json({ geoid: "01001" }));
    await loading;
  });

  test("shares one in-flight immutable request across consecutive loads", async () => {
    const response = deferred<Response>();
    const fetch = vi.fn(() => response.promise);
    const cache = createDashboardResultCache();
    const dependencies = { fetch, depends: vi.fn(), cache };

    const first = loadDashboardData(dependencies, params, new Set(["map"]));
    const second = loadDashboardData(dependencies, params, new Set(["map"]));

    expect(fetch).toHaveBeenCalledOnce();
    response.resolve(Response.json([{ geoid: "01001" }]));

    await expect(first).resolves.toEqual({
      map: { ok: true, data: [{ geoid: "01001" }] },
    });
    await expect(second).resolves.toEqual({
      map: { ok: true, data: [{ geoid: "01001" }] },
    });
  });

  test("evicts failures so an explicit retry reaches the endpoint", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json([{ geoid: "01001" }]));
    const dependencies = {
      fetch,
      depends: vi.fn(),
      cache: createDashboardResultCache(),
    };

    const failed = await loadDashboardData(dependencies, params, new Set(["map"]));
    const retried = await loadDashboardData(dependencies, params, new Set(["map"]));

    expect(failed.map).toMatchObject({ ok: false, kind: "http" });
    expect(retried.map).toEqual({ ok: true, data: [{ geoid: "01001" }] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("returns an HTTP error for one part without discarding another part's success", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/map_data")) {
        return new Response("unavailable", { status: 503, statusText: "Service Unavailable" });
      }
      return Response.json([{ year: 2003, close: 2 }]);
    });

    const results = await loadDashboardData(
      { fetch, depends: vi.fn() },
      params,
      new Set(["map", "line"])
    );

    expect(results.map).toEqual({
      ok: false,
      kind: "http",
      message: expect.stringContaining("503"),
    });
    expect(results.line).toEqual({ ok: true, data: [{ year: 2003, close: 2 }] });
  });

  test("returns a network error when fetch rejects", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("connection lost");
    });

    const results = await loadDashboardData({ fetch, depends: vi.fn() }, params, new Set(["side"]));

    expect(results.side).toEqual({
      ok: false,
      kind: "network",
      message: expect.stringContaining("connection lost"),
    });
  });

  test("returns an invalid-data error when a successful response is not JSON", async () => {
    const fetch = vi.fn(async () => new Response("not JSON", { status: 200 }));

    const results = await loadDashboardData({ fetch, depends: vi.fn() }, params, new Set(["line"]));

    expect(results.line).toEqual({
      ok: false,
      kind: "invalid-data",
      message: expect.any(String),
    });
  });

  test("returns invalid-data when a response has the wrong top-level shape", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      return String(input).startsWith("/api/side_metric_data")
        ? Response.json([])
        : Response.json({ geoid: "01001" });
    });

    const results = await loadDashboardData(
      { fetch, depends: vi.fn() },
      params,
      new Set(["map", "side"])
    );

    expect(results.map).toMatchObject({ ok: false, kind: "invalid-data" });
    expect(results.side).toMatchObject({ ok: false, kind: "invalid-data" });
  });

  test("passes a timeout signal and classifies timeout failures", async () => {
    let signal: AbortSignal | null | undefined;
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal;
      throw new DOMException("The operation timed out", "TimeoutError");
    });

    const results = await loadDashboardData(
      { fetch, depends: vi.fn() },
      params,
      new Set(["stacked"])
    );

    expect(signal).toBeInstanceOf(AbortSignal);
    expect(results.stacked).toEqual({
      ok: false,
      kind: "timeout",
      message: expect.stringContaining("timed out"),
    });
  });
});
