import "server-only";
import { and, eq } from "drizzle-orm";
import { needsSecondStep } from "@/lib/auth/owner-session";
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

export interface MfaState {
  enabled: boolean;
  factorId: string | null;
}

export async function mfaState(): Promise<MfaState> {
  if (!hasSupabaseAuth()) return { enabled: false, factorId: null };
  const supabase = await client();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp?.[0];
  return { enabled: Boolean(verified), factorId: verified?.id ?? null };
}

/** True when this session has only given the password and the account also needs its authenticator code. */
export async function secondStepPending(): Promise<boolean> {
  if (!hasSupabaseAuth()) return false;
  const supabase = await client();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return needsSecondStep(data?.currentLevel, data?.nextLevel);
}

/** Begin switching on the authenticator code: returns the picture and the typed key to add it to an authenticator app. */
export async function mfaStartEnroll(): Promise<{ factorId: string; qr: string; secret: string }> {
  const supabase = await client();
  // A half-finished set-up from before is removed so only one pending key exists.
  const { data: all } = await supabase.auth.mfa.listFactors();
  for (const f of all?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error || !data?.totp) throw validation("We could not start the set-up. Please try again.");
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Finish the set-up: the first code from the app proves it was added correctly. */
export async function mfaFinishEnroll(factorId: string, code: string): Promise<void> {
  await throttleCodes();
  const supabase = await client();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw validation("That code is not right. Check the app and try again.", { code: ["That code is not right."] });
}

/** Give the code at sign-in. */
export async function mfaVerifyLogin(code: string): Promise<void> {
  await throttleCodes();
  const supabase = await client();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.[0];
  if (!factor) throw validation("Two-step sign-in is not switched on for this account.");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) throw validation("That code is not right. Check the app and try again.", { code: ["That code is not right."] });
}

/** Switch the authenticator code off. The current code is asked for first, so a left-open screen cannot do it. */
export async function mfaDisable(code: string): Promise<void> {
  await mfaVerifyLogin(code);
  const supabase = await client();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
}

/** Six digits can be guessed, so the number of tries is limited per signed-in person. */
async function throttleCodes(): Promise<void> {
  const supabase = await client();
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw validation("Your session has ended. Please sign in again.");
  const hit = await hitRateLimit(getDb(), { scope: "owner-code", value: id, limit: 8, windowSeconds: 600 });
  if (!hit.allowed) throw rateLimited("Too many wrong codes. Please wait a few minutes and try again.");
}
