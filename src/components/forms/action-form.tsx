"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";
import { DateField } from "./date-field";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const OFFLINE_MESSAGE = "We could not reach the server. Check your connection and press the button again. Everything you typed has been kept.";
const SECRET_FIELD = /password|token|secret/i;

/**
 * Runs the Server Action, but never lets a dropped connection or a server hiccup throw the page away: the typed values come
 * back with a plain message instead. Redirects and other framework signals (they carry a "NEXT_" digest) pass straight through.
 */
function guarded(action: Action): Action {
  return async (prev, formData) => {
    try {
      return await action(prev, formData);
    } catch (error) {
      const digest = (error as { digest?: unknown } | null)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
      const values: Record<string, string> = {};
      for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$ACTION") && !SECRET_FIELD.test(k)) values[k] = v;
      return { error: OFFLINE_MESSAGE, values };
    }
  };
}

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
  const [state, formAction, pending] = useActionState(guarded(action), {});
  const form = useRef<HTMLFormElement>(null);
  const alert = useRef<HTMLDivElement>(null);

  // Unsaved changes: what the form held just before the person first touched it, compared with what it holds now. Leaving the page
  // (closing the tab, reloading, or following a link) with a difference asks first.
  const base = useRef<string | null>(null);
  const busy = useRef(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const snapshot = (f: HTMLFormElement) => JSON.stringify([...new FormData(f).entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$ACTION")));
  const hasUnsaved = () => base.current !== null && !busy.current && form.current !== null && snapshot(form.current) !== base.current;
  const touch = () => {
    if (base.current === null && form.current) base.current = snapshot(form.current);
  };
  useEffect(() => {
    busy.current = pending;
  }, [pending]);
  useEffect(() => {
    // A saved form starts again from what it now holds.
    if (state.ok) base.current = null;
  }, [state]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onLink = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      if (!hasUnsaved()) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onLink, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a failed attempt, take the person to the problem: the first field that needs fixing, or else the message at the top.
  useEffect(() => {
    if (state.ok || (!state.error && !state.fieldErrors)) return;
    const bad = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target = bad ?? alert.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [state]);

  if (state.ok && hideOnSuccess) {
    return (
      <Alert tone="success" title={successTitle ?? "Thank you"}>
        {state.message}
      </Alert>
    );
  }
  return (
    <>
    <form
      ref={form}
      action={formAction}
      noValidate
      className={cn("space-y-5", className)}
      onPointerDownCapture={touch}
      onKeyDownCapture={touch}
      onSubmit={(e) => {
        // A file transfer is still running: do not submit yet (the uploader shows a waiting message).
        // A submit already in flight is never sent twice (a second tap, or Enter pressed again).
        if (e.currentTarget.dataset.uploading === "true" || pending) e.preventDefault();
      }}
    >
      <Ctx.Provider value={{ state, pending }}>
        {state.error ? (
          <div ref={alert} tabIndex={-1} className="outline-none">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
        {children}
      </Ctx.Provider>
    </form>
    <ConfirmDialog
      open={leaveTo !== null}
      onClose={() => setLeaveTo(null)}
      title="Leave this page?"
      description="You have changes that are not saved. If you leave now they will be lost."
      confirmLabel="Leave"
      destructive
      onConfirm={() => {
        const to = leaveTo;
        setLeaveTo(null);
        base.current = null;
        if (to) window.location.assign(to);
      }}
    />
    </>
  );
}

type Shared = { name: string };

export function FField({ name, defaultValue, ...props }: Shared & Omit<ComponentProps<typeof TextField>, "name" | "error">) {
  const { state } = useFormState();
  if (props.type === "date") {
    const { type: _type, min, max, ...rest } = props;
    void _type;
    return <DateField name={name} defaultValue={String(state.values?.[name] ?? defaultValue ?? "")} min={min as string | undefined} max={max as string | undefined} error={state.fieldErrors?.[name]?.[0]} {...rest} />;
  }
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

/**
 * Shown only after the server has warned that a record looks like a duplicate: lets the person confirm
 * "this really is a different customer". (The warning text itself appears in the form's alert.)
 */
export function DuplicateConfirm({ name = "confirmDuplicate", label = "Create anyway — this is a different person" }: { name?: string; label?: string }) {
  const { state } = useFormState();
  if (!state.fieldErrors?.[name]) return null;
  return (
    <label className="flex min-h-10 items-start gap-3 border border-warning/40 bg-warning-bg p-3 text-sm">
      <input type="checkbox" name={name} className="mt-0.5 size-5 shrink-0 accent-[var(--color-walnut)]" />
      <span className="font-medium">{label}</span>
    </label>
  );
}
