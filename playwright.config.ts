import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    env: {
      DASHBOARD_ACCESS_PROTECTION: "true",
      DASHBOARD_ACCESS_CODE: "test-only-access-code",
      DASHBOARD_SESSION_SECRET: "test-only-session-secret-with-at-least-32-characters",
    },
    port: 4173,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
