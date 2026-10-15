import { z } from "zod";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import type { Fulfilment, OrderStatus, PaymentMethod } from "@/lib/order-constants";

/** The last digit of a new order number: a check digit (Luhn), so a mistyped number is recognised before any lookup. */
export function luhnValid(digits: string): boolean {
  let total = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
    double = !double;
  }
  return total % 10 === 0;
}

/**
 * What a customer types or sees is a number: nine digits for an order placed now ("482719364"), where the last digit is a check digit.
 * Orders placed before that were numbered "ORD-000123"; "ORD-000123", "ord 123" and "123" all still find them.
 * Returns the stored reference, or null when what was typed cannot be an order number.
 */
export function normaliseOrderRef(raw: string): string | null {
  const text = raw.trim();
  const legacy = /^ord[\s-]*(\d{1,6})$/i.exec(text) ?? /^(\d{1,6})$/.exec(text);
  if (legacy) return `ORD-${legacy[1]!.padStart(6, "0")}`;
  const digits = text.replace(/[\s-]/g, "");
  return /^[1-9]\d{8}$/.test(digits) && luhnValid(digits) ? digits : null;
}

/** How a customer sees an order number: just the digits ("ORD-000123" is shown as "000123"). Staff pages keep the stored reference. */
export const orderNumber = (reference: string) => reference.replace(/^ORD-/i, "");

/** The public "track my order" form: the order number. */
export const trackSchema = z.object({
  reference: z
    .string({ error: "Enter your order number." })
    .trim()
    .min(1, "Enter your order number.")
    .refine((v) => normaliseOrderRef(v) !== null, "Enter your order number, like 482719364.")
    .transform((v) => normaliseOrderRef(v)!),
  [HONEYPOT_FIELD]: z.string().optional(),
});
export type TrackInput = z.output<typeof trackSchema>;

/**
 * What a customer may see about their own order. Deliberately small: no address, phone, email, notes or staff details.
 * Dates are ISO strings so the object can cross from the server to the browser.
 */
export interface TrackedOrder {
  reference: string;
  status: OrderStatus;
  firstName: string;
  fulfilment: Fulfilment;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  currency: string;
  subtotal: string;
  deliveryCharge: string;
  total: string;
  placedAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  /** The day staff plan to deliver the order or have it ready, when they have set one. */
  scheduledFor: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: Array<{ name: string; label: string | null; quantity: number; lineTotal: string; imageUrl: string | null; imageAlt: string }>;
}
