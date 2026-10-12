import { z } from "zod";
import { ISSUE_TYPES, JOB_STAGES, PRIORITIES } from "@/lib/production";
import { checkbox, enumOf, idList, optDate, optMoney, optText, quantity, reqText, reqUuid } from "@/lib/validation";

export const stageSchema = z.object({ jobId: reqUuid("job"), to: enumOf(JOB_STAGES, "stage"), note: optText("Note", 500) });

export const jobDetailsSchema = z.object({
  jobId: reqUuid("job"),
  description: reqText("Description", 300),
  priority: enumOf(PRIORITIES, "priority"),
  targetDate: optDate,
});

export const assigneesSchema = z.object({ jobId: reqUuid("job"), assigneeIds: idList(20) });

export const issueSchema = z.object({ jobId: reqUuid("job"), type: enumOf(ISSUE_TYPES, "issue type"), note: reqText("Description", 500) });
export const resolveIssueSchema = z.object({ jobId: reqUuid("job"), issueId: reqUuid("issue") });

export const planMaterialSchema = z.object({ jobId: reqUuid("job"), itemId: reqUuid("material"), plannedQuantity: quantity("Planned quantity"), estimatedUnitCost: optMoney("Estimated cost"), note: optText("Note", 200) });
export const removePlanSchema = z.object({ jobId: reqUuid("job"), planId: reqUuid("plan line") });

const optQty = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), quantity("Wasted quantity", { allowZero: true }).optional());
export const consumptionSchema = z.object({
  jobId: reqUuid("job"),
  itemId: reqUuid("material"),
  locationId: reqUuid("location"),
  quantity: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? "0" : v), quantity("Quantity used", { allowZero: true })),
  wasteQuantity: optQty,
  note: optText("Note", 300),
  requestKey: reqUuid("submission key"),
});

export const labourSchema = z.object({
  jobId: reqUuid("job"),
  description: reqText("What was done", 200),
  hours: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), quantity("Hours").optional()),
  hourlyRate: optMoney("Hourly rate"),
  amount: optMoney("Amount"),
});

export const attachFilesSchema = z.object({ jobId: reqUuid("job"), fileIds: idList(5) });

export const productionSettingsFormSchema = z.object({ createsFinishedStock: checkbox, trackLabour: checkbox });
