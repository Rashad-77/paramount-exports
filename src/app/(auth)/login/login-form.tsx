"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";
import { toast } from "@/components/ui/toaster";
import { signIn, type LoginState } from "./actions";

/** A dropped connection shows a message and keeps the email; sign-in redirects and other framework signals pass through. */
const safeSignIn = async (prev: LoginState, formData: FormData): Promise<LoginState> => {
  try {
    return await signIn(prev, formData);
  } catch (error) {
    const digest = (error as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
    const email = formData.get("email");
    return { error: "We could not reach the server. Check your connection and try again.", email: typeof email === "string" ? email : undefined };
  }
};

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(safeSignIn, {});
  useEffect(() => {
    if (state.error) toast(state.error, "danger");
  }, [state]);
  return (
    <form action={action} noValidate className="space-y-5" onSubmit={(e) => pending && e.preventDefault()}>
      {notice ? <Alert tone="warning">{notice}</Alert> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField label="Email" name="email" type="email" autoComplete="username" inputMode="email" maxLength={200} required defaultValue={state.email} error={state.fieldErrors?.email} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
