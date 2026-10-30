import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // PW_PROD=1 runs the suite against a production build (npm run test:e2e:prod).
  webServer: process.env.PW_PROD
    ? { command: "npm run build && npm run start", url: "http://localhost:3100", reuseExistingServer: false, timeout: 300_000 }
    : { command: "npm run dev", url: "http://localhost:3100", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
