"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} noValidate className="space-y-5">
      {notice ? <Alert tone="warning">{notice}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField label="Email" name="email" type="email" autoComplete="username" required defaultValue={state.email} error={state.fieldErrors?.email} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
