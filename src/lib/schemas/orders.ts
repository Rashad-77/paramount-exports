import { z } from "zod";
import { enumOf, money, optDate, optText, reqUuid } from "@/lib/validation";

export const ORDER_STATUSES = ["draft", "confirmed", "preparing", "ready", "delivered", "cancelled"] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "cheque", "other"] as const;
export const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = { cash: "Cash", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" };

export const orderTypeLabel = (t: string) => (t === "custom" ? "Custom order" : "Ready-made order");

/** Same status, wording that suits the kind of order. Production never changes these by itself. */
export function orderStatusLabel(status: OrderStatusValue, type: string): string {
  const custom = type === "custom";
  switch (status) {
    case "draft":
      return "Draft";
    case "confirmed":
      return "Confirmed";
    case "preparing":
      return custom ? "In production" : "Preparing";
    case "ready":
      return "Ready for delivery / pickup";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
  }
}

export const orderItemsJson = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return undefined;
    }
  },
  z.array(z.unknown(), { error: "Add at least one item." }).min(1, "Add at least one item.").max(60),
);

export const orderBodySchema = z.object({
  locationId: reqUuid("location"),
  deliveryCharge: z.preprocess((v) => (v === "" || v === undefined ? "0" : v), money("Delivery charge")),
  depositTerms: optText("Deposit and payment terms", 500),
  notes: optText("Notes", 2000),
  itemsJson: orderItemsJson,
});
export const createOrderSchema = orderBodySchema.extend({ customerId: reqUuid("customer") });
export const updateOrderSchema = orderBodySchema.extend({ id: reqUuid("order") });

export const termsSchema = z.object({ id: reqUuid("order"), depositTerms: optText("Deposit and payment terms", 500), requestedCompletionDate: optDate, notes: optText("Notes", 2000) });
export const orderIdSchema = z.object({ id: reqUuid("order") });
export const advanceSchema = z.object({ id: reqUuid("order"), to: enumOf(["preparing", "ready", "delivered"] as const, "status") });
export const cancelSchema = z.object({ id: reqUuid("order"), reason: z.string({ error: "Say why the order is being cancelled." }).trim().min(1, "Say why the order is being cancelled.").max(300) });
export const paymentSchema = z.object({
  orderId: reqUuid("order"),
  amount: money("Amount", { allowZero: false }),
  method: enumOf(PAYMENT_METHODS, "payment method"),
  reference: optText("Reference", 100),
  note: optText("Note", 300),
});
export const voidSchema = z.object({ paymentId: reqUuid("payment"), orderId: reqUuid("order"), reason: z.string({ error: "Say why this payment is being voided." }).trim().min(1, "Say why this payment is being voided.").max(300) });
export const convertSchema = z.object({ quotationId: reqUuid("quotation"), locationId: z.preprocess((v) => (v === "" ? undefined : v), reqUuid("location").optional()), depositTerms: optText("Deposit and payment terms", 500), requestedCompletionDate: optDate, notes: optText("Notes", 2000) });
