"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { validation } from "@/lib/errors";
import { createQuotationSchema, decisionSchema, idOnlySchema, parseItems, updateQuotationSchema } from "@/lib/schemas/quotation";
import { idList, reqUuid } from "@/lib/validation";
import { attachQuotationFiles, createQuotation, decideQuotation, reviseQuotation, sendQuotation, updateQuotationDraft } from "@/server/quotations";

const refresh = (id?: string) => {
  revalidatePath("/app/quotations");
  if (id) revalidatePath(`/app/quotations/${id}`);
  revalidatePath("/app");
};

function items(raw: unknown[]) {
  const { items, errors } = parseItems(raw);
  if (errors.length) throw validation(errors[0]!, { itemsJson: errors });
  return items;
}

export async function createQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, createQuotationSchema, async (input, { actor }) => {
    const id = await createQuotation(actor!, { ...input, items: items(input.itemsJson as unknown[]) });
    refresh(id);
    return { redirectTo: `/app/quotations/${id}` };
  });
}

export async function updateQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, updateQuotationSchema, async (input, { actor }) => {
    await updateQuotationDraft(actor!, input.id, { ...input, items: items(input.itemsJson as unknown[]) });
    refresh(input.id);
    return { redirectTo: `/app/quotations/${input.id}` };
  });
}

export async function sendQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, idOnlySchema, async (input, { actor }) => {
    await sendQuotation(actor!, input.id);
    refresh(input.id);
    return { message: "Marked as sent. This version is now locked; changes need a new revision." };
  });
}

export async function decideQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, decisionSchema, async (input, { actor }) => {
    await decideQuotation(actor!, input.id, input.decision);
    refresh(input.id);
    return { message: input.decision === "accepted" ? "Quotation accepted." : "Quotation marked as rejected." };
  });
}

export async function reviseQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, idOnlySchema, async (input, { actor }) => {
    await reviseQuotation(actor!, input.id);
    refresh(input.id);
    return { redirectTo: `/app/quotations/${input.id}/edit` };
  });
}

export async function attachQuotationFilesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: reqUuid("quotation"), fileIds: idList(10) }), async (input, { actor }) => {
    await attachQuotationFiles(actor!, input.id, input.fileIds);
    refresh(input.id);
    return { message: "Files attached." };
  });
}
