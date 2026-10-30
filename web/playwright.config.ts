import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // The dev server compiles routes on first hit; more than two workers starves it. Production runs use the default.
  // A deployed site shares one free-tier backend; parallel demo logins beyond two time out.
  workers: process.env.PW_PROD && !process.env.PW_BASE_URL ? undefined : 2,
  retries: process.env.CI ? 2 : 0,
  // Multi-login flows against a dev server that compiles routes on first hit; defaults (30s / 5s) are too tight.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // PW_BASE_URL=https://… runs the suite against a deployed site (no local server).
  use: { baseURL: process.env.PW_BASE_URL ?? "http://localhost:3100", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // PW_PROD=1 runs the suite against a production build (npm run test:e2e:prod).
  webServer: process.env.PW_BASE_URL
    ? undefined
    : process.env.PW_PROD
    ? { command: "npm run build && npm run start", url: "http://localhost:3100", reuseExistingServer: false, timeout: 300_000 }
    : { command: "npm run dev", url: "http://localhost:3100", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
