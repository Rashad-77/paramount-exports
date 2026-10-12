import "server-only";
import { randomUUID } from "node:crypto";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getActor } from "@/lib/auth/session";
import type { Actor } from "@/lib/auth/permissions";
import { AppError, GENERIC_ERROR_MESSAGE } from "@/lib/errors";

export interface ActionOutcome {
  /** Navigate here after success (PRG pattern). */
  redirectTo?: string;
  /** Shown above the form after success when not redirecting. */
  message?: string;
}

export interface ActionContext {
  actor: Actor | null;
  headers: Headers;
  formData: FormData;
}

const SECRET_FIELD = /password|token|secret/i;

export function formDataToObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue; // files go through the signed-upload flow, never through actions
    if (key.startsWith("$ACTION")) continue; // React internals
    const prev = out[key];
    out[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return out;
}

function echoValues(raw: Record<string, string | string[]>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (!SECRET_FIELD.test(k) && typeof v === "string") values[k] = v;
  return values;
}

/**
 * Parse + validate form input, run the handler, and translate any failure into an ActionState.
 * - Validation errors become per-field messages.
 * - AppErrors show their (safe) message; anything else is logged with a reference and shown generically.
 * - Staff actions need a signed-in actor; pass { public: true } for visitor forms.
 * Authorization itself is enforced inside the services the handler calls.
 */
export async function runAction<S extends z.ZodType>(
  formData: FormData,
  schema: S,
  handler: (input: z.output<S>, ctx: ActionContext) => Promise<ActionOutcome | void>,
  opts: { public?: boolean } = {},
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const values = echoValues(raw);

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: z.flattenError(parsed.error as z.ZodError).fieldErrors as Record<string, string[]>,
      values,
    };
  }

  let outcome: ActionOutcome | void;
  try {
    const actor = opts.public ? null : await getActor();
    if (!opts.public && !actor) return { error: "Your session has ended. Please sign in again.", values };
    outcome = await handler(parsed.data, { actor, headers: await nextHeaders(), formData });
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message, fieldErrors: error.fieldErrors, values };
    }
    const ref = randomUUID().slice(0, 8);
    console.error(`Unexpected action error [${ref}]`, error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error);
    return { error: `${GENERIC_ERROR_MESSAGE} (reference ${ref})`, values };
  }

  if (outcome?.redirectTo) redirect(outcome.redirectTo);
  return { ok: true, message: outcome?.message };
}
