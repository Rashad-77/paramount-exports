import { NextResponse } from "next/server";
import { DEMO_ROLE_COOKIE } from "@/lib/auth/demo";
import { demoDeploymentEnabled } from "@/lib/auth/demo-deployment";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!demoDeploymentEnabled()) return new NextResponse(null, { status: 404 });
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(DEMO_ROLE_COOKIE);
  return res;
}
