import { expect, test } from "@playwright/test";

const expectedCacheControl = "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400";

for (const path of [
  "/api/map_data?from=2003&to=2011",
  "/api/line_chart_data?geoid=00000",
  "/api/stacked_bar_chart_data?geoid=00000",
]) {
  test(`${path} exposes the immutable deployment cache contract`, async ({ request }) => {
    const response = await request.get(path);

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe(expectedCacheControl);
  });
}
