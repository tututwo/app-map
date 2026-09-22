import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

// A blank basemap isolates the real census archive and metrics from third-party tile services.
const basemap = {
  version: 8,
  sources: { water: { type: "geojson", data: { type: "FeatureCollection", features: [] } } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#ffffff" } },
    { id: "waterway", type: "line", source: "water", paint: { "line-color": "#ffffff" } },
  ],
};

async function hoverMap(page: Page, horizontal = 0.5) {
  const canvas = page.locator("canvas.maplibregl-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Map canvas was not measurable");
  // Moving off first refreshes a tooltip whose counts may have arrived while the pointer was still.
  await page.mouse.move(box.x + 1, box.y + 1);
  await canvas.hover({ position: { x: box.width * horizontal, y: box.height / 2 } });
  return (await page.getByRole("tooltip").allTextContents()).join(" ");
}

async function tenClassLegend(page: Page) {
  const legend = page.getByRole("group", { name: "Map legend" });
  const swatches = legend.locator('[style*="background"]');
  await expect(swatches).toHaveCount(11);
  const colors = await swatches.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).backgroundColor)
  );
  expect(new Set(colors.slice(0, 10)).size).toBe(10);
  for (const color of colors.slice(0, 10)) {
    const [red, green, blue] = color.match(/\d+/g)!.map(Number);
    expect(blue).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(red);
  }
  expect(colors[10]).toBe("rgb(217, 221, 226)");
  await expect(legend.getByText("No data", { exact: true })).toBeVisible();
  return colors;
}

async function publishedCount(
  geoid: string,
  type: string,
  from: number,
  to: number,
  level = "tract"
) {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../src/lib/generated/metrics-manifest.json", import.meta.url),
      "utf8"
    )
  );
  const directory = new URL(
    `../../static/tiles/metrics/${level}/${manifest.levels[level].release}/${geoid.slice(0, 2)}/`,
    import.meta.url
  );
  const geoids: string[] = JSON.parse(
    gunzipSync(await readFile(new URL("geoids.json.gz", directory))).toString()
  );
  const counts = gunzipSync(await readFile(new URL(`${type}.bin.gz`, directory)));
  const row = geoids.indexOf(geoid);
  const window = manifest.windows.findIndex(
    ([start, end]: number[]) => start === from && end === to
  );
  expect(row).toBeGreaterThanOrEqual(0);
  expect(window).toBeGreaterThanOrEqual(0);
  const offset = row * manifest.windows.length + window;
  const value =
    manifest.levels[level].dtype === "u8" ? counts[offset] : counts.readUInt16LE(offset * 2);
  return value === (manifest.levels[level].dtype === "u8" ? 255 : 65535) ? "—" : String(value);
}

