"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

type Tone = "success" | "danger" | "warning" | "info";
interface Toast {
  id: number;
  tone: Tone;
  text: string;
  title?: string;
  leaving: boolean;
}

/**
 * Messages that tell the person what just happened slide in from the top as a popup and go away by themselves. They float above the page, so
 * they never push the content around and never block it (only the toast itself can be clicked, to close it early).
 */
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const EMPTY: Toast[] = [];

const LEAVE_MS = 260;

export function dismissToast(id: number) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, LEAVE_MS);
}

export function toast(text: string, tone: Tone = "success", title?: string) {
  if (typeof window === "undefined" || !text) return;
  // The same message twice in a row shows once.
  if (toasts.some((t) => !t.leaving && t.text === text && t.tone === tone)) return;
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, tone, text, title, leaving: false }];
  emit();
  setTimeout(() => dismissToast(id), tone === "success" || tone === "info" ? 4500 : 9000);
}

const style: Record<Tone, { box: string; Icon: typeof Info }> = {
  success: { box: "border-success/40 bg-success-bg text-success", Icon: CheckCircle2 },
  danger: { box: "border-danger/40 bg-danger-bg text-danger", Icon: XCircle },
  warning: { box: "border-warning/40 bg-warning-bg text-warning", Icon: AlertTriangle },
  info: { box: "border-info/40 bg-info-bg text-info", Icon: Info },
};

/** Mounted once, in the root layout. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  const box = useRef<HTMLDivElement>(null);

  // A popover sits in the browser's top layer, so a toast also shows above an open dialog.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    try {
      if (list.length > 0) {
        if (el.matches(":popover-open")) el.hidePopover();
        el.showPopover();
      } else if (el.matches(":popover-open")) el.hidePopover();
    } catch {
      /* a browser without popovers still shows the toast, just beneath dialogs */
    }
  }, [list.length]);

  return (
    <div
      ref={box}
      popover="manual"
      aria-live="polite"
      className="toaster pointer-events-none fixed inset-x-0 top-3 m-0 flex w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4"
    >
      {list.map((t) => {
        const { box: tone, Icon } = style[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "danger" || t.tone === "warning" ? "alert" : "status"}
            className={cn("toast pointer-events-auto flex w-full max-w-md items-start gap-3 border p-3.5 shadow-lg", tone, t.leaving ? "toast-out" : "toast-in")}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1 text-sm text-text">
              {t.title ? <p className="font-semibold">{t.title}</p> : null}
              <p>{t.text}</p>
            </div>
            <button type="button" aria-label="Close message" onClick={() => dismissToast(t.id)} className="-m-1 shrink-0 p-1 text-text-muted hover:text-text">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Shows an action's result as a toast each time a new result arrives. */
export function useResultToast(state: ActionState | undefined) {
  useEffect(() => {
    if (!state) return;
    if (state.error) toast(state.error, "danger");
    else if (state.ok && state.message) toast(state.message, "success");
  }, [state]);
}

/** A message the server decided on before the page loaded (for example after a redirect), shown once as a toast. */
export function ToastOnMount({ message, tone = "success", title }: { message: string; tone?: Tone; title?: string }) {
  useEffect(() => {
    toast(message, tone, title);
  }, [message, tone, title]);
  return null;
}
