"use client";

import { createContext, useActionState, useContext, type ComponentProps, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const Ctx = createContext<{ state: ActionState; pending: boolean }>({ state: {}, pending: false });
export const useFormState = () => useContext(Ctx);

/**
 * Form wired to a Server Action. Shows a summary error/success message, and exposes per-field errors and
 * echoed values to the F* field components below. Works without JavaScript for the submit itself.
 */
export function ActionForm({
  action,
  children,
  className,
  hideOnSuccess = false,
  successTitle,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Replace the form with the success message (used by public enquiry forms). */
  hideOnSuccess?: boolean;
  successTitle?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok && hideOnSuccess) {
    return (
      <Alert tone="success" title={successTitle ?? "Thank you"}>
        {state.message}
      </Alert>
    );
  }
  return (
    <form
      action={formAction}
      noValidate
      className={cn("space-y-5", className)}
      onSubmit={(e) => {
        // A file transfer is still running: do not submit yet (the uploader shows a waiting message).
        if (e.currentTarget.dataset.uploading === "true") e.preventDefault();
      }}
    >
      <Ctx.Provider value={{ state, pending }}>
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
        {children}
      </Ctx.Provider>
    </form>
  );
}

type Shared = { name: string };

export function FField({ name, defaultValue, ...props }: Shared & Omit<ComponentProps<typeof TextField>, "name" | "error">) {
  const { state } = useFormState();
  return <TextField name={name} defaultValue={state.values?.[name] ?? defaultValue} error={state.fieldErrors?.[name]?.[0]} {...props} />;
}

export function FTextArea({ name, defaultValue, ...props }: Shared & Omit<ComponentProps<typeof TextAreaField>, "name" | "error">) {
  const { state } = useFormState();
  return <TextAreaField name={name} defaultValue={state.values?.[name] ?? defaultValue} error={state.fieldErrors?.[name]?.[0]} {...props} />;
}

export function FSelect({ name, defaultValue, ...props }: Shared & Omit<ComponentProps<typeof SelectField>, "name" | "error">) {
  const { state } = useFormState();
  return <SelectField name={name} defaultValue={state.values?.[name] ?? defaultValue} error={state.fieldErrors?.[name]?.[0]} {...props} />;
}

export function FCheckbox({ name, label, hint, defaultChecked }: Shared & { label: string; hint?: string; defaultChecked?: boolean }) {
  const { state } = useFormState();
  const checked = state.values ? name in state.values : defaultChecked;
  const error = state.fieldErrors?.[name]?.[0];
  return (
    <div>
      <label className="flex min-h-10 items-start gap-3 text-sm">
        <input
          type="checkbox"
          name={name}
          defaultChecked={checked}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-walnut)]"
        />
        <span>
          <span className="font-medium">{label}</span>
          {hint ? <span className="block text-text-muted">{hint}</span> : null}
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant,
  size,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const { pending } = useFormState();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
