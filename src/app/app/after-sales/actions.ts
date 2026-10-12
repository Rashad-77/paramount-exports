"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { caseNoteSchema, caseSchema, caseStatusSchema, caseUpdateSchema } from "@/lib/schemas/operations";
import { addCaseNote, changeCaseStatus, createCase, updateCase } from "@/server/aftersales";

const refresh = (id?: string) => {
  revalidatePath("/app/after-sales");
  revalidatePath("/app/reports");
  if (id) revalidatePath(`/app/after-sales/${id}`);
};

export async function createCaseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, caseSchema, async (input, { actor }) => {
    const id = await createCase(actor!, input);
    refresh(id);
    return { redirectTo: `/app/after-sales/${id}` };
  });
}

export async function updateCaseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, caseUpdateSchema, async (input, { actor }) => {
    await updateCase(actor!, input.id, input);
    refresh(input.id);
    return { message: "Case saved." };
  });
}

export async function caseStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, caseStatusSchema, async (input, { actor }) => {
    await changeCaseStatus(actor!, input.id, input.to, input);
    refresh(input.id);
    return { message: "Status updated." };
  });
}

export async function caseNoteAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, caseNoteSchema, async (input, { actor }) => {
    await addCaseNote(actor!, input.id, input.body);
    refresh(input.id);
    return { message: "Note added." };
  });
}
