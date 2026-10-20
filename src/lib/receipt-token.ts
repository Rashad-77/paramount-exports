import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { hashingSalt } from "@/lib/rate-limit";

/**
 * A customer's receipt link carries a signed token tied to the order and the phone number it was placed with, so the order number alone
 * cannot open someone else's receipt. The link is handed out only on pages that already proved who the customer is (their account, or the
 * order-number-and-phone lookup).
 */
const mac = (orderId: string, phoneKey: string) => createHmac("sha256", hashingSalt()).update(`receipt|${orderId}|${phoneKey}`).digest("base64url");

export const receiptPath = (o: { id: string; reference: string; phoneKey: string }) => `/receipt/${o.reference}?t=${mac(o.id, o.phoneKey)}`;

export function receiptTokenValid(o: { id: string; phoneKey: string }, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(mac(o.id, o.phoneKey));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
