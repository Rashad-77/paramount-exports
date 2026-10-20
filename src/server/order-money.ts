import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { auditLogs, orderCases, orderItems, orderPayments, orders, productVariants, products, profiles } from "@/lib/db/schema";
import { invalidState, notFound, validation } from "@/lib/errors";
import { dec, formatMoney, moneyString, roundMoney, sum } from "@/lib/money";
import { orderMoney } from "@/lib/order-money-calc";
import { getBusinessSettings } from "@/lib/settings";
import { recordAudit } from "./audit";
import { recordUpdate } from "./account-updates";
import { emailCustomer } from "./notify";

/* ───────────────────────────── helpers ───────────────────────────── */

type PaymentMethod = "cash" | "bank_transfer" | "card" | "other";

const nextNumber = async (tx: DbOrTx, kind: "invoice" | "receipt" | "credit_note") => {
  const [{ ref }] = (await tx.execute(sql`SELECT next_reference(${kind}) AS ref`)) as unknown as [{ ref: string }];
  return ref;
};

/** The order's money, worked out from its payment rows and written back to the order: paid, refunded, and whether it is paid in full. */
export async function syncOrderMoney(tx: DbOrTx, orderId: string): Promise<{ paid: string; refunded: string; net: string; balance: string; isPaid: boolean }> {
  const [o] = await tx.select({ total: orders.total, isPaid: orders.isPaid, paidAt: orders.paidAt }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) throw notFound("That order could not be found.");
  const rows = await tx
    .select({ kind: orderPayments.kind, amount: orderPayments.amount, paidAt: orderPayments.paidAt })
    .from(orderPayments)
    .where(and(eq(orderPayments.orderId, orderId), isNull(orderPayments.voidedAt)));
  const paid = sum(rows.filter((r) => r.kind === "payment").map((r) => r.amount));
  const refunded = sum(rows.filter((r) => r.kind === "refund").map((r) => r.amount));
  const calc = orderMoney({ total: o.total, paidAmount: moneyString(paid), refundedAmount: moneyString(refunded) });
  const isPaid = calc.isPaid;
  const lastPaid = rows.filter((r) => r.kind === "payment").map((r) => r.paidAt.getTime()).sort((a, b) => b - a)[0];
  await tx
    .update(orders)
    .set({ paidAmount: moneyString(paid), refundedAmount: moneyString(refunded), isPaid, paidAt: isPaid ? (o.isPaid && o.paidAt ? o.paidAt : lastPaid ? new Date(lastPaid) : new Date()) : null })
    .where(eq(orders.id, orderId));
  return { paid: moneyString(paid), refunded: moneyString(refunded), net: calc.net, balance: calc.balance, isPaid };
}

const lock = async (tx: DbOrTx, id: string) => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
  if (!o) throw notFound("That order could not be found.");
  return o;
};

const tell = async (tx: DbOrTx, o: { accountId: string | null; reference: string; email: string | null; customerName: string }, title: string, body: string) => {
  await recordUpdate(tx, o.accountId, { kind: "order", title, body, link: `/account/orders/${o.reference}` });
  const business = await getBusinessSettings();
  emailCustomer(o.email, `${title} - ${business.name}`, [`Hello ${o.customerName},`, ``, body, ``, `You can see your order any time on our website with your order number and phone number.`, ``, business.name].join("\n"));
};

/* ───────────────────────────── payments ───────────────────────────── */

export interface PaymentInput {
  amount: string;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  paidOn?: string;
}

