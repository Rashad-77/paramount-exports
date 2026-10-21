"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { ownerCodeSchema, ownerEnrollSchema } from "@/lib/schemas/owner-auth";
import { passwordChangeSchema, staffEmailSchema, staffNameSchema } from "@/lib/schemas/staff-account";
import { mfaDisable, mfaFinishEnroll, mfaStartEnroll } from "@/server/owner-auth";
import { changeStaffEmail, changeStaffPassword, updateStaffName } from "@/server/staff-account";
import { z } from "zod";

export async function updateNameAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, staffNameSchema, async (input, { actor }) => {
    await updateStaffName(actor!, input.fullName);
    revalidatePath("/app", "layout");
    return { message: "Your name is saved." };
  });
}

export async function changeEmailAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, staffEmailSchema, async (input, { actor }) => {
    await changeStaffEmail(actor!, input.email);
    return { message: `A confirmation link has been sent to ${input.email}. Your sign-in email changes once you open it.` };
  });
}

export async function changePasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, passwordChangeSchema, async (input, { actor }) => {
    await changeStaffPassword(actor!, input.currentPassword, input.newPassword);
    return { message: "Your password is changed." };
  });
}

/** Step 1 of switching on the authenticator code: hand back the picture and the typed key. */
export async function startMfaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({}), async () => ({ data: await mfaStartEnroll() }));
}

/** Step 2: the first code from the app proves it was added correctly. */
export async function confirmMfaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, ownerEnrollSchema, async (input) => {
    await mfaFinishEnroll(input.factorId, input.code);
    revalidatePath("/app/account");
    return { message: "Two-step sign-in is on. From now on, signing in asks for a code from your app." };
  });
}

export async function disableMfaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, ownerCodeSchema, async (input) => {
    await mfaDisable(input.code);
    revalidatePath("/app/account");
    return { message: "Two-step sign-in is off." };
  });
}
