"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { profiles, userRoles } from "@/lib/db/schema";
import { DEMO_ROLE_COOKIE } from "@/lib/auth/demo";
import { demoDeploymentEnabled } from "@/lib/auth/demo-deployment";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient, hasSupabaseAuth } from "@/lib/supabase/server";

export interface LoginState {
  /** Echoed back so a failed attempt does not wipe what the user typed (never the password). */
  email?: string;
  error?: string;
  fieldErrors?: { email?: string; password?: string };
}

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

/** Only allow redirects to internal app paths (prevents open-redirect abuse). */
function safeNext(next: string | undefined): string {
  return next && /^\/app(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/app";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { email: String(formData.get("email") ?? ""), fieldErrors: { email: f.email?.[0], password: f.password?.[0] } };
  }
  if (!hasSupabaseAuth()) {
    return { email: parsed.data.email, error: "Sign-in is not configured yet. Ask the system administrator to finish setup." };
  }

  // Throttle guessing before Supabase is even asked: per address (anyone targeting one account) and per IP (anyone trying many).
  // The same wording as a wrong password is used, so the limit does not reveal whether an account exists.
  try {
    const db = getDb();
    const ip = clientIp(await headers()) ?? "unknown";
    const [byEmail, byIp] = await Promise.all([
      hitRateLimit(db, { scope: "login-email", value: parsed.data.email.toLowerCase(), limit: 8, windowSeconds: 600 }),
      hitRateLimit(db, { scope: "login-ip", value: ip, limit: 30, windowSeconds: 600 }),
    ]);
    if (!byEmail.allowed || !byIp.allowed) {
      return { email: parsed.data.email, error: "Too many sign-in attempts. Please wait a few minutes and try again." };
    }
  } catch (e) {
    // If the limiter itself is unavailable, fail closed in production rather than allow unlimited guessing.
    console.error("Login rate limit unavailable", e instanceof Error ? e.message : e);
    return { email: parsed.data.email, error: "Sign-in is temporarily unavailable. Please try again shortly." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) {
    // One message for every failure so the form cannot be used to discover which emails have accounts.
    return { email: parsed.data.email, error: "Incorrect email or password." };
  }

  // Valid credentials are not enough: the person needs an active staff profile with at least one role.
  const db = getDb();
  const [profile] = await db.select({ isActive: profiles.isActive }).from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, data.user.id));
  if (!profile?.isActive || roles.length === 0) {
    await supabase.auth.signOut();
    return { email: parsed.data.email, error: "This account does not have access. Please contact the business owner." };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  if (demoDeploymentEnabled()) (await cookies()).delete(DEMO_ROLE_COOKIE);
  if (hasSupabaseAuth()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
