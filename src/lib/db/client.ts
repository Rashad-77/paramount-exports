import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
/** A transaction handle has the same query surface as the db. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

/**
 * Lazy singleton. On Vercel, DATABASE_URL must be the Supabase *transaction
 * pooler* string, which does not support prepared statements (`prepare: false`).
 * Interactive transactions (BEGIN … COMMIT, SELECT … FOR UPDATE) work through
 * the transaction pooler because they run on a single pooled connection.
 */
const globalForDb = globalThis as unknown as { __db?: Db; __sql?: postgres.Sql };

export function getDb(): Db {
  if (!globalForDb.__db) {
    const sql = postgres(serverEnv().DATABASE_URL, {
      prepare: false,
      // Each serverless instance keeps only a few connections, so many instances at once cannot use up the pooler's limit.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    globalForDb.__sql = sql;
    globalForDb.__db = drizzle(sql, { schema });
  }
  return globalForDb.__db;
}

/** Run `fn` in a single database transaction (rolls back if it throws). */
export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(fn);
}

/** Test hook: lets integration tests point the service layer at a throwaway database. */
export function __setDbForTests(db: Db | undefined): void {
  if (process.env.NODE_ENV !== "test") throw new Error("__setDbForTests is only available when NODE_ENV=test");
  globalForDb.__db = db;
}
