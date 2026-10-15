/* eslint-disable no-console */
import path from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });
config();

async function main() {
  // Migrations need a direct or session-mode connection (DDL + multi-statement), not the transaction pooler.
  const url = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_DIRECT_URL (preferred) or DATABASE_URL before running migrations.");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