for (const { level, digits, labels } of [
  {
    level: "tract",
    digits: 11,
    labels: ["0", "1", "2", "3", "4–5", "6–7", "8–11", "12–19", "20–29", "30+"],
  },
  {
    level: "zcta",
    digits: 5,
    labels: ["0", "1", "2", "3–4", "5–7", "8–11", "12–19", "20–49", "50–99", "100+"],
  },
  {
    level: "blockgroup",
    digits: 12,
    labels: ["0", "1", "2", "3", "4–5", "6–7", "8–11", "12–15", "16–19", "20+"],
  },
])
  test(`${level} polygons, counts and fixed legend work at the national camera`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/maps/yale-light.json", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(basemap) })
    );
    const mapRequests: string[] = [];
    const fullMatrixRequests: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.includes(`/map/${level}/`)) mapRequests.push(path);
      if (path.includes(`/metrics/${level}/`) && path.endsWith(".bin.gz"))
        fullMatrixRequests.push(path);
    });
    await page.goto(`/explore?level=${level}&from=2000&to=2025&type=all_religions`);
    await expect(page.locator('[data-state-map="ready"]')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Showing states\./)).toBeHidden();
    await expect(page.getByRole("heading", { name: "United States", exact: true })).toBeVisible();
    const legend = page.getByRole("group", { name: "Map legend" });
    await tenClassLegend(page);
    await page.getByRole("button", { name: "Color key" }).click();
    const guide = page.getByRole("region", { name: "Map color guide" });
    await expect(
      guide.getByRole("list", { name: "Color intervals" }).getByRole("listitem")
    ).toHaveText(labels);
    await expect(guide).toContainText(
      "These ranges stay the same across all time windows and types."
    );
    await page.getByRole("button", { name: "Color key" }).click();

    // Distant fine-level polygons prove this is a national view, not a state proxy.
    const geoids: string[] = [];
    const geoidPattern = new RegExp(`GEOID (\\d{${digits}}) ·`);
    for (const horizontal of [0.3, 0.7, 0.5]) {
      let text = "";
      await expect
        .poll(async () => (text = await hoverMap(page, horizontal)), { timeout: 30_000 })
        .toMatch(geoidPattern);
      geoids.push(text.match(geoidPattern)![1]);
    }
    expect(new Set(geoids.map((geoid) => geoid.slice(0, 2))).size).toBe(3);
    const geoid = geoids[2];
    const allCount = await publishedCount(geoid, "all_religions", 2000, 2025, level);
    await expect.poll(() => hoverMap(page)).toContain(`Reported closures: ${allCount}`);
    expect(mapRequests).toHaveLength(2);
    await page.locator("canvas.maplibregl-canvas").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("where")).toBe(geoid);
    await expect(page.locator("aside")).toContainText(
      new RegExp(`${allCount} closures? of places of worship`)
    );
    // Picking a polygon keeps the user's national camera.
    await expect.poll(() => hoverMap(page, 0.3)).toContain(`GEOID ${geoids[0]}`);

    for (const [field, value, type, from] of [
      ["from", "2010", "all_religions", 2010],
      ["type", "christian_church", "christian_church", 2010],
    ] as const) {
      await page.locator(`select[name="${field}"]`).selectOption(value);
      await expect.poll(() => new URL(page.url()).searchParams.get(field)).toBe(value);
      const count = await publishedCount(geoid, type, from, 2025, level);
      await expect.poll(() => hoverMap(page)).toContain(`Reported closures: ${count}`);
      await expect(
        legend.getByTitle(`${labels[3]} reported closures`, { exact: true })
      ).toBeVisible();
      await expect(page.locator("aside")).toContainText(new RegExp(`${count} closures? of`));
    }
    expect(fullMatrixRequests).toEqual([]);
  });

test("a delayed tract window cannot repaint the next window", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/maps/yale-light.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(basemap) })
  );
  const manifest = JSON.parse(
    await readFile(
      new URL("../../src/lib/generated/metrics-manifest.json", import.meta.url),
      "utf8"
    )
  );
  const oldWindow = manifest.windows.findIndex(
    ([from, to]: number[]) => from === 2000 && to === 2025
  );
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const oldRequest = page.waitForRequest(`**/map/tract/*/all_religions/${oldWindow}.bin.gz`);
  await page.route(`**/map/tract/*/all_religions/${oldWindow}.bin.gz`, async (route) => {
    await delayed;
    await route.continue();
  });
  await page.goto("/explore?level=tract&from=2000&to=2025&type=all_religions");
  const request = await oldRequest;
  await page.locator('select[name="from"]').selectOption("2010");
  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe("2010");
  const geoid = "20003953700";
  const expected = await publishedCount(geoid, "all_religions", 2010, 2025);
  expect(expected).not.toBe(await publishedCount(geoid, "all_religions", 2000, 2025));
  await expect.poll(() => hoverMap(page)).toContain(`Reported closures: ${expected}`);
  release();
  await (await request.response())?.finished();
  // Let the old response inflate and reach its completion callback before checking the winner.
  await page.waitForTimeout(300);
  await expect.poll(() => hoverMap(page)).toContain(`GEOID ${geoid}`);
  await expect(page.getByRole("tooltip")).toContainText(`Reported closures: ${expected}`);
});

