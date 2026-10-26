import { z } from "zod";
import { joinAddress } from "@/lib/address-lines";
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
    // The delivery address is asked for in parts, like the address form in the account. A full address in one piece is still accepted.
    address: optText("Delivery address", 400),
    line1: optText("Address line 1", 120),
    line2: optText("Address line 2", 120),
    line3: optText("Address line 3", 120),
    city: optText("City", 80),
    postalCode: optText("Postal code", 20),
    paymentMethod: enumOf(PAYMENT_METHODS, "payment option"),
    note: optText("Note", 1000),
    cart: cartField,
    // Anti-spam fields (not stored)
    [HONEYPOT_FIELD]: z.string().optional(),
    formToken: z.string().optional(),
    "cf-turnstile-response": z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === "delivery" && !v.address) {
      if (!v.line1) ctx.addIssue({ code: "custom", path: ["line1"], message: "Enter the first line of the address we should deliver to." });
      if (!v.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Enter the city." });
      if (!v.postalCode) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter the postal code." });
    }
    if (v.fulfilment === "pickup" && v.paymentMethod === "on_delivery") {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Choose bank transfer or pay at the showroom for a showroom pickup." });
    }
    if (v.fulfilment === "delivery" && v.paymentMethod === "at_showroom") {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Choose pay on delivery or bank transfer for a delivery." });
    }
  })
  // The parts become the one stored address (five lines, as in the account), and only a delivery has one.
  .transform((v) => {
    const { line1, line2, line3, city, postalCode, ...rest } = v;
    const address = v.fulfilment !== "delivery" ? undefined : line1 ? joinAddress({ line1, line2: line2 ?? "", line3: line3 ?? "", city: city ?? "", postalCode: postalCode ?? "" }) : v.address;
    return { ...rest, address };
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

/** Owner: undo a payment entered by mistake. */
export const voidPaymentSchema = z.object({ paymentId: z.uuid(), reason: reqText("Reason", 300) });

export const orderPaidSchema = z.object({ id: z.uuid(), paid: checkbox });
export const messageHandledSchema = z.object({ id: z.uuid(), handled: checkbox });
