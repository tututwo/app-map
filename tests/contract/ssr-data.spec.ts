import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Assertions run against the rendered DOM only — data serialized for
// hydration lives in <script> blobs and must not satisfy an SSR contract.
function domOf(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

test("/ server-renders the dashboard with county data in the DOM", async ({ request }) => {
  const response = await request.get("/?from=2003&to=2011&geoid=01001");

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

// The static-delivery contract: the build must emit one payload per
// enumerated input (136 year windows; every geoid per by-geoid dataset).
test("the build emits the prerendered remote payloads", () => {
  const remoteDir = ".vercel/output/static/_app/remote";
  const [hash] = readdirSync(remoteDir);
  const payloadsOf = (fn: string) => readdirSync(`${remoteDir}/${hash}/${fn}`).length;

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
  const remoteDir = ".vercel/output/static/_app/remote";
  const [hash] = readdirSync(remoteDir);
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