test("switching fine levels during loading leaves the replacement source correct", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/maps/yale-light.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(basemap) })
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const slice = page.waitForResponse(/\/map\/blockgroup\/[^/]+\/all_religions\/\d+\.bin\.gz$/);
  await page.goto("/explore?level=blockgroup&from=2000&to=2025&type=all_religions");
  await (await slice).finished();
  const zctaSlice = page.waitForResponse(/\/map\/zcta\/[^/]+\/all_religions\/\d+\.bin\.gz$/);
  await page.getByRole("button", { name: "ZCTA", exact: true }).click();
  await (await zctaSlice).finished();
  // Change back while the new source's batches can still be painting.
  for (const [label, level, digits] of [
    ["Block group", "blockgroup", 12],
    ["ZCTA", "zcta", 5],
    ["Tract", "tract", 11],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    let text = "";
    const pattern = new RegExp(`GEOID (\\d{${digits}}) ·`);
    await expect.poll(async () => (text = await hoverMap(page))).toMatch(pattern);
    const geoid = text.match(pattern)![1];
    const count = await publishedCount(geoid, "all_religions", 2000, 2025, level);
    await expect.poll(() => hoverMap(page)).toContain(`Reported closures: ${count}`);
  }
  await page.getByRole("button", { name: "County", exact: true }).click();
  await expect.poll(() => hoverMap(page)).toContain("GEOID 20003 ·");
  await expect(page.getByRole("tooltip")).toContainText("Reported closures: 31");
  await page.getByRole("button", { name: "Tract", exact: true }).click();
  await expect.poll(() => hoverMap(page)).toContain("GEOID 20003953700 ·");
  await expect.poll(() => hoverMap(page)).toContain("Reported closures: 11");
  expect(errors).toEqual([]);
});

