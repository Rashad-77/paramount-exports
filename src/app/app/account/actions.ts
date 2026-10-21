"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { passwordChangeSchema, staffEmailSchema, staffNameSchema } from "@/lib/schemas/staff-account";
import { changeStaffEmail, changeStaffPassword, updateStaffName } from "@/server/staff-account";

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
