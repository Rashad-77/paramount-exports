import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations should use a direct (or session-pooler) connection, not the transaction pooler.
    url: process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL ?? "postgres://invalid",
  },
  strict: true,
  verbose: true,
});
