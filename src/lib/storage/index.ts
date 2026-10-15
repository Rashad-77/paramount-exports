import "server-only";
import { serverEnv } from "@/lib/env";
import { createLocalProvider } from "./local";
import { createSupabaseProvider } from "./supabase";
import type { StorageProvider } from "./types";

export * from "./types";

let cached: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (!cached) cached = serverEnv().STORAGE_DRIVER === "local" ? createLocalProvider() : createSupabaseProvider();
  return cached;
}

/** Test hook. */
export function __setStorageForTests(p: StorageProvider | undefined): void {
  if (process.env.NODE_ENV !== "test") throw new Error("only available when NODE_ENV=test");
  cached = p;
}
