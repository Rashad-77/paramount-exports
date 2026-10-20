import { z } from "zod";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { checkbox, enumOf, optEmail, optText, reqPhone, reqText } from "@/lib/validation";

export * from "@/lib/order-constants";
import { MAX_LINES, MAX_QTY, FULFILMENT, ORDER_STATUSES, PAYMENT_METHODS } from "@/lib/order-constants";

/** The cart as it travels from the browser: only ids and quantities. Prices are always read from the database. */
export const cartLinesSchema = z
  .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(MAX_QTY) }))
  .min(1, "Your order is empty.")
  .max(MAX_LINES, `An order can have at most ${MAX_LINES} different items.`);
export type CartLines = z.infer<typeof cartLinesSchema>;

const cartField = z.string().transform((raw, ctx) => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    ctx.addIssue({ code: "custom", message: "Your order could not be read. Please reload the page." });
    return z.NEVER;
  }
  const parsed = cartLinesSchema.safeParse(value);
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Your order is empty." });
    return z.NEVER;
  }
  return parsed.data;
});

/** The public checkout form. There is no payment step: the customer chooses how they intend to pay and staff confirm the order. */
export const checkoutSchema = z
  .object({
    name: reqText("Your name", 120),
    phone: reqPhone,
    email: optEmail,
    fulfilment: enumOf(FULFILMENT, "delivery option"),
    address: optText("Delivery address", 400),
    paymentMethod: enumOf(PAYMENT_METHODS, "payment option"),
    note: optText("Note", 1000),
    cart: cartField,
    consent: checkbox,
    // Anti-spam fields (not stored)
    [HONEYPOT_FIELD]: z.string().optional(),
    formToken: z.string().optional(),
    "cf-turnstile-response": z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.consent) ctx.addIssue({ code: "custom", path: ["consent"], message: "Please agree to be contacted about this order." });
    if (v.fulfilment === "delivery" && !v.address) ctx.addIssue({ code: "custom", path: ["address"], message: "Enter the address we should deliver to." });
    if (v.fulfilment === "pickup" && v.paymentMethod === "on_delivery") {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Choose bank transfer or pay at the showroom for a showroom pickup." });
    }
    if (v.fulfilment === "delivery" && v.paymentMethod === "at_showroom") {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Choose pay on delivery or bank transfer for a delivery." });
    }
  });
export type CheckoutInput = z.output<typeof checkoutSchema>;

/** Staff: move an order to its next status, with an optional cancellation reason. */
export const orderStatusSchema = z.object({
  id: z.uuid(),
  status: enumOf(ORDER_STATUSES, "status"),
  reason: optText("Reason", 400),
});

/** Staff: the delivery charge agreed with the customer, the paid flag, and an internal note. */
export const orderDetailsSchema = z.object({
  id: z.uuid(),
  deliveryCharge: z.preprocess(
    (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? "0" : v),
    z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50."),
  ),
  staffNote: optText("Note", 1000),
  scheduledFor: z.preprocess((v) => (v === "" ? undefined : v), z.iso.date("Enter a valid date.").optional()),
  discountAmount: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 5000 or 5000.50.").optional()),
  discountPercent: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage like 10 or 12.5.").optional()),
  discountReason: optText("Reason", 200),
});

const money = (label: string) => z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, `Enter ${label} like 5000 or 5000.50.`);
const payMethod = z.enum(["cash", "bank_transfer", "card", "other"], { error: "Choose how it was paid." });
const jsonList = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string" || !v) return [];
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }, z.array(item).max(50));

/** Staff: money received for an order. */
export const paymentSchema = z.object({
  id: z.uuid(),
  amount: money("an amount"),
  method: payMethod,
  reference: optText("Reference", 120),
  note: optText("Note", 300),
  paidOn: z.preprocess((v) => (v === "" ? undefined : v), z.iso.date("Enter a valid date.").optional()),
});

/** Staff: money paid back and/or items that came back. */
export const refundSchema = z.object({
  id: z.uuid(),
  amount: z.preprocess((v) => (v === "" || v === undefined ? "0" : v), money("an amount")),
  method: payMethod,
  reason: reqText("Reason", 300),
  reference: optText("Reference", 120),
  returns: jsonList(z.object({ itemId: z.uuid(), quantity: z.number().int().min(0).max(99) })),
});

export const voidPaymentSchema = z.object({ paymentId: z.uuid(), reason: reqText("Reason", 300) });

/** Staff: change what is on an open order. */
export const itemsSchema = z.object({
  id: z.uuid(),
  changes: jsonList(z.object({ itemId: z.uuid(), quantity: z.number().int().min(0).max(MAX_QTY) })),
  add: jsonList(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(MAX_QTY) })),
});

/** Staff: the after-sales log. */
export const caseSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["complaint", "repair", "warranty", "other"], { error: "Choose what kind of case it is." }),
  title: reqText("Title", 140),
  details: optText("Details", 1000),
});
export const resolveCaseSchema = z.object({ caseId: z.uuid(), orderId: z.uuid(), resolution: optText("Resolution", 600), reopen: checkbox });

export const orderPaidSchema = z.object({ id: z.uuid(), paid: checkbox });
export const messageHandledSchema = z.object({ id: z.uuid(), handled: checkbox });
