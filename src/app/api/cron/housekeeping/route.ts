import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { purgeRateLimits } from "@/lib/rate-limit";
import { purgeStaleQuarantine } from "@/server/files";
import { refreshPublishedPhotos } from "@/server/image-warm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // not configured => closed
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily housekeeping, called by Vercel Cron (which sends `Authorization: Bearer $CRON_SECRET`):
 *  - delete old rate-limit counters;
 *  - remove uploads that were never attached to a record;
 *  - ask for a rotating share of the published product photographs at the customer sizes, so their resized copies are stored
 *    before any customer asks (see src/server/image-warm.ts).
 * Each step is independent: one failing does not stop the others.
 */
export async function GET(req: Request) {
  if (!authorised(req)) return new NextResponse(null, { status: 401 });
  const db = getDb();
  const result: Record<string, number | string> = {};
  const step = async (name: string, fn: () => Promise<number>) => {
    try {
      result[name] = await fn();
    } catch (e) {
      console.error(`Housekeeping step "${name}" failed`, e instanceof Error ? e.message : e);
      result[name] = "failed";
    }
  };
  await step("rateLimitRowsPurged", () => purgeRateLimits(db));
  await step("abandonedUploadsRemoved", () => purgeStaleQuarantine(db));
  // Last, because it is the only step that takes long: it stops by itself after about 40 seconds.
  await step("photoSizesRefreshed", () => refreshPublishedPhotos());
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
