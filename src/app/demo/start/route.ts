import { NextResponse } from "next/server";
import { DEMO_ROLE_COOKIE, demoSignInAllowed } from "@/lib/auth/demo";
import { isRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Public demo only: "sign in" as a sample role. 404 unless this is a demo deployment still holding placeholder content. */
export async function GET(req: Request) {
  if (!(await demoSignInAllowed())) return new NextResponse(null, { status: 404 });
  const u = new URL(req.url);
  const role = u.searchParams.get("role") ?? "";
  if (!isRole(role)) return NextResponse.json({ error: "unknown role" }, { status: 400 });
  const res = NextResponse.redirect(new URL("/app", req.url));
  res.cookies.set(DEMO_ROLE_COOKIE, role, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 8 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
