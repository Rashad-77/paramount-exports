import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_ROLE_COOKIE_NAME, demoDeploymentEnabled } from "@/lib/auth/demo-deployment";
import { OWNER_SEEN_COOKIE, ownerCookieBase, ownerCookieOptions, ownerSessionExpired } from "@/lib/auth/owner-session";

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
  const isInternal = request.nextUrl.pathname.startsWith("/app") || request.nextUrl.pathname.startsWith("/print");

  // Development-only demo identity (never true in production builds or on Vercel): see lib/auth/demo.ts.
  const demo =
    process.env.NODE_ENV === "development" && process.env.DEMO_MODE === "true" && !process.env.VERCEL && /^(postgres(ql)?:\/\/[^@]*@)?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(process.env.DATABASE_URL ?? "");
  if (demo) return NextResponse.next();

  // Public demo deployment (no Supabase; see lib/auth/demo-deployment.ts). The real check is repeated in getActor().
  if (demoDeploymentEnabled()) {
    if (isInternal && !request.cookies.get(DEMO_ROLE_COOKIE_NAME)) return NextResponse.redirect(new URL("/login", request.url));
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

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
        // On staff pages the sign-in cookie is a session cookie (gone when the browser closes), HttpOnly and secure.
        for (const { name, value, options } of toSet) response.cookies.set(name, value, isInternal ? ownerCookieOptions(value, options) : options);
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

  if (isInternal && user) {
    // A staff session ends after a stretch of inactivity, and always after a working day, however it was kept alive.
    const now = Date.now();
    const signedIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;
    const seenRaw = Number(request.cookies.get(OWNER_SEEN_COOKIE)?.value);
    if (ownerSessionExpired(now, Number.isFinite(signedIn) ? signedIn : null, seenRaw > 0 ? seenRaw : null)) {
      await supabase.auth.signOut();
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "expired");
      login.searchParams.set("next", request.nextUrl.pathname);
      const out = NextResponse.redirect(login);
      for (const c of response.cookies.getAll()) out.cookies.set(c);
      out.cookies.delete(OWNER_SEEN_COOKIE);
      out.headers.set("Cache-Control", "private, no-store");
      return out;
    }
    response.cookies.set(OWNER_SEEN_COOKIE, String(now), ownerCookieBase());
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Only run where a session matters; skips static assets and the public marketing pages entirely.
  matcher: ["/app/:path*", "/print/:path*", "/account/:path*", "/login", "/api/uploads/:path*", "/api/files/:path*"],
};
