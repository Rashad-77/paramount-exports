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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (!profile) return null;

  const roleRows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));

  return {
    id: profile.id,
    fullName: profile.fullName,
    isActive: profile.isActive,
    roles: roleRows.map((r) => r.role).filter(isRole),
  };
});

/** For pages/layouts inside /app: redirect to login when not signed in, or to a notice when deactivated. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.isActive || actor.roles.length === 0) redirect("/login?error=no-access");
  return actor;
}
