import "server-only";
import { eq } from "drizzle-orm";
import { demoActorEnabled } from "@/lib/auth/demo";
import { demoDeploymentEnabled } from "@/lib/auth/demo-deployment";
import type { Actor } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { rateLimited, validation } from "@/lib/errors";
import { hitRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient, hasSupabaseAuth } from "@/lib/supabase/server";
import { recordAudit } from "./audit";

/** Sign-in details can be changed only where there is a real sign-in service: not in a demo, which has no password at all. */
export function signInDetailsAvailable(): boolean {
  return hasSupabaseAuth() && !demoActorEnabled() && !demoDeploymentEnabled();
}

/** The email this account signs in with, or null where there is no sign-in service. */
export async function staffSignInEmail(): Promise<string | null> {
  if (!signInDetailsAvailable()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function updateStaffName(actor: Actor, fullName: string): Promise<void> {
  const db = getDb();
  await db.update(profiles).set({ fullName, updatedAt: new Date() }).where(eq(profiles.id, actor.id));
  await recordAudit(db, actor, { action: "account.name", entityType: "profile", entityId: actor.id, after: { fullName } });
}

/** Ask for a new sign-in email. The service sends a confirmation link to it, and the address changes only once that link is opened. */
export async function changeStaffEmail(actor: Actor, email: string): Promise<void> {
  if (!signInDetailsAvailable()) throw validation("The sign-in email cannot be changed here.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw validation("We could not change the email. Check the address and try again.", { email: ["Check this address."] });
  await recordAudit(getDb(), actor, { action: "account.email_change_requested", entityType: "profile", entityId: actor.id });
}

/** Change the password after checking the current one. Guessing is throttled per account. */
export async function changeStaffPassword(actor: Actor, current: string, next: string): Promise<void> {
  if (!signInDetailsAvailable()) throw validation("The password cannot be changed here.");
  const hit = await hitRateLimit(getDb(), { scope: "staff-password", value: actor.id, limit: 6, windowSeconds: 600 });
  if (!hit.allowed) throw rateLimited("Too many attempts. Please wait a few minutes and try again.");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) throw validation("Your session has ended. Please sign in again.");
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) throw validation("Your current password is not right.", { currentPassword: ["That is not your current password."] });
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw validation("We could not change your password. Choose a different one and try again.", { newPassword: ["Choose a different password."] });
  await recordAudit(getDb(), actor, { action: "account.password_changed", entityType: "profile", entityId: actor.id });
}
