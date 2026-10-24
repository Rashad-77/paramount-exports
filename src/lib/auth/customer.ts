import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customerAccounts, profiles } from "@/lib/db/schema";
import { hasDatabase, publicEnv } from "@/lib/env";
import { phoneKey } from "@/lib/contact";
import { validation } from "@/lib/errors";
import { hashingSalt } from "@/lib/rate-limit";
import { getAccountSettings } from "@/lib/settings";
import { createSupabaseServerClient, hasSupabaseAuth } from "@/lib/supabase/server";
import { isLocalDatabaseUrl } from "./demo";
import { hashPassword, readSession, signSession, verifyPassword } from "./local-credentials";

/**
 * Customer sign-in. Customers are not staff: nothing here grants access to /app (that needs a staff profile and a role).
 *
 *  - "supabase": the real thing. Same Supabase project as staff sign-in; email + password, confirmation and reset emails.
 *  - "local":    DEVELOPMENT/TEST ONLY, so accounts can be built and tested without a Supabase project. Allowed only on a local
 *                database, never on Vercel, and only under `next dev` with DEMO_MODE or in the browser tests (ALLOW_LOCAL_CUSTOMER_AUTH).
 *  - "off":      no sign-in service. Accounts cannot be switched on in Settings and no account page is shown.
 */
export type CustomerAuthMode = "supabase" | "local" | "off";

export function customerAuthMode(): CustomerAuthMode {
  if (hasSupabaseAuth()) return "supabase";
  const local =
    !process.env.VERCEL &&
    isLocalDatabaseUrl(process.env.DATABASE_URL) &&
    ((process.env.NODE_ENV === "development" && process.env.DEMO_MODE === "true") || process.env.ALLOW_LOCAL_CUSTOMER_AUTH === "e2e-only");
  return local ? "local" : "off";
}

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
}

const LOCAL_COOKIE = "customer_session";
const LOCAL_TTL = 60 * 60 * 24 * 30;

const toCustomer = (r: typeof customerAccounts.$inferSelect): Customer => ({ id: r.id, fullName: r.fullName, email: r.email, phone: r.phone, address: r.address });

/** The person signed in on this browser, verified with the sign-in service (null when nobody is). */
const verifiedUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : user;
});

/** Staff (the business owner) sign in to the dashboard. They are never customers, and never get a customer account. */
export async function isStaffId(id: string): Promise<boolean> {
  const [row] = await getDb().select({ id: profiles.id }).from(profiles).where(eq(profiles.id, id)).limit(1);
  return Boolean(row);
}

/** True when the person signed in on this browser is a staff member: they belong in the dashboard, not in the customer account pages. */
export const isStaffSignedIn = cache(async (): Promise<boolean> => {
  if (customerAuthMode() !== "supabase" || !hasDatabase()) return false;
  const user = await verifiedUser();
  return user ? isStaffId(user.id) : false;
});

/** Make sure a verified sign-in identity has its account row (created on first sign-in, so email confirmation can happen later). */
async function ensureAccount(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Promise<Customer | null> {
  if (!user.email) return null;
  if (await isStaffId(user.id)) return null;
  const db = getDb();
  const [found] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, user.id)).limit(1);
  if (found) return toCustomer(found);
  const meta = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const fullName = meta || user.email.split("@")[0]!;
  const [created] = await db
    .insert(customerAccounts)
    .values({ id: user.id, fullName: fullName.slice(0, 120), email: user.email, emailLower: user.email.toLowerCase() })
    .onConflictDoNothing()
    .returning();
  if (created) return toCustomer(created);
  const [again] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, user.id)).limit(1);
  return again ? toCustomer(again) : null;
}

/** The signed-in customer, or null. Identity is verified with the sign-in service on every request. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const mode = customerAuthMode();
  if (mode === "off" || !hasDatabase()) return null;
  if (mode === "local") {
    const id = readSession((await cookies()).get(LOCAL_COOKIE)?.value, hashingSalt());
    if (!id) return null;
    const [row] = await getDb().select().from(customerAccounts).where(eq(customerAccounts.id, id)).limit(1);
    return row ? toCustomer(row) : null;
  }
  const user = await verifiedUser();
  if (!user) return null;
  return ensureAccount(user);
});

/** The signed-in customer, only while the owner has accounts switched on. Orders and enquiries are linked to this id, never to one sent by the browser. */
export async function activeCustomer(): Promise<Customer | null> {
  if (!(await getAccountSettings()).enabled) return null;
  return getCustomer();
}

