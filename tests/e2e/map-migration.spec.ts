import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

async function delayBrowserGeolocation(page: Page) {
  await page.addInitScript(() => {
    const state = {
      cleared: false,
      success: undefined as PositionCallback | undefined,
    };
    const position = {
      coords: {
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 32.5364,
        longitude: -86.6445,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } satisfies GeolocationPosition;

    const start = (success: PositionCallback) => {
      state.cleared = false;
      state.success = success;
      (window as any).__geolocationRequested = true;
    };

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        clearWatch: () => {
          state.cleared = true;
        },
        getCurrentPosition: start,
        watchPosition: (success: PositionCallback) => {
          start(success);
          return 1;
        },
      },
    });

    (window as any).__releaseGeolocation = () => {
      if (!state.cleared) state.success?.(position);
    };
  });

  return {
    requested: () => page.waitForFunction(() => (window as any).__geolocationRequested === true),
    release: () => page.evaluate(() => (window as any).__releaseGeolocation()),
  };
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

test("initial camera, Deck ordering, and county-click fly-to survive the upstream migration", async ({
  page,
}) => {
  await page.goto("/?from=2003&to=2011&geoid=00000");

  const map = page.getByRole("region", { name: "Map" }).locator("figure");
  await expect(map).toHaveAttribute("data-map-capture-state", "ready", { timeout: 30_000 });
  await expect(map).toHaveAttribute("data-deck-before-waterway", "true");

  const initialCamera = await map.evaluate((element) => ({
    longitude: Number(element.getAttribute("data-map-center-longitude")),
    latitude: Number(element.getAttribute("data-map-center-latitude")),
    zoom: Number(element.getAttribute("data-map-zoom")),
  }));
  expect(initialCamera.longitude).toBeCloseTo(-98.5795, 1);
  expect(initialCamera.latitude).toBeCloseTo(39.8283, 1);
  expect(initialCamera.zoom).toBeCloseTo(3.5, 1);

  const canvas = map.locator("canvas.maplibregl-canvas");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Map canvas was not measurable");

  await canvas.click({
    position: {
      x: canvasBox.width / 2,
      y: canvasBox.height / 2,
    },
  });

  await expect
    .poll(() => {
      const selectedGeoid = new URL(page.url()).searchParams.get("geoid");
      return selectedGeoid !== "00000" && /^\d{5}$/.test(selectedGeoid ?? "");
    })
    .toBe(true);
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-center-longitude")))
    .not.toBeCloseTo(initialCamera.longitude, 1);
  await expect.poll(async () => Number(await map.getAttribute("data-map-zoom"))).toBeGreaterThan(7);
});

test("PDF export waits for all three maps and captures their rendered canvases", async ({
  page,
}) => {
  await page.goto("/PDF?from=2004&to=2012&geoid=01001", {
    waitUntil: "domcontentloaded",
  });

  const exportButton = page.getByRole("button", { name: /Preparing maps|Save as PDF/ });
  await expect(exportButton).toBeDisabled();
  await expect(page.locator('[data-map-capture-state="ready"]')).toHaveCount(3, {
    timeout: 45_000,
  });
  await expect(exportButton).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Autauga County, AL_2004-2012\.pdf$/);

  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Playwright did not persist the PDF download");
  const pdf = await readFile(downloadPath);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(50_000);
  expect(pdf.toString("latin1")).toContain("/Subtype /Image");
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

test("a county search cancels geolocation before the browser emits a position", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["geolocation"], { origin: appOrigin });
  const browserGeolocation = await delayBrowserGeolocation(page);
  await page.route("https://nominatim.openstreetmap.org/reverse?*", (route) =>
    fulfillJson(route, autaugaReverseResponse)
  );
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
  await browserGeolocation.requested();

  const search = page.getByRole("combobox", { name: "Search for a county" });
  await search.fill("Baldwin");
  await page.getByText("Baldwin County, Alabama", { exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("geoid")).toBe("01003");

  await browserGeolocation.release();
  await page.waitForTimeout(750);

  expect(new URL(page.url()).searchParams.get("geoid")).toBe("01003");
  await expect(page.getByRole("region", { name: "Line chart" }).locator("h1")).toContainText(
    "Baldwin County, Alabama"
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
