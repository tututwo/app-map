import { expect, test, type Page } from "@playwright/test";

async function dragFromYear(page: Page, years: number) {
  const fromHandle = page.getByRole("button", { name: /^from 2003$/i });
  const toHandle = page.getByRole("button", { name: /^to 2011$/i });

  await expect(fromHandle).toBeVisible();
  const fromBox = await fromHandle.boundingBox();
  const toBox = await toHandle.boundingBox();
  if (!fromBox || !toBox) throw new Error("Year range handles were not measurable");

  const fromX = fromBox.x + fromBox.width / 2;
  const toX = toBox.x + toBox.width / 2;
  const pixelsPerYear = (toX - fromX) / 8;
  const y = fromBox.y + fromBox.height / 2;

  await fromHandle.dispatchEvent("mousedown", {
    button: 0,
    buttons: 1,
    clientX: fromX,
    clientY: y,
  });
  await page.evaluate(
    ({ clientX, clientY }) => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { button: 0, buttons: 1, clientX, clientY })
      );
      window.dispatchEvent(new MouseEvent("mouseup", { button: 0, clientX, clientY }));
    },
    { clientX: fromX + pixelsPerYear * years, clientY: y }
  );
}

test("dashboard and report data are present in server-rendered HTML", async ({ request }) => {
  const dashboard = await request.get("/?from=2004&to=2012&geoid=01001");
  expect(dashboard.ok()).toBe(true);
  const dashboardHtml = await dashboard.text();
  expect(dashboardHtml).toContain("Autauga County, AL");
  expect(dashboardHtml).toContain("From 2004 to 2012");

  const report = await request.get("/PDF?from=2004&to=2012&geoid=01001");
  expect(report.ok()).toBe(true);
  const reportHtml = await report.text();
  expect(reportHtml).toContain("Closed Churches in Autauga County, AL (2004-2012)");
});

test("concurrent brush and county changes converge on one complete URL", async ({ page }) => {
  let delayMapRequests = false;
  await page.route("**/api/map_data?*", async (route) => {
    if (delayMapRequests) await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue().catch(() => {});
  });
  await page.route("https://nominatim.openstreetmap.org/search?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          lat: "32.53",
          lon: "-86.64",
          display_name: "Autauga County, Alabama, United States",
          address: { county: "Autauga County", state: "Alabama" },
        },
      ]),
    });
  });

  await page.goto("/?from=2003&to=2011&geoid=00000");
  await expect(page.getByText("From 2003 to 2011", { exact: true })).toBeVisible();

  delayMapRequests = true;
  await dragFromYear(page, 2);

  const search = page.getByRole("combobox", { name: "Search for a county" });
  await search.fill("Autauga");
  await page.getByText("Autauga County, Alabama", { exact: true }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe("2005");
  await expect.poll(() => new URL(page.url()).searchParams.get("to")).toBe("2011");
  await expect.poll(() => new URL(page.url()).searchParams.get("geoid")).toBe("01001");
  await expect(page.getByText("From 2005 to 2011", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Autauga County, Alabama/ })).toBeVisible();
});

test("a failed navigation keeps last-good data and retry recovers", async ({ page }) => {
  let failNextMapRequest = false;
  await page.route("**/api/map_data?*", async (route) => {
    if (failNextMapRequest) {
      failNextMapRequest = false;
      await route.fulfill({ status: 503, body: "temporarily unavailable" });
      return;
    }
    await route.continue();
  });

  await page.goto("/?from=2003&to=2011&geoid=00000");
  await expect(page.getByText("From 2003 to 2011", { exact: true })).toBeVisible();

  failNextMapRequest = true;
  await dragFromYear(page, 2);

  await expect(page.getByText("Failed to load some data", { exact: true })).toBeVisible();
  await expect(page.getByText("From 2005 to 2011", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(page.getByText("Failed to load some data", { exact: true })).toBeHidden();
  await expect(page.getByText("From 2005 to 2011", { exact: true })).toBeVisible();
});
