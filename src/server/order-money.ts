import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { orderPayments, orders } from "@/lib/db/schema";
import { invalidState, notFound, validation } from "@/lib/errors";
import { dec, formatMoney, moneyString, roundMoney, sum } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { recordAudit } from "./audit";
import { recordUpdate } from "./account-updates";
import { emailCustomer } from "./notify";

type PaymentMethod = "cash" | "bank_transfer" | "card" | "other";

const nextNumber = async (tx: DbOrTx, kind: "invoice" | "receipt") => {
  const [{ ref }] = (await tx.execute(sql`SELECT next_reference(${kind}) AS ref`)) as unknown as [{ ref: string }];
  return ref;
};

/** Works out from the payment rows whether the order is paid, and writes the amount and the date back to the order. */
export async function syncOrderMoney(tx: DbOrTx, orderId: string): Promise<{ paid: string; isPaid: boolean }> {
  const [o] = await tx.select({ total: orders.total, isPaid: orders.isPaid, paidAt: orders.paidAt }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) throw notFound("That order could not be found.");
  const rows = await tx.select({ amount: orderPayments.amount, paidAt: orderPayments.paidAt }).from(orderPayments).where(and(eq(orderPayments.orderId, orderId), isNull(orderPayments.voidedAt)));
  const paid = sum(rows.map((r) => r.amount));
  const isPaid = dec(o.total).gt(0) && paid.gte(o.total);
  const last = rows.map((r) => r.paidAt.getTime()).sort((a, b) => b - a)[0];
  await tx.update(orders).set({ paidAmount: moneyString(paid), isPaid, paidAt: isPaid ? (o.isPaid && o.paidAt ? o.paidAt : last ? new Date(last) : new Date()) : null }).where(eq(orders.id, orderId));
  return { paid: moneyString(paid), isPaid };
}

/** Marks an order as paid: records one payment for what is due, with a receipt number, and numbers the invoice if it has none yet. */
export async function recordPayment(actor: Actor, id: string, input: { method: PaymentMethod; reference?: string; note?: string }): Promise<{ number: string }> {
  requirePermission(actor, "orders:record_payment");
  return withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!o) throw notFound("That order could not be found.");
    if (o.status === "cancelled") throw invalidState("A cancelled order cannot be marked as paid.");
    if (o.isPaid) throw invalidState("That order is already marked as paid.");
    const due = roundMoney(dec(o.total).minus(o.paidAmount));
    if (!due.gt(0)) throw validation("There is nothing to pay on this order.");
    const number = await nextNumber(tx, "receipt");
    await tx.insert(orderPayments).values({ orderId: id, kind: "payment", amount: moneyString(due), method: input.method, reference: input.reference ?? null, note: input.note ?? null, number, recordedBy: actor.id });
    if (!o.invoiceNumber) await tx.update(orders).set({ invoiceNumber: await nextNumber(tx, "invoice") }).where(eq(orders.id, id));
    await syncOrderMoney(tx, id);
    await recordAudit(tx, actor, { action: "order.marked_paid", entityType: "order", entityId: id, after: { number, amount: moneyString(due), method: input.method } });
    await recordUpdate(tx, o.accountId, { kind: "order", title: `Payment received for order ${o.reference}`, body: `We received your payment for order ${o.reference} (receipt ${number}). Thank you.`, link: `/account/orders/${o.reference}` });
    const business = await getBusinessSettings();
    emailCustomer(o.email, `Payment received for order ${o.reference} - ${business.name}`, [`Hello ${o.customerName},`, ``, `We received your payment of ${formatMoney(due, o.currency)} for order ${o.reference} (receipt ${number}). Thank you.`, ``, business.name].join("\n"));
    return { number };
  });
}

/** A payment entered by mistake is voided (kept on record, no longer counted). */
export async function voidPayment(actor: Actor, paymentId: string, reason: string): Promise<void> {
  requirePermission(actor, "orders:void_payment");
  await withTx(async (tx) => {
    const [p] = await tx.select().from(orderPayments).where(eq(orderPayments.id, paymentId)).for("update");
    if (!p) throw notFound("That payment could not be found.");
    if (p.voidedAt) throw invalidState("That payment is already voided.");
    await tx.select().from(orders).where(eq(orders.id, p.orderId)).for("update");
    await tx.update(orderPayments).set({ voidedAt: new Date(), voidedBy: actor.id, voidReason: reason }).where(eq(orderPayments.id, paymentId));
    await syncOrderMoney(tx, p.orderId);
    await recordAudit(tx, actor, { action: "order.marked_unpaid", entityType: "order", entityId: p.orderId, before: { number: p.number, amount: p.amount }, reason });
  });
}

/** The Paid / Not paid control: Paid records the payment in one go (cash, or bank transfer when that is how the customer pays); Not paid voids it. */
export async function setOrderPaidShortcut(actor: Actor, id: string, paid: boolean): Promise<void> {
  requirePermission(actor, "orders:record_payment");
  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!o) throw notFound("That order could not be found.");
  if (paid) {
    await recordPayment(actor, id, { method: o.paymentMethod === "bank_transfer" ? "bank_transfer" : "cash" });
    return;
  }
  requirePermission(actor, "orders:void_payment");
  if (o.status === "cancelled") throw invalidState("A cancelled order cannot be changed.");
  const rows = await db.select().from(orderPayments).where(and(eq(orderPayments.orderId, id), isNull(orderPayments.voidedAt)));
  if (rows.length === 0) throw invalidState("That order is already marked as not paid.");
  for (const r of rows) await voidPayment(actor, r.id, "Marked as not paid");
}

/** Works out a discount from an amount or a percentage of the items' total. Never more than the items. */
export function discountFrom(subtotal: string, amount?: string, percent?: string): string {
  const sub = dec(subtotal);
  const d = percent ? roundMoney(sub.times(dec(percent)).dividedBy(100)) : roundMoney(amount || "0");
  if (d.isNegative()) throw validation("A discount cannot be negative.", { discountAmount: ["A discount cannot be negative."] });
  if (d.gt(sub)) throw validation("The discount cannot be more than the items cost.", { discountAmount: ["That is more than the items cost."] });
  return moneyString(d);
}

/** The payment rows of an order, as stored (for the order page and the printed receipt). */
export async function getOrderPayments(actor: Actor, id: string) {
  requirePermission(actor, "orders:view");
  return getDb().select().from(orderPayments).where(eq(orderPayments.orderId, id)).orderBy(asc(orderPayments.paidAt), asc(orderPayments.createdAt));
}
