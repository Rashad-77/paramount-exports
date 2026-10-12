"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { LEAD_STATUSES } from "@/lib/crm";
import { enumOf, optText, optUuid, reqUuid } from "@/lib/validation";
import { assignLead, changeLeadStatus } from "@/server/leads";

const assignSchema = z.object({ id: reqUuid("enquiry"), assigneeId: optUuid("team member") });
export async function assignLeadAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, assignSchema, async (input, { actor }) => {
    await assignLead(actor!, input.id, input.assigneeId ?? null);
    revalidatePath(`/app/leads/${input.id}`);
    revalidatePath("/app/leads");
    return { message: input.assigneeId ? "Assigned." : "Unassigned." };
  });
}

const statusSchema = z.object({ id: reqUuid("enquiry"), status: enumOf(LEAD_STATUSES, "status"), lostReason: optText("Reason", 300) });
export async function changeLeadStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, statusSchema, async (input, { actor }) => {
    await changeLeadStatus(actor!, input.id, input.status, input.lostReason);
    revalidatePath(`/app/leads/${input.id}`);
    revalidatePath("/app/leads");
    return { message: "Status updated." };
  });
}
