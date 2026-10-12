import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Smoke tests run against the PRODUCTION build (`pnpm build` first), so they exercise what Vercel will run.
 * In sandboxes where Playwright's browser download is blocked, set CHROMIUM_PATH to an installed Chromium.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Deliberately no DB / Supabase variables: the public site and guards must work (and fail safe) without them.
    env: { NODE_ENV: "production" },
  },
});
