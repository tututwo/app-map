import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const deployedURL = process.env.PLAYWRIGHT_BASE_URL;

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
        command: `npm run preview:worker -- --ip 127.0.0.1 --port ${port}`,
        port,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
