import { NextResponse } from "next/server";
import { demoActorEnabled, DEMO_ROLE_COOKIE } from "@/lib/auth/demo";
import { isRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Dev-only: choose which sample role the demo identity uses. 404 unless demo mode is enabled. */
export async function GET(req: Request) {
  if (!demoActorEnabled()) return new NextResponse(null, { status: 404 });
  const u = new URL(req.url);
  const role = u.searchParams.get("role") ?? "owner";
  if (!isRole(role)) return NextResponse.json({ error: "unknown role" }, { status: 400 });
  const next = u.searchParams.get("next");
  const res = NextResponse.redirect(new URL(next && /^\/app(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/app", req.url));
  res.cookies.set(DEMO_ROLE_COOKIE, role, { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
