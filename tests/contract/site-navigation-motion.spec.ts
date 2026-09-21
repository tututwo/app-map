import { expect, test } from "@playwright/test";

test("planned navigation stays reachable on mobile and unknown pages stay 404", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link")).toHaveText([
    "Explore",
    "Stories",
    "Health Impacts",
    "Download Data",
    "About",
  ]);
  for (const title of ["Health Impacts", "Download Data", "About"]) {
    await nav.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Coming soon.", { exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: title, exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
  }
  for (const title of ["Methodology", "Contact"]) {
    await page
      .getByRole("navigation", { name: "Project information" })
      .getByRole("link", { name: title })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Substack", exact: true })).toHaveAttribute(
    "href",
    "https://substack.com"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await nav.getByRole("link", { name: "Stories", exact: true }).click();
  await expect(page).toHaveURL(/\/#stories$/);
  await expect(page.getByRole("heading", { name: "Stories", exact: true })).toBeInViewport();
  for (const path of ["/not-a-page", "/constructor"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test("press feedback responds immediately and reduced motion keeps content and controls usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const explore = page.getByRole("button", { name: "Explore", exact: true });
  await explore.hover();
  await page.mouse.down();
  await expect
    .poll(() => explore.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe("none");
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await explore.hover();
  await page.mouse.down();
  await expect(explore).toHaveCSS("transform", "none");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page
    .getByRole("heading", { name: "From our research", exact: true })
    .scrollIntoViewIfNeeded();
  const moving = await page.evaluate(() =>
    document
      .getAnimations()
      .some(
        (animation) =>
          animation.effect instanceof KeyframeEffect &&
          animation.effect
            .getKeyframes()
            .some((frame) => frame.transform && frame.transform !== "none")
      )
  );
  expect(moving).toBe(false);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "About", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("transform", "none");
});

test("Explore motion tolerates repeated opening and preserves selected numbers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/explore?where=CT&from=2010&to=2015&type=all");
  const search = page.getByRole("combobox", { name: "Find a place" });
  await search.fill("Texas");
  await expect(page.getByRole("option", { name: /^Texas State/ })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await search.press("Escape");
    await search.press("ArrowDown");
    await expect(page.getByRole("listbox", { name: "Places" })).toHaveCount(1);
  }
  await page.getByRole("option", { name: /^Texas State/ }).click();
  await expect(page.getByRole("heading", { name: "Texas", exact: true })).toBeVisible();
  await expect(page.locator("aside").getByText("4,851", { exact: true })).toBeVisible();

  const guide = page.getByRole("button", { name: "How are colors chosen?" });
  for (let i = 0; i < 3; i++) {
    await guide.click();
    await expect(guide).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("region", { name: "Map color guide" }).focus();
    await page.keyboard.press("Escape");
    await expect(guide).toBeFocused();
    await expect(guide).toHaveAttribute("aria-expanded", "false");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await guide.click();
  await expect(page.getByRole("region", { name: "Map color guide" })).toHaveCSS(
    "transform",
    "none"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
