import { z } from "zod";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import type { Fulfilment, OrderStatus, PaymentMethod } from "@/lib/order-constants";
import { reqPhone } from "@/lib/validation";

/** "ORD-000123", "ord 123" and "123" all mean the same order. Anything else is not an order number. */
export function normaliseOrderRef(raw: string): string | null {
  const m = /^(?:ord)?[\s-]*(\d{1,6})$/i.exec(raw.trim());
  return m ? `ORD-${m[1]!.padStart(6, "0")}` : null;
}

/** The public "track my order" form: the order number and the phone number given when ordering. */
export const trackSchema = z.object({
  reference: z
    .string({ error: "Enter your order number." })
    .trim()
    .min(1, "Enter your order number.")
    .refine((v) => normaliseOrderRef(v) !== null, "Enter your order number, like ORD-000123.")
    .transform((v) => normaliseOrderRef(v)!),
  phone: reqPhone,
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
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: Array<{ name: string; label: string | null; quantity: number; lineTotal: string }>;
}
