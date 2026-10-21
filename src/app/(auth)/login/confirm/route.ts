import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, hasSupabaseAuth } from "@/lib/supabase/server";

/** The address in the owner's reset email. It trades the one-time code for a short sign-in, then sends the owner to choose a new password. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  if (hasSupabaseAuth() && code) {
    const supabase = await createSupabaseServerClient({ ownerSession: true });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/login/reset", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link-expired", url.origin));
}
