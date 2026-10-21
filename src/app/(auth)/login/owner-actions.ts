"use server";

import { cookies } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { OWNER_SEEN_COOKIE, ownerCookieBase } from "@/lib/auth/owner-session";
import { clientIp } from "@/lib/rate-limit";
import { ownerCodeSchema, ownerForgotSchema, ownerResetSchema } from "@/lib/schemas/owner-auth";
import { mfaVerifyLogin, requestOwnerPasswordReset, setOwnerPassword } from "@/server/owner-auth";

/** Only paths inside the staff area: never a full address (prevents being sent to another site after signing in). */
const safeNext = (next: string | undefined) => (next && /^\/app(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/app");

export async function ownerForgotAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    ownerForgotSchema,
    async (input, ctx) => {
      await requestOwnerPasswordReset(input.email, clientIp(ctx.headers));
      return { message: "If that is the owner's email, a link to choose a new password is on its way. Open it in this same browser." };
    },
    { public: true },
  );
}

export async function ownerResetAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    ownerResetSchema,
    async (input) => {
      await setOwnerPassword(input.newPassword);
      return { redirectTo: "/login?error=password-changed" };
    },
    { public: true },
  );
}

export async function ownerVerifyAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    ownerCodeSchema,
    async (input) => {
      await mfaVerifyLogin(input.code);
      (await cookies()).set(OWNER_SEEN_COOKIE, String(Date.now()), ownerCookieBase());
      return { redirectTo: safeNext(input.next) };
    },
    { public: true },
  );
}
