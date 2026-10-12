import { NextResponse } from "next/server";
import { issueFormToken } from "@/lib/form-guard";

export const dynamic = "force-dynamic";

/** Hands out a signed, time-stamped token that public forms must send back (anti-spam). */
export async function GET() {
  return NextResponse.json({ token: issueFormToken() }, { headers: { "Cache-Control": "no-store" } });
}
