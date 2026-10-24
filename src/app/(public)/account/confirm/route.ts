import { NextResponse, type NextRequest } from "next/server";
import { customerAuthMode, isStaffId } from "@/lib/auth/customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "../actions";

/** The address in confirmation and reset emails. It trades the one-time code for a signed-in session, then moves on. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = await safeNext(url.searchParams.get("next") ?? undefined);
  if (customerAuthMode() === "supabase" && code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A shop staff member's email cannot become a customer sign-in (it would also open the dashboard without the staff password): end that
      // session at once and say so, instead of dropping them into the dashboard.
      if (data.user && (await isStaffId(data.user.id))) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/account/sign-in?notice=not-customer", url.origin));
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/account/sign-in", url.origin));
}
