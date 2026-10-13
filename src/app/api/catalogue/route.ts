import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { hasDatabase } from "@/lib/env";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { listPublicProducts } from "@/server/catalogue-public";

export const dynamic = "force-dynamic";

const clean = (v: string | null, max: number) => v?.trim().slice(0, max) || undefined;

/**
 * The product list for the Collection page as it narrows while a visitor types or picks a filter: only the products are fetched,
 * the page is not reloaded. Public and read-only; the same visibility rules as the page itself, and a generous limit per address.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query = {
    q: clean(sp.get("q"), 80),
    category: clean(sp.get("category"), 100),
    material: clean(sp.get("material"), 100),
    sort: sp.get("sort") === "name" ? ("name" as const) : ("newest" as const),
    page: Math.min(500, Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1)),
  };

  if (hasDatabase()) {
    const hit = await hitRateLimit(getDb(), { scope: "catalogue-ip", value: clientIp(req.headers) ?? "unknown", limit: 300, windowSeconds: 60 });
    if (!hit.allowed) {
      return NextResponse.json({ error: "Too many searches. Please wait a moment." }, { status: 429, headers: { "Retry-After": String(hit.retryAfterSeconds), "Cache-Control": "no-store" } });
    }
  }

  try {
    return NextResponse.json(await listPublicProducts(query), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Catalogue lookup failed", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "The collection could not be loaded." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
