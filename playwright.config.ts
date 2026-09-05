import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
