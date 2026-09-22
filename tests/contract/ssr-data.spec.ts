import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Assertions run against the rendered DOM only — data serialized for
// hydration lives in <script> blobs and must not satisfy an SSR contract.
function domOf(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

test("/legacy server-renders the dashboard with county data in the DOM", async ({ request }) => {
  const response = await request.get("/legacy?from=2003&to=2011&geoid=01001");

  expect(response.status()).toBe(200);
  const dom = domOf(await response.text());
  expect(dom).toContain("Autauga County, AL");
  expect(dom).toContain("From 2003 to 2011");
});

test("/PDF server-renders a county report in the DOM", async ({ request }) => {
  const response = await request.get("/PDF?from=2004&to=2012&geoid=01001");

  expect(response.status()).toBe(200);
  expect(domOf(await response.text())).toContain("Autauga County");
});

test("/PDF tolerates a well-formed unknown geoid", async ({ request }) => {
  const response = await request.get("/PDF?from=2004&to=2012&geoid=99999");

  expect(response.status()).toBe(200);
  expect(domOf(await response.text())).not.toContain("NaN");
});

function remoteHashFor(fn: string) {
  const remoteDir = ".svelte-kit/cloudflare/_app/remote";
  const hash = readdirSync(remoteDir).find((hash) =>
    readdirSync(`${remoteDir}/${hash}`).includes(fn)
  );
  if (!hash) throw new Error(`Missing prerendered payloads for ${fn}`);
  return hash;
}

// The static-delivery contract: the build must emit one payload per
// enumerated input (136 year windows; every geoid per by-geoid dataset).
test("the build emits the prerendered remote payloads", () => {
  const remoteDir = ".svelte-kit/cloudflare/_app/remote";
  const payloadsOf = (fn: string) => readdirSync(`${remoteDir}/${remoteHashFor(fn)}/${fn}`).length;

  expect(payloadsOf("getMapData")).toBe(136);
  expect(payloadsOf("getLineSeries")).toBeGreaterThan(3000);
  expect(payloadsOf("getStackedSeries")).toBeGreaterThan(3000);
  expect(payloadsOf("getSideMetric")).toBeGreaterThan(3000);
});

// The validation contract on the only exposed data surface: remote function
// arguments are schema-checked (400) and unknown geoids 404 via the dynamic
// fallback. Kit transports both in-band as {type:"error",status} over HTTP
// 200, with schema failures masked as a generic message.
test("remote endpoints validate their arguments", async ({ request }) => {
  const hash = remoteHashFor("getLineSeries");
  const payload = (value: unknown) => Buffer.from(JSON.stringify([value])).toString("base64url");

  const unknownGeoid = await request.get(`/_app/remote/${hash}/getLineSeries/${payload("99999")}`);
  expect(unknownGeoid.status()).toBe(200);
  expect(await unknownGeoid.json()).toMatchObject({
    type: "error",
    status: 404,
    error: { message: "No data found for geoid 99999" },
  });

  const malformedGeoid = await request.get(`/_app/remote/${hash}/getLineSeries/${payload("no")}`);
  expect(malformedGeoid.status()).toBe(200);
  expect(await malformedGeoid.json()).toMatchObject({ type: "error", status: 400 });
});

// Explore counts come from the Metric cube (scripts/build-metrics.py), read during SSR like any client.
test("/explore server-renders source counts for a state, a window and every type", async ({
  request,
}) => {
  const response = await request.get("/explore?where=CT&from=2010&to=2015&type=all");
  expect(response.status()).toBe(200);
  const dom = domOf(await response.text());
  expect(dom).toContain("Connecticut");
  expect(dom).toContain("476");
  expect(dom).toContain("Reported closures by type");
  expect(dom).toContain("withheld");
});

test("a shared county link stays below the HTML budget", async ({ request }) => {
  const response = await request.get(
    "/explore?where=06037&level=county&from=2010&to=2015&type=all"
  );
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(domOf(html)).toContain("Los Angeles County");
  // Before ranged rows, one place serialized ten entire matrices into 3.3 MB of HTML.
  expect(Buffer.byteLength(html)).toBeLessThan(600_000);
});

test("concurrent block-group deep links render across three large states", async ({ request }) => {
  await Promise.all(
    ["060014001001", "480019501001", "360010001001"].map(async (where) => {
      const response = await request.get(
        `/explore?where=${where}&level=blockgroup&from=2010&to=2015&type=all`
      );
      expect(response.status()).toBe(200);
      const html = await response.text();
      const dom = domOf(html);
      expect(dom).toContain("Reported closures by type");
      expect(dom).not.toContain("Data could not be loaded");
      // California previously serialized 1.5 MB; keep room for ordinary markup growth.
      expect(Buffer.byteLength(html)).toBeLessThan(600_000);
    })
  );
});
