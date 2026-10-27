import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, userRoles } from "@/lib/db/schema";
import { hasDatabase } from "@/lib/env";
import { createSupabaseServerClient, hasSupabaseAuth } from "@/lib/supabase/server";
import { getDemoActor, demoActorEnabled } from "./demo";
import { demoDeploymentEnabled } from "./demo-deployment";
import { isRole, type Actor } from "./permissions";

/**
 * Resolve the signed-in staff member, or null.
 * - Identity is verified with Supabase (`getUser()` round-trips to the Auth server).
 * - Roles and active status come from OUR database, never from client-supplied claims.
 * - A user with a valid session but no active profile/roles gets an actor with no permissions.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  if (demoActorEnabled() || demoDeploymentEnabled()) return getDemoActor(); // dev-only identity / public demo; see lib/auth/demo.ts for the safeguards
  if (!hasSupabaseAuth() || !hasDatabase()) return null;

  const supabase = await createSupabaseServerClient();
  // The sign-in token is checked here against Supabase's public signing key, which the server keeps (no trip to the sign-in server on
  // every page). The proxy has already asked the sign-in server about this same request (getUser), so a signed-out or removed user is
  // caught there. Should the local check not be possible, getClaims falls back to asking the sign-in server.
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || !userId) return null;
  // The profile and the roles are read together, not one after the other.
  const db = getDb();
  const [[profile], roleRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
    db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId)),
  ]);
  if (!profile) return null;

  const roles = roleRows.map((r) => r.role).filter(isRole);
  return {
    id: profile.id,
    fullName: profile.fullName,
    isActive: profile.isActive,
    // Only the business owner uses the staff area: any other account, even with a valid session, has no roles and so no access.
    roles: roles.includes("owner") ? roles : [],
  };
});

/** For pages/layouts inside /app: redirect to login when not signed in, or to a notice when deactivated. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.isActive || actor.roles.length === 0) redirect("/login?error=no-access");
  return actor;
}
