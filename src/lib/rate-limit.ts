import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db/client";
import { isProduction } from "@/lib/env";

/**
 * Fixed-window rate limiting backed by Postgres, so it works across Vercel's stateless function instances
 * with no extra service. Keys are salted hashes — raw IPs / phone numbers are never stored.
 * Add Vercel Firewall rate-limit rules in front of this for volumetric abuse.
 */

export function hashingSalt(): string {
  const salt = process.env.IP_HASH_SALT;
  if (salt && salt.length >= 16) return salt;
  if (isProduction()) throw new Error("IP_HASH_SALT must be set (>= 16 characters) in production");
  return "development-only-salt-not-for-production";
}

export function hashKey(scope: string, value: string, salt: string = hashingSalt()): string {
  return createHash("sha256").update(`${salt}|${scope}|${value}`).digest("hex");
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

export async function hitRateLimit(
  db: DbOrTx,
  opts: { scope: string; value: string; limit: number; windowSeconds: number; now?: Date },
): Promise<RateLimitResult> {
  const nowMs = (opts.now ?? new Date()).getTime();
  const windowMs = opts.windowSeconds * 1000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const key = hashKey(opts.scope, opts.value);
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key_hash, window_start, count)
    VALUES (${key}, ${new Date(windowStartMs).toISOString()}::timestamptz, 1)
    ON CONFLICT (key_hash, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`);
  const count = Number((rows as unknown as Array<{ count: number }>)[0]!.count);
  return {
    allowed: count <= opts.limit,
    count,
    limit: opts.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1000)),
  };
}

/** Gives back one hit (for example when the guarded work failed and the visitor may fairly try again). */
export async function releaseRateLimit(db: DbOrTx, opts: { scope: string; value: string; windowSeconds: number; now?: Date }): Promise<void> {
  const windowMs = opts.windowSeconds * 1000;
  const windowStartMs = Math.floor((opts.now ?? new Date()).getTime() / windowMs) * windowMs;
  await db.execute(sql`UPDATE rate_limits SET count = GREATEST(count - 1, 0) WHERE key_hash = ${hashKey(opts.scope, opts.value)} AND window_start = ${new Date(windowStartMs).toISOString()}::timestamptz`);
}

/** Housekeeping: remove windows older than `olderThanSeconds`. Called by the cron endpoint. */
export async function purgeRateLimits(db: DbOrTx, olderThanSeconds = 24 * 3600): Promise<number> {
  const rows = await db.execute<{ n: number }>(
    sql`WITH d AS (DELETE FROM rate_limits WHERE window_start < now() - make_interval(secs => ${olderThanSeconds}) RETURNING 1) SELECT count(*)::int AS n FROM d`,
  );
  return Number((rows as unknown as Array<{ n: number }>)[0]!.n);
}

/** Best-effort client IP behind Vercel's proxy. Returns null if unavailable. */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || null;
}
