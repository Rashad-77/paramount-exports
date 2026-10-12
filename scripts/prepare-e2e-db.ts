/* eslint-disable no-console */
/**
 * Prepare the throwaway database used by the Playwright suite. No-op unless TEST_ADMIN_DATABASE_URL is set.
 * Creates `e2e_furniture`, stubs Supabase's auth schema/roles, applies all migrations and inserts a small FIXTURE
 * (one category, one published product) that exists only in this disposable database.
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const admin = process.env.TEST_ADMIN_DATABASE_URL;
export const E2E_DB = "e2e_furniture";

export function e2eDatabaseUrl(adminUrl: string): string {
  const u = new URL(adminUrl);
  u.pathname = `/${E2E_DB}`;
  return u.toString();
}

async function main() {
  if (!admin) {
    console.log("TEST_ADMIN_DATABASE_URL not set: skipping e2e database preparation (database-backed e2e tests will be skipped).");
    return;
  }
  const root = postgres(admin, { max: 1, onnotice: () => {} });
  await root.unsafe(`DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)`);
  await root.unsafe(`CREATE DATABASE ${E2E_DB}`);
  await root.end();

  const sql = postgres(e2eDatabaseUrl(admin), { max: 1, onnotice: () => {} });
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;`);
  await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const [cat] = await sql`INSERT INTO product_categories (name, slug) VALUES ('Dining Tables', 'dining-tables') RETURNING id`;
  const [prod] = await sql`
    INSERT INTO products (slug, name, category_id, kind, material, finish, dimensions, description, is_published, is_featured)
    VALUES ('sample-oak-table', 'Sample Oak Table', ${cat!.id}, 'stocked', 'Oak', 'Natural oil', 'W 180 x D 90 x H 75 cm', 'Fixture product used by the automated tests.', true, true)
    RETURNING id`;
  await sql`INSERT INTO product_variants (product_id, sku, label) VALUES (${prod!.id}, 'E2E-OAK-1', 'Standard')`;
  await sql.end();
  console.log(`Prepared ${E2E_DB}`);
}

if (process.argv[1]?.endsWith("prepare-e2e-db.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
