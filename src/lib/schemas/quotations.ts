import { z } from "zod";
import { FULFILMENT, PAYMENT_METHODS } from "@/lib/order-constants";
import { enumOf, money, optDate, optText, reqText, reqUuid } from "@/lib/validation";

/** The customer answers a price they were sent. */
export const quotationResponseSchema = z.object({
  reference: reqText("Quotation", 30),
  decision: enumOf(["accept", "decline"] as const, "answer"),
  reason: optText("Reason", 500),
});

/** Staff send the price. */
export const sendQuoteSchema = z.object({
  id: reqUuid("quotation"),
  amount: money("Price", { allowZero: false, max: 99_999_999 }),
  validUntil: optDate,
  note: optText("Note to the customer", 1500),
});

export const closeQuoteSchema = z.object({
  id: reqUuid("quotation"),
  reason: optText("Reason", 500),
});

/** Staff turn an accepted quotation into a confirmed order. */
export const quoteToOrderSchema = z
  .object({
    id: reqUuid("quotation"),
    fulfilment: enumOf(FULFILMENT, "delivery choice"),
    address: optText("Delivery address", 400),
    paymentMethod: enumOf(PAYMENT_METHODS, "payment method"),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === "delivery" && !v.address) ctx.addIssue({ code: "custom", path: ["address"], message: "Enter the delivery address, or choose collection." });
  });
