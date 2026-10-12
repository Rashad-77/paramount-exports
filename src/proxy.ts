import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 "proxy" (formerly middleware). It does two things only:
 *  1. refreshes the Supabase session cookie so it does not expire mid-use;
 *  2. optimistically sends visitors without a session away from /app.
 *
 * This is NOT the authorization boundary. Pages and services re-verify the user with
 * `supabase.auth.getUser()` and check roles/permissions on the server.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isInternal = request.nextUrl.pathname.startsWith("/app");

  if (!url || !key) {
    // Auth is not configured: the internal app cannot be used, the public site still works.
    return isInternal ? NextResponse.redirect(new URL("/login?error=not-configured", request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() validates the token with the Auth server (getSession() alone is not trustworthy).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isInternal && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Only run where a session matters; skips static assets and the public marketing pages entirely.
  matcher: ["/app/:path*", "/login", "/api/uploads/:path*"],
};
