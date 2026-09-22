import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const deployedURL = process.env.PLAYWRIGHT_BASE_URL;
const worker = process.env.PLAYWRIGHT_WORKER === "1";

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/unit/**"],
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: deployedURL ?? `http://127.0.0.1:${port}`,
  },
  webServer: deployedURL
    ? undefined
    : {
        command: worker
          ? `npm run preview:worker -- --ip 127.0.0.1 --port ${port}`
          : `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
        env: worker ? undefined : { PUBLIC_TILES_URL: "/tiles" },
        port,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
