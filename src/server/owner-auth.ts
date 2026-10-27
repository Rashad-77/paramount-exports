import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, userRoles } from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";
import { rateLimited, validation } from "@/lib/errors";
import { hitRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient, hasSupabaseAuth } from "@/lib/supabase/server";

const client = () => createSupabaseServerClient({ ownerSession: true });

/** The signed-in person, but only when they are the active owner. Everyone else (a customer, nobody) gets null. */
export async function ownerFromSession(): Promise<{ id: string; email: string } | null> {
  if (!hasSupabaseAuth()) return null;
  const supabase = await client();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  const db = getDb();
  const [profile] = await db.select({ isActive: profiles.isActive }).from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  const [owner] = await db.select({ id: userRoles.id }).from(userRoles).where(and(eq(userRoles.userId, data.user.id), eq(userRoles.role, "owner"))).limit(1);
  return profile?.isActive && owner ? { id: data.user.id, email: data.user.email } : null;
}

/**
 * Send the owner a link to choose a new password. The answer is the same whether or not the address belongs to the owner, so this
 * cannot be used to find out who has an account; guessing is throttled per address and per visitor.
 */
export async function requestOwnerPasswordReset(email: string, ip: string | null): Promise<void> {
  if (!hasSupabaseAuth()) return;
  const db = getDb();
  const byEmail = await hitRateLimit(db, { scope: "owner-reset-email", value: email.toLowerCase(), limit: 3, windowSeconds: 3600 });
  const byIp = await hitRateLimit(db, { scope: "owner-reset-ip", value: ip ?? "unknown", limit: 10, windowSeconds: 3600 });
  if (!byEmail.allowed || !byIp.allowed) throw rateLimited("Too many requests. Please wait a while and try again.");
  const supabase = await client();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/login/confirm` }).catch(() => undefined);
}

/** Set the new password for the owner who opened the emailed link, then end that session so the new password has to be used to sign in. */
export async function setOwnerPassword(newPassword: string): Promise<void> {
  const owner = await ownerFromSession();
  if (!owner) throw validation("This link has expired or was already used. Please ask for a new one.");
  const supabase = await client();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw validation("We could not set that password. Choose a different one and try again.", { newPassword: ["Choose a different password."] });
  await supabase.auth.signOut();
}
