"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";
import type { ActionState } from "@/lib/action-state";
import { confirmMfaAction, disableMfaAction, startMfaAction } from "./actions";

interface Start {
  factorId: string;
  qr: string;
  secret: string;
}

/** Two-step sign-in: switch on (scan, then type the first code) or off (type a current code). */
export function MfaPanel({ enabled }: { enabled: boolean }) {
  const [start, startAction, starting] = useActionState<ActionState, FormData>(startMfaAction, {});
  const [confirm, confirmAction, confirming] = useActionState<ActionState, FormData>(confirmMfaAction, {});
  const [off, offAction, turningOff] = useActionState<ActionState, FormData>(disableMfaAction, {});
  const setup = start.ok ? (start.data as Start) : null;

  if (enabled || confirm.ok) {
    return (
      <div className="space-y-4">
        {confirm.ok ? <Alert tone="success">{confirm.message}</Alert> : <p className="text-sm">Two-step sign-in is <strong>on</strong>. Signing in asks for a 6-digit code from your authenticator app.</p>}
        {off.error ? <Alert tone="danger">{off.error}</Alert> : null}
        {off.ok ? <Alert tone="success">{off.message}</Alert> : null}
        <form action={offAction} noValidate className="max-w-xs space-y-3">
          <TextField label="To switch it off, type a current code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} error={off.fieldErrors?.code?.[0]} />
          <Button type="submit" variant="secondary" disabled={turningOff}>
            {turningOff ? "Checking…" : "Switch off"}
          </Button>
        </form>
      </div>
    );
  }

  if (!setup) {
    return (
      <form action={startAction} className="space-y-3">
        <p className="text-sm">Adds a second step to signing in: after the password, a 6-digit code from an authenticator app on your phone. Even someone who learns the password cannot sign in without it.</p>
        {start.error ? <Alert tone="danger">{start.error}</Alert> : null}
        <Button type="submit" disabled={starting}>
          {starting ? "Starting…" : "Set up two-step sign-in"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator or similar) and add an account by scanning this picture.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- a one-off QR picture supplied as a data address */}
      <img src={setup.qr} alt="Picture to scan with your authenticator app" width={176} height={176} className="border border-border bg-white p-2" />
      <p className="text-sm text-text-muted">
        Cannot scan it? Type this key into the app instead: <code className="select-all break-all">{setup.secret}</code>
      </p>
      {confirm.error ? <Alert tone="danger">{confirm.error}</Alert> : null}
      <form action={confirmAction} noValidate className="max-w-xs space-y-3">
        <input type="hidden" name="factorId" value={setup.factorId} />
        <TextField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required error={confirm.fieldErrors?.code?.[0]} />
        <Button type="submit" disabled={confirming}>
          {confirming ? "Checking…" : "Turn on"}
        </Button>
      </form>
    </div>
  );
}
