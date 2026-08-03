import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { readFile } from "node:fs/promises";

const appOrigin = "http://127.0.0.1:4173";

const autaugaReverseResponse = {
  display_name: "Autauga County, Alabama, United States",
  address: { county: "Autauga County", state: "Alabama" },
};

const capitolPlanningRegionSearchResponse = [
  {
    lat: "41.76",
    lon: "-72.68",
    display_name: "Capitol Planning Region, Connecticut, United States",
    address: { county: "Capitol Planning Region", state: "Connecticut" },
  },
];

const deterministicMapStyle = {
  version: 8,
  sources: {
    waterways: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#010203" } },
    {
      id: "waterway",
      type: "line",
      source: "waterways",
      paint: { "line-color": "#010203", "line-width": 1 },
    },
  ],
};

const pdfMapPalettes = [
  ["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"],
  ["#FAE2C9", "#E9C39B", "#D9A671", "#CB8944", "#B96308"],
  ["#F1E0FD", "#CCADE3", "#A272C5", "#7836A7", "#5C168E"],
] as const;

async function enableAutaugaGeolocation(context: BrowserContext) {
  await context.grantPermissions(["geolocation"], { origin: appOrigin });
  await context.setGeolocation({ latitude: 32.5364, longitude: -86.6445 });
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
}

async function useDeterministicMapStyle(page: Page) {
  await page.route("https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json", (route) =>
    fulfillJson(route, deterministicMapStyle)
  );
}

async function countCountyPalettePixels(canvas: Locator, palette: readonly string[]) {
  return canvas.evaluate(async (node, expectedHexColors) => {
    const source = node as HTMLCanvasElement;
    const expectedColors = expectedHexColors.map((hex) => [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ]);

    // This is the same preserved-canvas serialization seam used by the PDF capture library.
    const image = new Image();
    image.src = source.toDataURL("image/png");
    await image.decode();

    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not inspect the map canvas");

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let matchingPixels = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const matchesCountyPalette = expectedColors.some(
        ([red, green, blue]) =>
          Math.abs(pixels[index] - red) <= 4 &&
          Math.abs(pixels[index + 1] - green) <= 4 &&
          Math.abs(pixels[index + 2] - blue) <= 4 &&
          pixels[index + 3] >= 250
      );

      if (matchesCountyPalette) matchingPixels += 1;
    }

    return { matchingPixels, totalPixels: pixels.length / 4 };
  }, palette);
}

async function clickGeolocate(page: Page) {
  const geolocate = page.locator("button.maplibregl-ctrl-geolocate");
  await expect(geolocate).toBeEnabled();
  await geolocate.click();
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
  await useDeterministicMapStyle(page);
  await page.goto("/?from=2003&to=2011&geoid=00000");

  const map = page.getByRole("region", { name: "Map" }).locator("figure");
  await expect(map).toHaveAttribute("data-map-capture-state", "ready", { timeout: 30_000 });

  const layerIndices = await map.evaluate((element) => ({
    deck: Number(element.getAttribute("data-deck-layer-index")),
    waterway: Number(element.getAttribute("data-waterway-layer-index")),
  }));
  expect(layerIndices.deck).toBeGreaterThanOrEqual(0);
  expect(layerIndices.waterway).toBeGreaterThan(layerIndices.deck);
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

test("a selected GEOID without a county camera resets to the US camera", async ({ page }) => {
  await useDeterministicMapStyle(page);
  await page.route("https://nominatim.openstreetmap.org/search?*", (route) =>
    fulfillJson(route, capitolPlanningRegionSearchResponse)
  );
  await page.goto("/?from=2003&to=2011&geoid=01001");

  const map = page.getByRole("region", { name: "Map" }).locator("figure");
  await expect(map).toHaveAttribute("data-map-capture-state", "ready", { timeout: 30_000 });
  await expect.poll(async () => Number(await map.getAttribute("data-map-zoom"))).toBeGreaterThan(7);
  const countyRevision = Number(await map.getAttribute("data-map-capture-revision"));

  const search = page.getByRole("combobox", { name: "Search for a county" });
  await search.fill("Capitol");
  await page.getByText("Capitol Planning Region, CT", { exact: true }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get("geoid")).toBe("09110");
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-capture-revision")))
    .toBeGreaterThan(countyRevision);
  await expect(map).toHaveAttribute("data-map-capture-state", "ready", { timeout: 30_000 });
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-center-longitude")))
    .toBeCloseTo(-98.5795, 1);
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-center-latitude")))
    .toBeCloseTo(39.8283, 1);
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-zoom")))
    .toBeCloseTo(3.5, 1);
});

test("a fatal initial style failure publishes a map capture error", async ({ page }) => {
  await page.route("https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
  );
  await page.goto("/?from=2003&to=2011&geoid=00000");

  const map = page.getByRole("region", { name: "Map" }).locator("figure");
  await expect(map).toHaveAttribute("data-map-capture-state", "error", { timeout: 30_000 });
});

test("PDF export waits for all three maps and captures their rendered canvases", async ({
  page,
}) => {
  await useDeterministicMapStyle(page);
  await page.goto("/PDF?from=2004&to=2012&geoid=01001", {
    waitUntil: "domcontentloaded",
  });

  const exportButton = page.getByRole("button", { name: /Preparing maps|Save as PDF/ });
  await expect(exportButton).toBeDisabled();
  await expect(page.locator('[data-map-capture-state="ready"]')).toHaveCount(3, {
    timeout: 45_000,
  });
  await expect(exportButton).toBeEnabled();

  const canvases = page.locator(
    'main figure[data-map-capture-state="ready"] canvas.maplibregl-canvas'
  );
  await expect(canvases).toHaveCount(3);

  for (let index = 0; index < pdfMapPalettes.length; index += 1) {
    const pixels = await countCountyPalettePixels(canvases.nth(index), pdfMapPalettes[index]);
    const minimumCountyPixels = Math.max(100, Math.floor(pixels.totalPixels * 0.001));

    expect(
      pixels.matchingPixels,
      `PDF map ${index + 1} should contain rendered county-layer pixels`
    ).toBeGreaterThan(minimumCountyPixels);
  }

  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Autauga County, AL_2004-2012\.pdf$/);

  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Playwright did not persist the PDF download");
  const pdf = await readFile(downloadPath);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(50_000);
  expect(pdf.toString("latin1")).toMatch(/\/Subtype\s*\/Image\b/);
});

test("PDF map failures are surfaced with a reload path", async ({ page }) => {
  await useDeterministicMapStyle(page);
  await page.route("**/counties-10m.*.json", (route) => route.abort("failed"));
  await page.goto("/PDF?from=2004&to=2012&geoid=01001", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Map rendering failed:/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Maps unavailable" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reload report" })).toBeVisible();
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

// The stale-async-selection races ("a delayed reverse geocode cannot overwrite a later
// reset/search") moved to tests/unit/county-selection.svelte.test.ts — the latest-wins
// policy now lives in the CountySelection module, so unit races cover them exactly.
