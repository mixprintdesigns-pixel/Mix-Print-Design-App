import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://mixprint:mixprint_dev@127.0.0.1:5432/mixprint_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Migrated, seeded database (non-destructive) and a production build, so tests match what customers get.
    command: `npx prisma migrate deploy && npx prisma db seed && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: E2E_DATABASE_URL, APP_URL: `http://localhost:${PORT}` },
  },
});