/** Records money received. Part payments are fine; more than the balance is not. Each one gets a receipt number. */
export async function recordPayment(actor: Actor, id: string, input: PaymentInput): Promise<{ number: string; isPaid: boolean }> {
  requirePermission(actor, "orders:record_payment");
  const amount = roundMoney(input.amount);
  if (!amount.gt(0)) throw validation("Enter an amount above zero.", { amount: ["Enter an amount above zero."] });
  return withTx(async (tx) => {
    const o = await lock(tx, id);
    if (o.status === "cancelled") throw invalidState("A cancelled order cannot take a payment.");
    const money = await syncOrderMoney(tx, id);
    if (amount.gt(money.balance)) throw validation(`That is more than the balance due (${formatMoney(money.balance, o.currency)}).`, { amount: [`The balance due is ${formatMoney(money.balance, o.currency)}.`] });
    const number = await nextNumber(tx, "receipt");
    const paidAt = input.paidOn ? new Date(`${input.paidOn}T12:00:00`) : new Date();
    await tx.insert(orderPayments).values({ orderId: id, kind: "payment", amount: moneyString(amount), method: input.method, reference: input.reference ?? null, note: input.note ?? null, number, paidAt, recordedBy: actor.id });
    if (!o.invoiceNumber) await tx.update(orders).set({ invoiceNumber: await nextNumber(tx, "invoice") }).where(eq(orders.id, id));
    const after = await syncOrderMoney(tx, id);
    await recordAudit(tx, actor, { action: "order.payment_recorded", entityType: "order", entityId: id, after: { number, amount: moneyString(amount), method: input.method, balance: after.balance } });
    await tell(tx, o, `Payment received for order ${o.reference}`, `We received your payment of ${formatMoney(amount, o.currency)} for order ${o.reference} (receipt ${number}).${after.isPaid ? " Your order is now paid in full. Thank you." : ` The balance still to pay is ${formatMoney(after.balance, o.currency)}.`}`);
    return { number, isPaid: after.isPaid };
  });
}

/** A payment or refund entered by mistake is voided (kept on record, no longer counted). */
export async function voidPayment(actor: Actor, paymentId: string, reason: string): Promise<void> {
  requirePermission(actor, "orders:void_payment");
  await withTx(async (tx) => {
    const [p] = await tx.select().from(orderPayments).where(eq(orderPayments.id, paymentId)).for("update");
    if (!p) throw notFound("That payment could not be found.");
    if (p.voidedAt) throw invalidState("That entry is already voided.");
    await lock(tx, p.orderId);
    await tx.update(orderPayments).set({ voidedAt: new Date(), voidedBy: actor.id, voidReason: reason }).where(eq(orderPayments.id, paymentId));
    await syncOrderMoney(tx, p.orderId);
    await recordAudit(tx, actor, { action: "order.payment_voided", entityType: "order", entityId: p.orderId, before: { number: p.number, amount: p.amount, kind: p.kind }, reason });
  });
}

/** The shortcut on the order list: Paid takes the balance in one go; Not paid voids what was recorded. */
export async function setOrderPaidShortcut(actor: Actor, id: string, paid: boolean): Promise<void> {
  requirePermission(actor, "orders:record_payment");
  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!o) throw notFound("That order could not be found.");
  if (paid) {
    if (o.isPaid) throw invalidState("That order is already paid in full.");
    const money = await withTx((tx) => syncOrderMoney(tx, id));
    await recordPayment(actor, id, { amount: money.balance, method: o.paymentMethod === "bank_transfer" ? "bank_transfer" : "cash" });
    return;
  }
  requirePermission(actor, "orders:void_payment");
  const rows = await db.select().from(orderPayments).where(and(eq(orderPayments.orderId, id), isNull(orderPayments.voidedAt)));
  if (rows.some((r) => r.kind === "refund")) throw invalidState("This order has refunds on it. Void the entries you want to undo from the payments list.");
  if (rows.length === 0) throw invalidState("That order has no payments recorded.");
  for (const r of rows) await voidPayment(actor, r.id, "Marked as not paid");
}

/* ───────────────────────────── refunds and returns ───────────────────────────── */

export interface RefundInput {
  amount: string;
  method: PaymentMethod;
  reason: string;
  reference?: string;
  /** Items that came back: how many of each, which go back on the shelf. */
  returns: Array<{ itemId: string; quantity: number }>;
}

