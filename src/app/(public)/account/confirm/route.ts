import { NextResponse, type NextRequest } from "next/server";
import { customerAuthMode } from "@/lib/auth/customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "../actions";

/** The address in confirmation and reset emails. It trades the one-time code for a signed-in session, then moves on. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = await safeNext(url.searchParams.get("next") ?? undefined);
  if (customerAuthMode() === "supabase" && code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/account/sign-in", url.origin));
}
