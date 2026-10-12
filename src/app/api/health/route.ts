import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { hasDatabase } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Exposes no configuration, versions or error details. */
export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ status: "ok", database: "not-configured" }, { headers: { "Cache-Control": "no-store" } });
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", database: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
