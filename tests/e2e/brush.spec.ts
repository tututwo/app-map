// Regression tests for direct brush gestures with REAL pointer input.
// The label-drag tests in dashboard.spec.ts dispatch synthetic MouseEvents,
// which masked two real-input bugs: (1) the yearRange sync $effect reactively
// depended on yearRangeSelection and snapped the selection back to the URL
// range on every drag frame; (2) the line path / data circles / grid layers
// render above the brush group and swallowed mousedowns. Geometry comes from
// the .selection rect — the overlay is 1x1px by design (drawing a brand-new
// selection is intentionally disabled).
import { expect, test, type Page } from "@playwright/test";

async function selectionBox(page: Page) {
  const selection = page.locator(".brush-group .selection");
  await expect(selection).toBeVisible();
  const box = await selection.boundingBox();
  if (!box) throw new Error("Brush selection was not measurable");
  return box;
}

test("dragging the selection rect moves the year window", async ({ page }) => {
  await page.goto("/?from=2003&to=2011");
  const box = await selectionBox(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.width / 4, y, { steps: 12 });
  await page.mouse.up();

  await expect(page).not.toHaveURL(/from=2003&to=2011/, { timeout: 10_000 });
});

test("dragging the east handle resizes the year window", async ({ page }) => {
  await page.goto("/?from=2003&to=2011");
  const handle = page.locator(".brush-group .handle--e");
  const box = await handle.boundingBox();
  if (!box) throw new Error("East handle was not measurable");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y, { steps: 12 });
  await page.mouse.up();

  await expect(page).not.toHaveURL(/from=2003&to=2011/, { timeout: 10_000 });
});
