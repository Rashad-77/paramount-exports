import { NextResponse } from "next/server";
import { DEMO_ROLE_COOKIE, demoSignInAllowed } from "@/lib/auth/demo";

export const dynamic = "force-dynamic";

/** Public demo only: "sign in" as the sample owner (the only demo role). 404 unless this is a demo deployment still holding placeholder content. */
export async function GET(req: Request) {
  if (!(await demoSignInAllowed())) return new NextResponse(null, { status: 404 });
  const role = "owner";
  const res = NextResponse.redirect(new URL("/app", req.url));
  res.cookies.set(DEMO_ROLE_COOKIE, role, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 8 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
