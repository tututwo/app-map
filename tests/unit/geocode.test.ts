import { afterEach, expect, test, vi } from "vitest";
import { POST } from "../../src/routes/api/geocode/+server";

const ask = (body: unknown) =>
  POST({
    request: new Request("https://example.workers.dev/api/geocode", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof POST>[0]);

afterEach(() => vi.unstubAllGlobals());

test("an address becomes a point, and the reply is never cached", async () => {
  const census = vi.fn().mockResolvedValue(
    Response.json({
      result: {
        addressMatches: [
          {
            matchedAddress: "60 COLLEGE ST, NEW HAVEN, CT, 06520",
            coordinates: { x: -72.93, y: 41.3 },
          },
        ],
      },
    })
  );
  vi.stubGlobal("fetch", census);
  const response = await ask({ address: " 60 College St, New Haven " });
  expect(await response.json()).toEqual({
    match: { at: [-72.93, 41.3], label: "60 COLLEGE ST, NEW HAVEN, CT, 06520" },
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(String(census.mock.calls[0][0])).toContain("address=60+College+St%2C+New+Haven&");
});

test("no match is an answer; an outage and a bad request are not", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ result: { addressMatches: [] } }))
  );
  expect(await (await ask({ address: "1 Nowhere Road" })).json()).toEqual({ match: null });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  expect((await ask({ address: "60 College St" })).status).toBe(502);
  const census = vi.fn();
  vi.stubGlobal("fetch", census);
  for (const bad of [{}, { address: 5 }, { address: "x" }, { address: "y".repeat(201) }])
    expect((await ask(bad)).status).toBe(400);
  expect(census).not.toHaveBeenCalled();
});
