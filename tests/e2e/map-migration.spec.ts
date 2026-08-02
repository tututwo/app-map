import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const appOrigin = "http://127.0.0.1:4173";

const autaugaReverseResponse = {
  display_name: "Autauga County, Alabama, United States",
  address: { county: "Autauga County", state: "Alabama" },
};

async function enableAutaugaGeolocation(context: BrowserContext) {
  await context.grantPermissions(["geolocation"], { origin: appOrigin });
  await context.setGeolocation({ latitude: 32.5364, longitude: -86.6445 });
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
}

async function clickGeolocate(page: Page) {
  const geolocate = page.locator("button.maplibregl-ctrl-geolocate");
  await expect(geolocate).toBeEnabled();
  await geolocate.click();
}

async function delayAutaugaReverseGeocode(page: Page) {
  let markRequested!: () => void;
  let releaseResponse!: () => void;
  let markFulfilled!: () => void;
  const requested = new Promise<void>((resolve) => (markRequested = resolve));
  const released = new Promise<void>((resolve) => (releaseResponse = resolve));
  const fulfilled = new Promise<void>((resolve) => (markFulfilled = resolve));

  await page.route("https://nominatim.openstreetmap.org/reverse?*", async (route) => {
    markRequested();
    await released;
    await fulfillJson(route, autaugaReverseResponse);
    markFulfilled();
  });

  return { requested, releaseResponse, fulfilled };
}

test("map canvas keeps the WebGL attributes required for PDF capture", async ({ page }) => {
  await page.goto("/?from=2003&to=2011&geoid=00000");

  const canvas = page.getByRole("region", { name: "Map" }).locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible();

  const attributes = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("webgl2") ?? element.getContext("webgl");
    const contextAttributes = context?.getContextAttributes();
    if (!contextAttributes) throw new Error("Map canvas has no readable WebGL context attributes");

    return {
      preserveDrawingBuffer: contextAttributes.preserveDrawingBuffer,
      antialias: contextAttributes.antialias,
      stencil: contextAttributes.stencil,
      alpha: contextAttributes.alpha,
    };
  });

  expect(attributes).toEqual({
    preserveDrawingBuffer: true,
    antialias: true,
    stencil: true,
    alpha: true,
  });
});

test("resetting a deep-linked county converges the URL and heading on all locations", async ({
  page,
}) => {
  await page.goto("/?from=2004&to=2012&geoid=01001");

  const heading = page.getByRole("region", { name: "Line chart" }).locator("h1");
  await expect(heading).toContainText("Autauga County, AL");

  await page
    .getByRole("region", { name: "Map" })
    .getByRole("button", { name: "Fly to the center of the map" })
    .click();

  await expect.poll(() => new URL(page.url()).searchParams.get("geoid")).toBe("00000");
  await expect(heading).toContainText("All locations");
  expect(new URL(page.url()).searchParams.get("from")).toBe("2004");
  expect(new URL(page.url()).searchParams.get("to")).toBe("2012");
});

test("browser geolocation resolves to Autauga County through Nominatim", async ({
  context,
  page,
}) => {
  await enableAutaugaGeolocation(context);
  await page.route("https://nominatim.openstreetmap.org/reverse?*", (route) =>
    fulfillJson(route, autaugaReverseResponse)
  );
  await page.goto("/?from=2003&to=2011&geoid=00000");

  await clickGeolocate(page);

  await expect.poll(() => new URL(page.url()).searchParams.get("geoid")).toBe("01001");
  await expect(page.getByRole("region", { name: "Line chart" }).locator("h1")).toContainText(
    "Autauga County, Alabama"
  );
});

test("a delayed reverse geocode cannot overwrite a later reset", async ({ context, page }) => {
  await enableAutaugaGeolocation(context);
  const reverseGeocode = await delayAutaugaReverseGeocode(page);
  await page.goto("/?from=2003&to=2011&geoid=01003");

  await clickGeolocate(page);
  await reverseGeocode.requested;

  await page
    .getByRole("region", { name: "Map" })
    .getByRole("button", { name: "Fly to the center of the map" })
    .click();
  await expect.poll(() => new URL(page.url()).searchParams.get("geoid")).toBe("00000");

  reverseGeocode.releaseResponse();
  await reverseGeocode.fulfilled;
  await page.waitForTimeout(750);

  // Migration tripwire: releasing the stale response must leave the newer reset authoritative.
  expect(new URL(page.url()).searchParams.get("geoid")).toBe("00000");
  await expect(page.getByRole("region", { name: "Line chart" }).locator("h1")).toContainText(
    "All locations"
  );
});

test("a delayed reverse geocode cannot overwrite a later county search", async ({
  context,
  page,
}) => {
  await enableAutaugaGeolocation(context);
  const reverseGeocode = await delayAutaugaReverseGeocode(page);
  await page.route("https://nominatim.openstreetmap.org/search?*", (route) =>
    fulfillJson(route, [
      {
        lat: "30.66",
        lon: "-87.75",
        display_name: "Baldwin County, Alabama, United States",
        address: { county: "Baldwin County", state: "Alabama" },
      },
    ])
  );
  await page.goto("/?from=2003&to=2011&geoid=00000");

  await clickGeolocate(page);
  await reverseGeocode.requested;

  const search = page.getByRole("combobox", { name: "Search for a county" });
  await search.fill("Baldwin");
  await page.getByText("Baldwin County, Alabama", { exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("geoid")).toBe("01003");

  reverseGeocode.releaseResponse();
  await reverseGeocode.fulfilled;
  await page.waitForTimeout(750);

  // Migration tripwire: releasing the stale response must leave the newer search authoritative.
  expect(new URL(page.url()).searchParams.get("geoid")).toBe("01003");
  await expect(page.getByRole("region", { name: "Line chart" }).locator("h1")).toContainText(
    "Baldwin County, Alabama"
  );
});
