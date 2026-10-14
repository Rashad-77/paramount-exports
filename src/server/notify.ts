import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/lib/db/client";
import { orderItems, orders, messages } from "@/lib/db/schema";
import { publicEnv, serverEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";

/**
 * Tells the owner by email that something has arrived. It never gets in the customer's way: it runs after the reply has gone, and any
 * failure (no key set, the mail service down) is logged and forgotten. Orders and messages are always saved first.
 */
async function sendToOwner(subject: string, text: string): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return; // not set up yet: nothing is sent
  const business = await getBusinessSettings();
  const to = business.notifyEmail ?? business.email;
  if (!to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) console.error(`[notify] the mail service refused the email (${res.status})`);
}

/** Runs the work once the response is sent; where there is no request (tests, scripts) it simply runs. */
function later(work: () => Promise<void>): void {
  const run = () => work().catch((e) => console.error("[notify] could not send:", e instanceof Error ? e.message : "unknown error"));
  try {
    after(run);
  } catch {
    void run();
  }
}

const staffLink = (path: string) => `${publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${path}`;

export function notifyNewOrder(orderId: string): void {
  later(async () => {
    const db = getDb();
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!o) return;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.position);
    const lines = items.map((i) => `  ${i.quantity} x ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""} - ${formatMoney(i.lineTotal, o.currency)}`);
    await sendToOwner(
      `New order ${o.reference} - ${o.customerName}`,
      [
        `A new order has come in on the website.`,
        ``,
        `Order: ${o.reference}`,
        `Customer: ${o.customerName}`,
        `Phone: ${o.phone}`,
        o.email ? `Email: ${o.email}` : null,
        o.fulfilment === "delivery" ? `Delivery to: ${o.address}` : `The customer will collect it from the showroom.`,
        `Pays by: ${o.paymentMethod === "bank_transfer" ? "bank transfer" : o.paymentMethod === "at_showroom" ? "at the showroom" : "cash on delivery"}`,
        ``,
        ...lines,
        ``,
        `Total so far: ${formatMoney(o.total, o.currency)} (delivery charge to be agreed)`,
        o.customerNote ? `\nNote from the customer: ${o.customerNote}` : null,
        ``,
        `Please call the customer to confirm. Open the order: ${staffLink(`/app/orders/${o.id}`)}`,
      ]
        .filter((l): l is string => l !== null)
        .join("\n"),
    );
  });
}

export function notifyNewMessage(messageId: string): void {
  later(async () => {
    const [m] = await getDb().select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!m) return;
    const what = m.kind === "custom" ? "quotation request" : m.kind === "product_enquiry" ? "product enquiry" : "message";
    const details = m.kind === "custom" && m.payload && typeof m.payload === "object" ? Object.entries(m.payload as Record<string, unknown>).filter(([, v]) => v).map(([k, v]) => `  ${k}: ${String(v)}`) : [];
    await sendToOwner(
      `New ${what} ${m.reference} - ${m.name}`,
      [
        `A new ${what} has come in on the website.`,
        ``,
        `Reference: ${m.reference}`,
        `From: ${m.name}`,
        `Phone: ${m.phone}`,
        m.email ? `Email: ${m.email}` : null,
        m.preferredContact ? `Prefers: ${m.preferredContact}` : null,
        ...(details.length ? [``, ...details] : []),
        m.message ? `\n${m.message}` : null,
        ``,
        `Open it: ${staffLink(`/app/messages/${m.id}`)}`,
      ]
        .filter((l): l is string => l !== null)
        .join("\n"),
    );
  });
}
