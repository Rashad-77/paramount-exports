"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { activitySchema, followUpSchema, manualLeadSchema } from "@/lib/schemas/crm";
import { checkbox, idList, reqUuid } from "@/lib/validation";
import { addActivity, attachLeadFiles, completeFollowUp, createFollowUp, createLeadManual } from "@/server/crm";
import { createCustomerFromLead, linkLeadToCustomer } from "@/server/customers";

const touch = (leadId?: string, customerId?: string) => {
  if (leadId) revalidatePath(`/app/leads/${leadId}`);
  if (customerId) revalidatePath(`/app/customers/${customerId}`);
  revalidatePath("/app/follow-ups");
  revalidatePath("/app");
};

export async function createLeadAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, manualLeadSchema.extend({ fileIds: idList(5) }), async (input, { actor }) => {
    const { id } = await createLeadManual(actor!, input, input.fileIds);
    revalidatePath("/app/leads");
    return { redirectTo: `/app/leads/${id}` };
  });
}

export async function addActivityAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, activitySchema, async (input, { actor }) => {
    await addActivity(actor!, input);
    touch(input.leadId, input.customerId);
    return { message: "Recorded." };
  });
}

export async function createFollowUpAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, followUpSchema, async (input, { actor }) => {
    await createFollowUp(actor!, input);
    touch(input.leadId, input.customerId);
    return { message: "Follow-up added." };
  });
}

export async function completeFollowUpAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: reqUuid("follow-up"), leadId: z.string().optional(), customerId: z.string().optional() }), async (input, { actor }) => {
    await completeFollowUp(actor!, input.id);
    touch(input.leadId || undefined, input.customerId || undefined);
    return { message: "Marked done." };
  });
}

export async function linkCustomerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ leadId: reqUuid("enquiry"), customerId: reqUuid("customer") }), async (input, { actor }) => {
    await linkLeadToCustomer(actor!, input.leadId, input.customerId);
    touch(input.leadId, input.customerId);
    return { message: "Linked to the customer." };
  });
}

export async function createCustomerFromLeadAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ leadId: reqUuid("enquiry"), confirmDuplicate: checkbox }), async (input, { actor }) => {
    const customerId = await createCustomerFromLead(actor!, input.leadId, { confirmDuplicate: input.confirmDuplicate });
    touch(input.leadId, customerId);
    return { message: "Customer created and linked." };
  });
}

export async function attachLeadFilesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ leadId: reqUuid("enquiry"), fileIds: idList(5) }), async (input, { actor }) => {
    await attachLeadFiles(actor!, input.leadId, input.fileIds);
    touch(input.leadId);
    return { message: "Files attached." };
  });
}
