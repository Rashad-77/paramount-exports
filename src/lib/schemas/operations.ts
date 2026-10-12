import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/schemas/orders";
import { checkbox, enumOf, idList, money, optDate, optText, optUuid, reqDate, reqPhone, reqText, reqUuid } from "@/lib/validation";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optTime = z.preprocess(emptyToUndefined, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 14:30.").optional());

/* deliveries */
export const DELIVERY_STATUS_LABEL = { planned: "Planned", out_for_delivery: "Out for delivery", delivered: "Delivered", failed: "Failed" } as const;
export type DeliveryStatusValue = keyof typeof DELIVERY_STATUS_LABEL;
export const DELIVERY_STATUSES = Object.keys(DELIVERY_STATUS_LABEL) as [DeliveryStatusValue, ...DeliveryStatusValue[]];

const deliveryBody = {
  scheduledOn: reqDate("Delivery date"),
  windowStart: optTime,
  windowEnd: optTime,
  addressLine: reqText("Delivery address", 400),
  contactName: reqText("Contact name", 120),
  contactPhone: reqPhone,
  fee: z.preprocess((v) => (v === "" || v === undefined ? "0" : v), money("Fee")),
  assigneeId: optUuid("staff member"),
  notes: optText("Notes", 500),
};
export const deliverySchema = z.object({ orderId: reqUuid("order"), ...deliveryBody });
export const deliveryUpdateSchema = z.object({ id: reqUuid("delivery"), ...deliveryBody });
export const deliveryStatusSchema = z.object({ id: reqUuid("delivery"), to: z.enum(["out_for_delivery", "delivered", "failed"]), note: optText("Note", 500), proofFileIds: idList(3) });
export const rescheduleSchema = z.object({ id: reqUuid("delivery"), scheduledOn: reqDate("New date"), windowStart: optTime, windowEnd: optTime, assigneeId: optUuid("staff member"), notes: optText("Notes", 500) });

/* expenses */
export const expenseSchema = z.object({
  spentOn: reqDate("Date"),
  categoryId: reqUuid("category"),
  amount: money("Amount", { allowZero: false }),
  description: reqText("What it was for", 300),
  payee: optText("Paid to", 160),
  method: enumOf(PAYMENT_METHODS, "method"),
  reference: optText("Reference", 120),
  fileIds: idList(5),
});
export const expenseVoidSchema = z.object({ id: reqUuid("expense"), reason: reqText("Reason", 300) });
export const expenseCategorySchema = z.object({ id: optUuid("category"), name: reqText("Category name", 80), isActive: checkbox });

/* after-sales */
export const CASE_TYPES = ["warranty", "repair", "complaint"] as const;
export const CASE_TYPE_LABEL = { warranty: "Warranty", repair: "Repair", complaint: "Complaint" } as const;
export const CASE_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const CASE_STATUS_LABEL = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" } as const;
export const caseSchema = z.object({ customerId: reqUuid("customer"), orderId: optUuid("order"), type: enumOf(CASE_TYPES, "type"), subject: reqText("Subject", 160), description: optText("Details", 2000), assigneeId: optUuid("staff member"), dueOn: optDate });
export const caseUpdateSchema = z.object({ id: reqUuid("case"), subject: reqText("Subject", 160), description: optText("Details", 2000), assigneeId: optUuid("staff member"), dueOn: optDate });
export const caseStatusSchema = z.object({ id: reqUuid("case"), to: enumOf(CASE_STATUSES, "status"), resolution: optText("Resolution", 2000), note: optText("Note", 500) });
export const caseNoteSchema = z.object({ id: reqUuid("case"), body: reqText("Note", 2000) });

