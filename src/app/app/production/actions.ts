"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { STAGE_LABEL } from "@/lib/production";
import {
  assigneesSchema,
  attachFilesSchema,
  consumptionSchema,
  issueSchema,
  jobDetailsSchema,
  labourSchema,
  planMaterialSchema,
  removePlanSchema,
  resolveIssueSchema,
  stageSchema,
} from "@/lib/schemas/production";
import { addIssue, attachJobFiles, changeStage, planMaterial, recordConsumption, recordLabour, removeMaterialPlan, resolveIssue, setAssignees, updateJobDetails } from "@/server/production";

const refresh = (jobId: string) => {
  revalidatePath("/app/production");
  revalidatePath(`/app/production/${jobId}`);
  revalidatePath("/app");
  revalidatePath("/app/stock");
  revalidatePath("/app/materials");
};

export async function changeStageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, stageSchema, async (input, { actor }) => {
    await changeStage(actor!, input.jobId, input.to, input.note);
    refresh(input.jobId);
    return { message: `Moved to “${STAGE_LABEL[input.to]}”.` };
  });
}

export async function updateJobDetailsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, jobDetailsSchema, async (input, { actor }) => {
    await updateJobDetails(actor!, input.jobId, input);
    refresh(input.jobId);
    return { message: "Job details saved." };
  });
}

export async function setAssigneesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, assigneesSchema, async (input, { actor }) => {
    await setAssignees(actor!, input.jobId, input.assigneeIds);
    refresh(input.jobId);
    return { message: "Assignment saved." };
  });
}

export async function addIssueAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, issueSchema, async (input, { actor }) => {
    await addIssue(actor!, input.jobId, input.type, input.note);
    refresh(input.jobId);
    return { message: "Recorded." };
  });
}

export async function resolveIssueAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, resolveIssueSchema, async (input, { actor }) => {
    await resolveIssue(actor!, input.issueId);
    refresh(input.jobId);
    return { message: "Marked as resolved." };
  });
}

export async function planMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, planMaterialSchema, async (input, { actor }) => {
    await planMaterial(actor!, input.jobId, input);
    refresh(input.jobId);
    return { message: "Material added to the plan." };
  });
}

export async function removePlanAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, removePlanSchema, async (input, { actor }) => {
    await removeMaterialPlan(actor!, input.planId);
    refresh(input.jobId);
    return { message: "Removed from the plan." };
  });
}

export async function recordConsumptionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, consumptionSchema, async (input, { actor }) => {
    const r = await recordConsumption(actor!, input);
    refresh(input.jobId);
    return { message: r.duplicate ? "That was already recorded — stock was not deducted again." : "Recorded. Stock has been reduced." };
  });
}

export async function recordLabourAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, labourSchema, async (input, { actor }) => {
    await recordLabour(actor!, input.jobId, input);
    refresh(input.jobId);
    return { message: "Labour recorded." };
  });
}

export async function attachFilesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, attachFilesSchema, async (input, { actor }) => {
    await attachJobFiles(actor!, input.jobId, input.fileIds);
    refresh(input.jobId);
    return { message: "Files attached." };
  });
}
