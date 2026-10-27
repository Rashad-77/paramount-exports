"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { clientIp } from "@/lib/rate-limit";
import { ownerForgotSchema, ownerResetSchema } from "@/lib/schemas/owner-auth";
import { requestOwnerPasswordReset, setOwnerPassword } from "@/server/owner-auth";

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
