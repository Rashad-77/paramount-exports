import { z } from "zod";
import { checkbox, money, optText, optUuid, quantity, reqDate, reqText, reqUuid } from "@/lib/validation";

export const ITEM_KINDS = ["ready_made", "custom"] as const;
export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "rejected", "expired", "converted"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted to order",
};

export const quotationItemSchema = z
  .object({
    kind: z.enum(ITEM_KINDS, { error: "Choose ready-made or custom." }),
    variantId: optUuid("product"),
    description: reqText("Item description", 500),
    dimensions: optText("Dimensions", 200),
    material: optText("Wood / material", 120),
    finish: optText("Finish", 120),
    notes: optText("Specification notes", 1000),
    quantity: quantity("Quantity"),
    unitPrice: money("Unit price"),
    discountAmount: z.preprocess((v) => (v === "" || v === undefined || v === null ? "0" : v), money("Discount")),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "ready_made" && !v.variantId) ctx.addIssue({ code: "custom", path: ["variantId"], message: "Choose the product for a ready-made item." });
  });
export type QuotationItemInput = z.output<typeof quotationItemSchema>;

/** The editor posts its line items as one JSON field; each row is validated with the schema above. */
const itemsJson = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return undefined;
    }
  },
  z.array(z.unknown(), { error: "Add at least one item." }).min(1, "Add at least one item.").max(60, "Too many items."),
);

export const quotationBodySchema = z.object({
  validUntil: reqDate("Valid-until date"),
  deliveryCharge: z.preprocess((v) => (v === "" || v === undefined ? "0" : v), money("Delivery charge")),
  terms: optText("Terms", 4000),
  customerNotes: optText("Notes for the customer", 2000),
  internalNotes: optText("Internal notes", 2000),
  itemsJson,
});

export const createQuotationSchema = quotationBodySchema.extend({ customerId: reqUuid("customer"), leadId: optUuid("enquiry") });
export const updateQuotationSchema = quotationBodySchema.extend({ id: reqUuid("quotation") });

export interface QuotationDraftInput {
  validUntil: string;
  deliveryCharge: string;
  terms?: string;
  customerNotes?: string;
  internalNotes?: string;
  items: QuotationItemInput[];
}

/** Validate every row and report which line failed (1-based) so the editor can say "Item 2: …". */
export function parseItems(raw: unknown[]): { items: QuotationItemInput[]; errors: string[] } {
  const items: QuotationItemInput[] = [];
  const errors: string[] = [];
  raw.forEach((row, i) => {
    const r = quotationItemSchema.safeParse(row);
    if (r.success) items.push(r.data);
    else for (const issue of r.error.issues) errors.push(`Item ${i + 1}: ${issue.message}`);
  });
  return { items, errors };
}

export const decisionSchema = z.object({ id: reqUuid("quotation"), decision: z.enum(["accepted", "rejected"]) });
export const idOnlySchema = z.object({ id: reqUuid("quotation") });
export { checkbox };