/** For account pages: send visitors who are not signed in to the sign-in page, then back. */
export async function requireCustomer(next?: string): Promise<Customer> {
  const customer = await getCustomer();
  if (!customer) {
    if (await isStaffSignedIn()) redirect("/app");
    redirect(`/account/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return customer;
}

const siteUrl = () => publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

async function startLocalSession(id: string): Promise<void> {
  (await cookies()).set(LOCAL_COOKIE, signSession(id, hashingSalt(), LOCAL_TTL), { httpOnly: true, sameSite: "lax", path: "/", maxAge: LOCAL_TTL, secure: false });
}

export type SignUpResult = "signed-in" | "confirm-email";

export async function signUpCustomer(input: { fullName: string; email: string; password: string; phone?: string }): Promise<SignUpResult> {
  const mode = customerAuthMode();
  const email = input.email.trim();
  if (mode === "local") {
    const db = getDb();
    const [exists] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.emailLower, email.toLowerCase())).limit(1);
    if (exists) throw validation("An account with that email already exists. Try signing in.", { email: ["An account with that email already exists."] });
    const id = randomUUID();
    await db.insert(customerAccounts).values({
      id,
      fullName: input.fullName,
      email,
      emailLower: email.toLowerCase(),
      phone: input.phone ?? null,
      phoneKey: input.phone ? phoneKey(input.phone) : null,
      localPasswordHash: await hashPassword(input.password),
    });
    await startLocalSession(id);
    return "signed-in";
  }
  if (mode !== "supabase") throw validation("Customer accounts are not available yet.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: input.fullName }, emailRedirectTo: `${siteUrl()}/account/confirm` },
  });
  if (error) throw validation("We could not create your account. Please check your details and try again.");
  // An address that is already registered comes back with no identities. Say nothing different, so sign-up cannot be used to find out who has an account.
  if (!data.user || (data.user.identities?.length ?? 0) === 0 || !data.session) return "confirm-email";
  const account = await ensureAccount(data.user);
  if (account && input.phone) await getDb().update(customerAccounts).set({ phone: input.phone, phoneKey: phoneKey(input.phone) }).where(eq(customerAccounts.id, account.id));
  return "signed-in";
}

/** Google sign-in is offered only when the owner has set it up in Supabase and switched it on here (GOOGLE_SIGN_IN=on). */
export const googleSignInEnabled = () => customerAuthMode() === "supabase" && process.env.GOOGLE_SIGN_IN === "on";

/** Sends the visitor to Google to choose an account. Google confirms the email address, so there is no confirmation email to wait for. */
export async function startGoogleSignIn(next: string): Promise<void> {
  if (!googleSignInEnabled()) throw validation("Sign in with Google is not available yet.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/account/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) throw validation("We could not start sign-in with Google. Please try again, or use your email.");
  redirect(data.url);
}

export async function signInCustomer(input: { email: string; password: string }): Promise<void> {
  const mode = customerAuthMode();
  const wrong = () => validation("Incorrect email or password.");
  if (mode === "local") {
    const [row] = await getDb().select().from(customerAccounts).where(eq(customerAccounts.emailLower, input.email.trim().toLowerCase())).limit(1);
    if (!row || !(await verifyPassword(input.password, row.localPasswordHash))) throw wrong();
    await startLocalSession(row.id);
    return;
  }
  if (mode !== "supabase") throw validation("Customer accounts are not available yet.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
  if (error || !data.user) {
    // One message for every failure (wrong password, unknown email, unconfirmed email) so the form reveals nothing about who has an account.
    throw wrong();
  }
  await ensureAccount(data.user);
}

export async function signOutCustomer(): Promise<void> {
  const mode = customerAuthMode();
  if (mode === "local") (await cookies()).delete(LOCAL_COOKIE);
  else if (mode === "supabase") await (await createSupabaseServerClient()).auth.signOut();
}

/** Always succeeds from the visitor's point of view, so the form cannot be used to find out who has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  if (customerAuthMode() !== "supabase") return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${siteUrl()}/account/confirm?next=/account/reset` });
}

/** Change the password of the signed-in customer. The current password is checked first. */
export async function changeCustomerPassword(customer: Customer, current: string, next: string): Promise<void> {
  const mode = customerAuthMode();
  if (mode === "local") {
    const [row] = await getDb().select().from(customerAccounts).where(eq(customerAccounts.id, customer.id)).limit(1);
    if (!row || !(await verifyPassword(current, row.localPasswordHash))) throw validation("Your current password is not right.", { currentPassword: ["That is not your current password."] });
    await getDb().update(customerAccounts).set({ localPasswordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(customerAccounts.id, customer.id));
    return;
  }
  if (mode !== "supabase") throw validation("Customer accounts are not available yet.");
  const supabase = await createSupabaseServerClient();
  const check = await supabase.auth.signInWithPassword({ email: customer.email, password: current });
  if (check.error) throw validation("Your current password is not right.", { currentPassword: ["That is not your current password."] });
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw validation("We could not change your password. Choose a different one and try again.", { newPassword: ["Choose a different password."] });
}

/** Set a new password during the emailed reset (the reset link has already signed the person in). */
export async function setPasswordAfterReset(next: string): Promise<void> {
  if (customerAuthMode() !== "supabase") throw validation("Password reset is not available here.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw validation("We could not set that password. Choose a different one, or ask for a new link.", { newPassword: ["Choose a different password."] });
}

/**
 * Delete the account and everything saved on it. Orders and quotation requests stay for the business records, but are no longer
 * connected to the person. The sign-in identity itself is removed too when a service key is configured.
 */
export async function deleteCustomerAccount(customer: Customer): Promise<void> {
  const mode = customerAuthMode();
  await getDb().delete(customerAccounts).where(eq(customerAccounts.id, customer.id));
  if (mode === "local") (await cookies()).delete(LOCAL_COOKIE);
  if (mode === "supabase") {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = publicEnv().NEXT_PUBLIC_SUPABASE_URL;
    if (key && url) {
      const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      await admin.auth.admin.deleteUser(customer.id);
    }
    await (await createSupabaseServerClient()).auth.signOut();
  }
}
