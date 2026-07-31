import { expect, test } from "@playwright/test";

test("visitor is asked for an access code before the dashboard is shown", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/access\?next=%2F$/);
  await expect(page.getByRole("heading", { name: "Interview access" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /closed churches/i })).toHaveCount(0);
});

test("the unauthenticated redirect cannot be cached", async ({ request }) => {
  const response = await request.get("/PDF?from=2003&to=2011", { maxRedirects: 0 });

  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toContain("/access?next=");
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("incorrect code shows a generic error and creates no session", async ({ page, context }) => {
  const submittedCode = "definitely-wrong";
  await page.goto("/");
  await page.getByLabel("Access code").fill(submittedCode);
  await page.getByRole("button", { name: "Continue" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("That access code wasn’t accepted. Please try again.");
  await expect(alert).not.toContainText(submittedCode);
  expect(await context.cookies()).toEqual([]);
});

test("correct code creates a secure session that survives refresh", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("Access code").fill("test-only-access-code");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /closed churches/i }).first()).toBeVisible();

  const [session] = await context.cookies();
  expect(session).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
  });
  expect(session.expires).toBeGreaterThan(Date.now() / 1000);

  await page.reload();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /closed churches/i }).first()).toBeVisible();
});

test("direct protected route returns to the full path after login", async ({ page }) => {
  const target = "/PDF?from=2003&to=2011&geoid=00000";
  await page.goto(target);

  await expect(page).toHaveURL(/\/access\?next=/);
  await page.getByLabel("Access code").fill("test-only-access-code");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(target);
  await expect(page.getByRole("button", { name: "Save as PDF" })).toBeVisible();
});

test("all dashboard data endpoints reject unauthenticated requests", async ({ request }) => {
  const endpoints = [
    "/api/map_data?from=2003&to=2011",
    "/api/line_chart_data?geoid=00000",
    "/api/stacked_bar_chart_data?geoid=00000",
    "/api/side_metric_data?geoid=00000",
    "/api/download_data?from=2003&to=2011&geoid=00000",
  ];

  for (const endpoint of endpoints) {
    const response = await request.get(endpoint);
    expect(response.status(), endpoint).toBe(401);
    expect(response.headers()["cache-control"], endpoint).toContain("no-store");
    expect(await response.json(), endpoint).toEqual({ message: "Authentication required" });
  }
});

test("authenticated dashboard metrics are served through the protected API", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Access code").fill("test-only-access-code");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  const response = await page.request.get("/api/side_metric_data?geoid=00000");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ geoid: "00000" });
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("a tampered session cookie cannot bypass the gate", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("Access code").fill("test-only-access-code");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  const [session] = await context.cookies();
  const replacement = session.value.endsWith("A") ? "B" : "A";
  await context.addCookies([{ ...session, value: `${session.value.slice(0, -1)}${replacement}` }]);

  await page.goto("/PDF?from=2003&to=2011&geoid=00000");
  await expect(page).toHaveURL(/\/access\?next=/);
});

test("logout clears access to pages and data endpoints", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("Access code").fill("test-only-access-code");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/access$/);
  expect(await context.cookies()).toEqual([]);

  await page.goto("/PDF?from=2003&to=2011&geoid=00000");
  await expect(page).toHaveURL(/\/access\?next=/);
  expect((await page.request.get("/api/line_chart_data?geoid=00000")).status()).toBe(401);
});
