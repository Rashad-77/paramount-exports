import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { isRole, type Actor, type Role } from "./permissions";
import { sql } from "drizzle-orm";
import { isPlaceholderBusiness, getBusinessSettings } from "@/lib/settings";
import { demoDeploymentEnabled } from "./demo-deployment";

/**
 * DEVELOPMENT-ONLY demo identity, so the staff screens can be reviewed in a browser without a Supabase project.
 * It is deliberately hard to enable by accident:
 *   - only under `next dev` (NODE_ENV === "development"), never in a production build, never on Vercel;
 *   - only with DEMO_MODE=true;
 *   - only when DATABASE_URL points at this machine (localhost), so it can never touch a shared/production database.
 * It writes sample staff rows (auth stub + profile + role) into that local database.
 */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function demoActorEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEMO_MODE === "true" &&
    !process.env.VERCEL &&
    isLocalDatabaseUrl(process.env.DATABASE_URL)
  );
}

const DEMO_IDS: Record<Role, string> = {
  owner: "00000000-0000-4000-8000-000000000001",
  staff: "00000000-0000-4000-8000-000000000002",
};
const DEMO_NAMES: Record<Role, string> = {
  owner: "Mr. Kapila Bandara",
  staff: "Sample Staff",
};

export const DEMO_ROLE_COOKIE = "demo_role";

/**
 * Public demo deployment (see demo-deployment.ts): enabled by configuration AND only while the business is still the placeholder.
 * Saving a real business name switches the demo sign-in off, so a demo cannot quietly become a live system with no password.
 */
export async function demoSignInAllowed(): Promise<boolean> {
  if (!demoDeploymentEnabled()) return false;
  return isPlaceholderBusiness(await getBusinessSettings());
}

export const DEMO_STAFF = DEMO_IDS;
export const DEMO_STAFF_NAMES = DEMO_NAMES;

/** Callers MUST have checked their own guard first (demoActorEnabled() or the seed script's equivalent). */
export async function ensureDemoStaff(db: Pick<ReturnType<typeof getDb>, "execute"> = getDb()): Promise<void> {
  for (const role of Object.keys(DEMO_IDS) as Role[]) {
    const id = DEMO_IDS[role];
    await db.execute(sql`INSERT INTO auth.users (id, email) VALUES (${id}, ${`${role}@sample.invalid`}) ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO profiles (id, full_name) VALUES (${id}, ${DEMO_NAMES[role]}) ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO user_roles (user_id, role) VALUES (${id}, ${role}) ON CONFLICT (user_id, role) DO NOTHING`);
  }
}

let ensured = false;
export async function getDemoActor(): Promise<Actor | null> {
  const deployment = !demoActorEnabled() && demoDeploymentEnabled();
  if (!demoActorEnabled() && !deployment) return null;
  if (deployment && !(await demoSignInAllowed())) return null;
  if (!ensured) {
    await ensureDemoStaff(getDb());
    ensured = true;
  }
  const raw = (await cookies()).get(DEMO_ROLE_COOKIE)?.value;
  // Local development defaults to the owner; a public demo requires an explicit choice on the sign-in page.
  if (deployment && !(raw && isRole(raw))) return null;
  const role: Role = raw && isRole(raw) ? raw : "owner";
  return { id: DEMO_IDS[role], fullName: DEMO_NAMES[role], roles: [role], isActive: true };
}
