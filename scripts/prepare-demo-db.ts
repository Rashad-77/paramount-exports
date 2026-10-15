/* eslint-disable no-console */
/**
 * Runs at the start of a Vercel build for a PUBLIC DEMO deployment only (DEMO_DEPLOYMENT=true, no Supabase; see
 * docs/DEMO_DEPLOYMENT.md). It prepares the demo's own database so nothing has to be run by hand:
 *   1. creates the small stand-in for Supabase's `auth` schema and roles that the migrations expect;
 *   2. applies the migrations (idempotent);
 *   3. loads the labelled sample data once (skips if it is already there).
 * Any other kind of build exits immediately without touching anything.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { demoDeploymentEnabled } from "../src/lib/auth/demo-deployment";

const STUB = `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $$;
`;

async function main() {
  if (process.env.DEMO_DEPLOYMENT !== "true") return; // ordinary build: nothing to do
  if (!demoDeploymentEnabled()) {
    console.error("DEMO_DEPLOYMENT=true but the demo cannot start: it needs DATABASE_URL and must NOT have any Supabase variables set. Remove the Supabase variables (or DEMO_DEPLOYMENT).");
    process.exit(1);
  }
  // Prefer a direct (non-pooled) connection for schema changes when the database provider gives one.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(STUB);
    await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("[demo] migrations applied");
  } finally {
    await sql.end({ timeout: 5 });
  }
  execFileSync("pnpm", ["db:seed"], { stdio: "inherit", env: { ...process.env, IP_HASH_SALT: process.env.IP_HASH_SALT ?? "demo-seed-salt-not-secret-1234" } });
}

main().catch((e) => {
  console.error("[demo] could not prepare the demo database:", e instanceof Error ? e.message : e);
  process.exit(1);
});
