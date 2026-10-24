import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Keeps what a database read returns, shared by every visitor, until something clears its tag (see clearCatalogueCache and
 * clearSettingsCache) or the time limit passes. The result must be plain data (it is stored as JSON), and a read that throws is never kept.
 * Outside the web server (the database tests, scripts) there is no cache to keep things in, so the read goes straight to the database.
 */
export function kept<A extends unknown[], R>(read: (...args: A) => Promise<R>, key: string[], tags: string[], revalidate: number) {
  const stored = unstable_cache(read, key, { tags, revalidate });
  return async (...args: A): Promise<R> => {
    try {
      return await stored(...args);
    } catch (e) {
      if (e instanceof Error && /incrementalCache missing/.test(e.message)) return read(...args);
      throw e;
    }
  };
}
