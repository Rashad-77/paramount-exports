import { z } from "zod";
import { LEAD_SOURCES } from "@/lib/crm";
import { checkbox, enumOf, optEmail, optEnum, optText, optUuid, reqDate, reqPhone, reqText, reqUuid } from "@/lib/validation";

export const CONTACT_METHODS = ["phone", "whatsapp", "email"] as const;
export const ACTIVITY_TYPES = ["call", "meeting", "showroom_visit", "message", "note"] as const;
export const ACTIVITY_LABEL: Record<string, string> = {
  call: "Call",
  meeting: "Meeting",
  showroom_visit: "Showroom visit",
  message: "Message",
  note: "Note",
  status_change: "Status change",
};

export const customerSchema = z.object({
  name: reqText("Name", 120),
  company: optText("Company", 120),
  phone: reqPhone,
  email: optEmail,
  address: optText("Address", 400),
  preferredContact: optEnum(CONTACT_METHODS, "contact method"),
  notes: optText("Notes", 2000),
  /** Ticked after the form has warned about a likely duplicate. */
  confirmDuplicate: checkbox,
});
export type CustomerInput = z.output<typeof customerSchema>;

export const manualLeadSchema = z.object({
  kind: enumOf(["general", "product_enquiry", "custom"] as const, "enquiry type"),
  source: enumOf(LEAD_SOURCES, "source"),
  name: reqText("Contact name", 120),
  phone: reqPhone,
  email: optEmail,
  preferredContact: optEnum(CONTACT_METHODS, "contact method"),
  message: optText("Details", 2000),
  customerId: optUuid("customer"),
  assignedTo: optUuid("team member"),
});
export type ManualLeadInput = z.output<typeof manualLeadSchema>;

export const activitySchema = z
  .object({
    leadId: optUuid("enquiry"),
    customerId: optUuid("customer"),
    type: enumOf(ACTIVITY_TYPES, "activity type"),
    body: reqText("Note", 2000),
  })
  .refine((v) => v.leadId || v.customerId, { message: "Choose an enquiry or customer.", path: ["body"] });
export type ActivityInput = z.output<typeof activitySchema>;

export const followUpSchema = z
  .object({
    leadId: optUuid("enquiry"),
    customerId: optUuid("customer"),
    assignedTo: reqUuid("team member"),
    title: reqText("What needs doing", 200),
    dueOn: reqDate("Due date"),
    notes: optText("Notes", 1000),
  })
  .refine((v) => v.leadId || v.customerId, { message: "Choose an enquiry or customer.", path: ["title"] });
export type FollowUpInput = z.output<typeof followUpSchema>;