test("ten-class legends fit mobile and print, and postal search selects a ZCTA", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/explore?level=state&from=2000&to=2025&type=all_religions");
  for (const label of ["State", "County"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await tenClassLegend(page);
    await expect.poll(() => hoverMap(page)).toMatch(/Reported closures: [\d,]+/);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath(`legend-${label.toLowerCase()}.png`) });
  }
  await page.setViewportSize({ width: 360, height: 844 });
  await page.getByRole("button", { name: "ZCTA", exact: true }).click();
  await tenClassLegend(page);
  const legend = page.getByRole("group", { name: "Map legend" });
  const bounds = await legend.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  expect(await legend.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const colorKey = page.getByRole("button", { name: "Color key" });
  await colorKey.focus();
  const closedKey = await colorKey.boundingBox();
  await page.keyboard.press("Enter");
  await expect(colorKey).toHaveAttribute("aria-expanded", "true");
  expect(Math.abs((await colorKey.boundingBox())!.y - closedKey!.y)).toBeLessThanOrEqual(1);
  const guide = page.getByRole("region", { name: "Map color guide" });
  await expect(
    guide.getByRole("list", { name: "Color intervals" }).getByRole("listitem")
  ).toHaveCount(10);
  await page.keyboard.press("Tab");
  await expect(guide).toBeFocused();
  expect(await guide.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
  await expect(colorKey).toBeFocused();
  await expect(colorKey).toHaveAttribute("aria-expanded", "false");
  await tenClassLegend(page);
  await page.getByRole("combobox", { name: "Find a place" }).fill("06511");
  await page.getByRole("option", { name: /ZCTA 06511/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("where")).toBe("06511");
  await expect(page.getByRole("heading", { name: "ZCTA 06511", exact: true })).toBeVisible();
  await expect(page.locator("figure[aria-busy='false']")).toBeVisible({ timeout: 45_000 });
  await legend.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("legend-mobile-zcta.png") });
  const summaryURL = await page
    .getByRole("link", { name: "View one-page summary →" })
    .getAttribute("href");
  expect(summaryURL).toBeTruthy();
  await page.setViewportSize({ width: 816, height: 1056 });
  await page.goto(summaryURL!);
  // Framing the selected ZCTA reads its geometry before the final static map is captured.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /ZCTA 06511/ })).toBeVisible();
  await tenClassLegend(page);
  await expect
    .poll(() => page.locator("[data-print-copy]").getAttribute("src"), { timeout: 45_000 })
    .toMatch(/^data:image\/png;base64,.{1000}/);
  // Give the final selected-camera WebGL render time to replace the initial print copy.
  await page.waitForTimeout(5_000);
  await page.emulateMedia({ media: "print" });
  expect(await legend.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(816);
  await page.screenshot({ path: testInfo.outputPath("legend-summary-print.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("a palette changes colors without reloading counts and survives navigation", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/maps/yale-light.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(basemap) })
  );
  const metricRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/tiles\/(map|metrics)\//.test(new URL(request.url()).pathname))
      metricRequests.push(request.url());
  });
  await page.goto("/explore?level=tract&from=2000&to=2025&type=all_religions");
  let tooltip = "";
  await expect.poll(async () => (tooltip = await hoverMap(page))).toMatch(/GEOID (\d{11}) ·/);
  const geoid = tooltip.match(/GEOID (\d{11}) ·/)![1];
  const count = await publishedCount(geoid, "all_religions", 2000, 2025);
  await expect.poll(() => hoverMap(page)).toContain(`Reported closures: ${count}`);
  await page.locator("canvas.maplibregl-canvas").click();
  await expect(page.locator("aside")).toContainText(
    new RegExp(`${count} closures? of places of worship`)
  );
  await page.waitForLoadState("networkidle");
  const beforeQuery = Object.fromEntries(new URL(page.url()).searchParams);
  const beforeRequests = metricRequests.length;
  await page.mouse.move(0, 0);
  const canvas = page.locator("canvas.maplibregl-canvas");
  const mapBox = (await canvas.boundingBox())!;
  // This interior crop excludes the overlaid legend, controls and attribution.
  const mapClip = {
    x: mapBox.x + mapBox.width * 0.1,
    y: mapBox.y + mapBox.height * 0.2,
    width: mapBox.width * 0.8,
    height: mapBox.height * 0.5,
  };
  const beforeMap = await page.screenshot({
    clip: mapClip,
    path: testInfo.outputPath("palette-yale-map.png"),
  });
  const palette = page.getByRole("combobox", { name: "Color palette" });
  await palette.selectOption("YlGnBu");
  await expect.poll(() => new URL(page.url()).searchParams.get("palette")).toBe("YlGnBu");
  const afterQuery = new URL(page.url()).searchParams;
  afterQuery.delete("palette");
  expect(Object.fromEntries(afterQuery)).toEqual(beforeQuery);

  // Independent ColorBrewer YlGnBu expectations, resampled to ten classes, plus missing data.
  const expectedColors = [
    "#ffffd9",
    "#edf8ba",
    "#cdebb4",
    "#97d7b9",
    "#5dc0c0",
    "#32a5c2",
    "#217fb7",
    "#2255a4",
    "#1e3489",
    "#081d58",
    "#d9dde2",
  ].map(
    (hex) =>
      `rgb(${[1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(", ")})`
  );
  const legend = page.getByRole("group", { name: "Map legend" });
  const expectPalette = () =>
    expect
      .poll(() =>
        legend
          .locator('[style*="background"]')
          .evaluateAll((elements) =>
            elements.map((element) => getComputedStyle(element).backgroundColor)
          )
      )
      .toEqual(expectedColors);
  await expectPalette();
  await expect.poll(() => hoverMap(page)).toContain(`Reported closures: ${count}`);
  await page.waitForLoadState("networkidle");
  expect(metricRequests).toHaveLength(beforeRequests);
  await page.mouse.move(0, 0);
  // A legend-only recolor cannot change the map interior.
  await expect
    .poll(async () => !(await page.screenshot({ clip: mapClip })).equals(beforeMap))
    .toBe(true);
  await page.screenshot({ clip: mapClip, path: testInfo.outputPath("palette-ylgnbu-map.png") });
  for (const control of [
    legend,
    palette,
    page.getByRole("button", { name: "Color key" }),
    page.getByRole("button", { name: "Tract", exact: true }),
  ])
    expect(await control.evaluate((element) => getComputedStyle(element).borderRadius)).toBe("0px");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath("palette-ylgnbu.png") });

  await page.locator('select[name="from"]').selectOption("2010");
  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe("2010");
  expect(new URL(page.url()).searchParams.get("palette")).toBe("YlGnBu");
  await expectPalette();
  await page.getByRole("button", { name: "County", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("level")).toBe("county");
  expect(new URL(page.url()).searchParams.get("palette")).toBe("YlGnBu");
  await expectPalette();
  const summaryURL = await page
    .getByRole("link", { name: "View one-page summary →" })
    .getAttribute("href");
  expect(new URL(summaryURL!, page.url()).searchParams.get("palette")).toBe("YlGnBu");
  await page.goto(summaryURL!);
  await expectPalette();
});