/** Pays money back and/or takes items back. The refund gets a credit note number; returned items are restocked. */
export async function recordRefund(actor: Actor, id: string, input: RefundInput): Promise<{ number: string | null }> {
  requirePermission(actor, "orders:refund");
  const amount = roundMoney(input.amount || "0");
  const returns = input.returns.filter((r) => r.quantity > 0);
  if (!amount.gt(0) && returns.length === 0) throw validation("Enter an amount to refund, or the items that came back.", { amount: ["Enter an amount to refund, or the items that came back."] });
  return withTx(async (tx) => {
    const o = await lock(tx, id);
    const money = await syncOrderMoney(tx, id);
    if (amount.gt(money.net)) throw validation(`You can refund at most ${formatMoney(money.net, o.currency)}, which is what has been paid and not yet refunded.`, { amount: [`At most ${formatMoney(money.net, o.currency)}.`] });
    if (returns.length) {
      const items = await tx.select().from(orderItems).where(and(eq(orderItems.orderId, id), inArray(orderItems.id, returns.map((r) => r.itemId))));
      if (items.length !== returns.length) throw validation("One of the returned items is not on this order.");
      for (const r of returns) {
        const it = items.find((i) => i.id === r.itemId)!;
        if (r.quantity > it.quantity - it.returnedQuantity) throw validation(`Only ${it.quantity - it.returnedQuantity} of ${it.productName} can still be returned.`);
        await tx.update(orderItems).set({ returnedQuantity: it.returnedQuantity + r.quantity }).where(eq(orderItems.id, it.id));
        if (it.variantId) await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} + ${r.quantity}` }).where(and(eq(productVariants.id, it.variantId), sql`${productVariants.stockQuantity} IS NOT NULL`));
      }
    }
    let number: string | null = null;
    if (amount.gt(0)) {
      number = await nextNumber(tx, "credit_note");
      await tx.insert(orderPayments).values({ orderId: id, kind: "refund", amount: moneyString(amount), method: input.method, reference: input.reference ?? null, note: input.reason, number, recordedBy: actor.id });
    }
    await syncOrderMoney(tx, id);
    await recordAudit(tx, actor, { action: "order.refunded", entityType: "order", entityId: id, after: { number, amount: moneyString(amount), method: input.method, returns }, reason: input.reason });
    if (amount.gt(0)) await tell(tx, o, `Refund for order ${o.reference}`, `We have refunded ${formatMoney(amount, o.currency)} for order ${o.reference} (credit note ${number}). Reason: ${input.reason}.`);
    return { number };
  });
}

/* ───────────────────────────── discount ───────────────────────────── */

/** Works out a discount from an amount or a percentage of the items' total. Never more than the items. */
export function discountFrom(subtotal: string, amount?: string, percent?: string): string {
  const sub = dec(subtotal);
  const d = percent ? roundMoney(sub.times(dec(percent)).dividedBy(100)) : roundMoney(amount || "0");
  if (d.isNegative()) throw validation("A discount cannot be negative.", { discountAmount: ["A discount cannot be negative."] });
  if (d.gt(sub)) throw validation("The discount cannot be more than the items cost.", { discountAmount: ["That is more than the items cost."] });
  return moneyString(d);
}

/* ───────────────────────────── editing the items of an open order ───────────────────────────── */

export interface ItemEdits {
  /** Change the quantity of a line; 0 removes it. */
  changes: Array<{ itemId: string; quantity: number }>;
  /** New lines, by product option. */
  add: Array<{ variantId: string; quantity: number }>;
}

/** Changes what is on an order that is not yet delivered. Stock follows (pieces taken or put back) and the totals are worked out again. */
export async function updateOrderItems(actor: Actor, id: string, edits: ItemEdits): Promise<void> {
  requirePermission(actor, "orders:edit_items");
  await withTx(async (tx) => {
    const o = await lock(tx, id);
    if (o.status === "delivered" || o.status === "cancelled") throw invalidState("The items of a finished order cannot be changed.");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.position));
    const stock = async (variantId: string | null, delta: number) => {
      if (!variantId || delta === 0) return;
      if (delta < 0) {
        const taken = await tx
          .update(productVariants)
          .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${-delta}` })
          .where(and(eq(productVariants.id, variantId), sql`(${productVariants.stockQuantity} IS NULL OR ${productVariants.stockQuantity} >= ${-delta})`))
          .returning({ id: productVariants.id });
        if (!taken.length) throw validation("There is not enough stock for that change.");
      } else {
        await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} + ${delta}` }).where(and(eq(productVariants.id, variantId), sql`${productVariants.stockQuantity} IS NOT NULL`));
      }
    };
    const before = items.map((i) => ({ name: i.productName, quantity: i.quantity }));
    for (const c of edits.changes) {
      const it = items.find((i) => i.id === c.itemId);
      if (!it) throw validation("One of the lines is not on this order.");
      if (c.quantity === it.quantity) continue;
      if (c.quantity < it.returnedQuantity) throw validation(`${it.productName} has ${it.returnedQuantity} returned, so the quantity cannot go below that.`);
      await stock(it.variantId, it.quantity - c.quantity);
      if (c.quantity === 0) await tx.delete(orderItems).where(eq(orderItems.id, it.id));
      else await tx.update(orderItems).set({ quantity: c.quantity, lineTotal: moneyString(dec(it.unitPrice).times(c.quantity)) }).where(eq(orderItems.id, it.id));
    }
    for (const a of edits.add.filter((x) => x.quantity > 0)) {
      const [v] = await tx
        .select({ id: productVariants.id, sku: productVariants.sku, label: productVariants.label, price: productVariants.listPrice, active: productVariants.isActive, productId: products.id, name: products.name })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.id, a.variantId))
        .limit(1);
      if (!v || !v.active || v.price === null) throw validation("That product option cannot be added: it has no price or is not available.");
      const existing = (await tx.select().from(orderItems).where(and(eq(orderItems.orderId, id), eq(orderItems.variantId, a.variantId))).limit(1))[0];
      await stock(v.id, -a.quantity);
      if (existing) {
        const q = existing.quantity + a.quantity;
        await tx.update(orderItems).set({ quantity: q, lineTotal: moneyString(dec(existing.unitPrice).times(q)) }).where(eq(orderItems.id, existing.id));
      } else {
        const [{ top } = { top: 0 }] = await tx.select({ top: sql<number>`coalesce(max(${orderItems.position}), 0)::int` }).from(orderItems).where(eq(orderItems.orderId, id));
        await tx.insert(orderItems).values({ orderId: id, position: top + 1, productId: v.productId, variantId: v.id, productName: v.name, variantLabel: v.label === "Standard" ? null : v.label, sku: v.sku, unitPrice: moneyString(v.price), quantity: a.quantity, lineTotal: moneyString(dec(v.price).times(a.quantity)) });
      }
    }
    const now = await tx.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.position));
    if (now.length === 0) throw validation("An order needs at least one item. Cancel the order instead.");
    // Close up the line numbers.
    for (const [i, it] of now.entries()) if (it.position !== i + 1) await tx.update(orderItems).set({ position: i + 1 }).where(eq(orderItems.id, it.id));
    const subtotal = sum(now.map((i) => i.lineTotal));
    const discount = dec(o.discount);
    if (discount.gt(subtotal)) throw validation("The discount is now more than the items cost. Lower the discount first.");
    const total = moneyString(subtotal.minus(discount).plus(o.deliveryCharge));
    await tx.update(orders).set({ subtotal: moneyString(subtotal), total, handledBy: actor.id }).where(eq(orders.id, id));
    const money = await syncOrderMoney(tx, id);
    await recordAudit(tx, actor, { action: "order.items_changed", entityType: "order", entityId: id, before: { items: before, total: o.total }, after: { items: now.map((i) => ({ name: i.productName, quantity: i.quantity })), total, balance: money.balance } });
  });
}

/* ───────────────────────────── after-sales cases ───────────────────────────── */

export async function createCase(actor: Actor, orderId: string, input: { kind: "complaint" | "repair" | "warranty" | "other"; title: string; details?: string }): Promise<void> {
  requirePermission(actor, "orders:cases");
  await withTx(async (tx) => {
    await lock(tx, orderId);
    const [c] = await tx.insert(orderCases).values({ orderId, kind: input.kind, title: input.title, details: input.details ?? null, createdBy: actor.id }).returning({ id: orderCases.id });
    await recordAudit(tx, actor, { action: "order.case_opened", entityType: "order", entityId: orderId, after: { caseId: c!.id, kind: input.kind, title: input.title } });
  });
}

export async function resolveCase(actor: Actor, caseId: string, resolution: string | undefined, reopen: boolean): Promise<void> {
  requirePermission(actor, "orders:cases");
  await withTx(async (tx) => {
    const [c] = await tx.select().from(orderCases).where(eq(orderCases.id, caseId)).for("update");
    if (!c) throw notFound("That case could not be found.");
    if (reopen) await tx.update(orderCases).set({ status: "open", resolvedAt: null, resolvedBy: null }).where(eq(orderCases.id, caseId));
    else await tx.update(orderCases).set({ status: "resolved", resolution: resolution ?? null, resolvedAt: new Date(), resolvedBy: actor.id }).where(eq(orderCases.id, caseId));
    await recordAudit(tx, actor, { action: reopen ? "order.case_reopened" : "order.case_resolved", entityType: "order", entityId: c.orderId, after: { caseId, title: c.title }, reason: resolution });
  });
}

/* ───────────────────────────── reading it all back ───────────────────────────── */

export interface OrderExtras {
  payments: Array<{ id: string; kind: "payment" | "refund"; amount: string; method: PaymentMethod; reference: string | null; note: string | null; number: string; paidAt: Date; by: string | null; voidedAt: Date | null; voidReason: string | null }>;
  cases: Array<{ id: string; kind: string; title: string; details: string | null; resolution: string | null; status: "open" | "resolved"; createdAt: Date; by: string | null; resolvedAt: Date | null; resolvedBy: string | null }>;
  history: Array<{ at: Date; action: string; by: string | null; detail: string | null }>;
}

/** The payment rows of an order, as stored (for the printed receipt). */
export async function getOrderPayments(actor: Actor, id: string) {
  requirePermission(actor, "orders:view");
  return getDb().select().from(orderPayments).where(eq(orderPayments.orderId, id)).orderBy(asc(orderPayments.paidAt), asc(orderPayments.createdAt));
}

/** Payments, after-sales cases and the who-did-what history of one order. */
export async function getOrderExtras(actor: Actor, id: string): Promise<OrderExtras> {
  requirePermission(actor, "orders:view");
  const db = getDb();
  const rec = db.$with("rec").as(db.select({ id: profiles.id, name: profiles.fullName }).from(profiles));
  const [payments, cases, history] = await Promise.all([
    db
      .with(rec)
      .select({ id: orderPayments.id, kind: orderPayments.kind, amount: orderPayments.amount, method: orderPayments.method, reference: orderPayments.reference, note: orderPayments.note, number: orderPayments.number, paidAt: orderPayments.paidAt, by: rec.name, voidedAt: orderPayments.voidedAt, voidReason: orderPayments.voidReason })
      .from(orderPayments)
      .leftJoin(rec, eq(rec.id, orderPayments.recordedBy))
      .where(eq(orderPayments.orderId, id))
      .orderBy(asc(orderPayments.paidAt), asc(orderPayments.createdAt)),
    db
      .with(rec)
      .select({ id: orderCases.id, kind: orderCases.kind, title: orderCases.title, details: orderCases.details, resolution: orderCases.resolution, status: orderCases.status, createdAt: orderCases.createdAt, by: rec.name, resolvedAt: orderCases.resolvedAt, resolvedBy: orderCases.resolvedBy })
      .from(orderCases)
      .leftJoin(rec, eq(rec.id, orderCases.createdBy))
      .where(eq(orderCases.orderId, id))
      .orderBy(desc(orderCases.createdAt)),
    db
      .select({ at: auditLogs.createdAt, action: auditLogs.action, by: profiles.fullName, reason: auditLogs.reason, after: auditLogs.after })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.id, auditLogs.actorId))
      .where(and(eq(auditLogs.entityType, "order"), eq(auditLogs.entityId, id)))
      .orderBy(asc(auditLogs.createdAt)),
  ]);
  return {
    payments: payments as OrderExtras["payments"],
    cases: cases.map((c) => ({ ...c, resolvedBy: null })) as OrderExtras["cases"],
    history: history.map((h) => ({ at: h.at, action: h.action, by: h.by, detail: h.reason ?? null })),
  };
}
