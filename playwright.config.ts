import { defineConfig, devices } from "@playwright/test";
import { CLOCK_FILE } from "./tests/e2e/clock-path";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  // One worker: tests share one server and the fake clock file.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // Sandboxes that ship their own Chromium can point at it instead of downloading one.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    // CI builds first; locally `npm run test:e2e` builds then serves.
    command: process.env.CI ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // Fresh in-memory Postgres per run, no API keys, and a controllable clock.
      PGLITE_DIR: "memory://",
      DATABASE_URL: "",
      NEXT_PUBLIC_SPOTIFY_CLIENT_ID: "",
      SPOTIFY_CLIENT_SECRET: "",
      RESEND_API_KEY: "",
      E2E_CLOCK_FILE: CLOCK_FILE,
      RATE_LIMITS: "off",
    },
  },
});
