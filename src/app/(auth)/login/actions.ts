"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { profiles, userRoles } from "@/lib/db/schema";
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
  if (hasSupabaseAuth()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
