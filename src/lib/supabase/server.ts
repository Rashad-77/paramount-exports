import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { ownerCookieOptions } from "@/lib/auth/owner-session";

/** True when Supabase Auth is configured (URL + anon/publishable key). */
export function hasSupabaseAuth(): boolean {
  const e = publicEnv();
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Cookie-bound Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createSupabaseServerClient(opts: { ownerSession?: boolean } = {}) {
  const env = publicEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase Auth is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          // The owner's sign-in cookies last only until the browser closes and cannot be read by scripts (see owner-session.ts).
          for (const { name, value, options } of toSet) cookieStore.set(name, value, opts.ownerSession ? ownerCookieOptions(value, options) : options);
        } catch {
          // Called from a Server Component where cookies are read-only; the proxy refreshes sessions instead.
        }
      },
    },
  });
}
