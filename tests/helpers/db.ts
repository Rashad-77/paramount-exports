import path from "node:path";
import { randomBytes } from "node:crypto";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

/**
 * Integration tests run against a REAL Postgres (needed for locking/concurrency tests).
 * Set TEST_ADMIN_DATABASE_URL to a superuser connection, e.g.
 *   postgres://postgres@127.0.0.1:5432/postgres
 * Each test file gets its own freshly created database, migrated from scratch.
 */

export const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
export const hasTestDb = Boolean(ADMIN_URL);

export interface TestDb {
  name: string;
  url: string;
  sql: postgres.Sql;
  db: PostgresJsDatabase<typeof schema>;
  /** Connection URL for a given role (roles created by the stub use trust/no password in tests). */
  close(): Promise<void>;
}

const SUPABASE_STUB = `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
`;

function withDatabase(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

export async function createTestDb(): Promise<TestDb> {
  if (!ADMIN_URL) throw new Error("TEST_ADMIN_DATABASE_URL is not set");
  const name = `test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  // Role creation is cluster-global; serialise it so parallel test files do not race.
  await admin`SELECT pg_advisory_lock(424242)`;
  try {
    await admin.unsafe(`CREATE DATABASE ${name}`);
  } finally {
    await admin`SELECT pg_advisory_unlock(424242)`;
  }
  const url = withDatabase(ADMIN_URL, name);
  const sql = postgres(url, { max: 10, onnotice: () => {} });
  await sql`SELECT pg_advisory_lock(424243)`;
  try {
    await sql.unsafe(SUPABASE_STUB);
  } finally {
    await sql`SELECT pg_advisory_unlock(424243)`;
  }
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return {
    name,
    url,
    sql,
    db,
    async close() {
      await sql.end({ timeout: 5 });
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end({ timeout: 5 });
    },
  };
}
