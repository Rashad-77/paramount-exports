import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

// With TEST_ADMIN_DATABASE_URL set, the server runs against a disposable database (see scripts/prepare-e2e-db.ts) and
// local-disk uploads, so the enquiry pipeline can be tested end to end. Without it, only database-free tests run.
const admin = process.env.TEST_ADMIN_DATABASE_URL;
const dbUrl = admin ? (() => { const u = new URL(admin); u.pathname = "/e2e_furniture"; return u.toString(); })() : undefined;

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
    // Deliberately no Supabase variables: sign-in must fail safe when auth is not configured.
    env: {
      NODE_ENV: "production",
      ...(dbUrl
        ? { DATABASE_URL: dbUrl, STORAGE_DRIVER: "local", ALLOW_LOCAL_STORAGE: "e2e-only", LOCAL_STORAGE_DIR: ".e2e-storage", IP_HASH_SALT: "e2e-salt-e2e-salt-e2e-salt-12345", CRON_SECRET: "e2e-cron-secret-e2e-cron-secret" }
        : {}),
    },
  },
});
