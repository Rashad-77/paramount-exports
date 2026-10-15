/**
 * PUBLIC DEMO DEPLOYMENT: lets anyone who opens the link look around the staff area as a chosen sample role, with sample data and
 * no Supabase. It exists only so a demo can run on Vercel with nothing else set up. It is NOT a login system: there is no password.
 *
 * It is switched on only when ALL of these hold (pure and edge-safe, so the proxy can use it too):
 *   - DEMO_DEPLOYMENT=true is set explicitly;
 *   - a database is configured;
 *   - Supabase sign-in is NOT configured (the moment real sign-in is configured, the demo bypass turns itself off);
 * and the sign-in itself additionally refuses once a real business name has been saved (see `demoSignInAllowed`).
 */
export function demoDeploymentEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_DEPLOYMENT === "true" && Boolean(env.DATABASE_URL) && !env.NEXT_PUBLIC_SUPABASE_URL && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !env.SUPABASE_SERVICE_ROLE_KEY;
}

export const DEMO_ROLE_COOKIE_NAME = "demo_role";
