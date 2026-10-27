"use client";

import Link from "next/link";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";
import { ownerForgotAction, ownerResetAction } from "./owner-actions";

export function ForgotForm() {
  return (
    <ActionForm action={ownerForgotAction} hideOnSuccess successTitle="Check your email">
      <FField name="email" kind="email" label="Email" type="email" autoComplete="username" inputMode="email" maxLength={200} required />
      <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
        Send the link
      </SubmitButton>
      <p className="text-sm">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </ActionForm>
  );
}

export function ResetForm() {
  return (
    <ActionForm action={ownerResetAction}>
      <FField name="newPassword" label="New password" type="password" autoComplete="new-password" maxLength={72} required />
      <FField name="confirmPassword" label="Retype new password" type="password" autoComplete="new-password" maxLength={72} required />
      <SubmitButton size="lg" className="w-full" pendingLabel="Saving…">
        Save the new password
      </SubmitButton>
    </ActionForm>
  );
}
