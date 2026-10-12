import "server-only";
import { outer } from "@/lib/db/outer";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, scopeOf, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { customers, inventoryBalances, locations, payments, productVariants, profiles, quotationItems, quotationRevisions, quotations, salesOrderItems, salesOrders } from "@/lib/db/schema";
import { forbidden, invalidState, notFound, validation } from "@/lib/errors";
import { dec, moneyString, outstandingBalance, qtyString } from "@/lib/money";
import type { QuotationItemInput } from "@/lib/schemas/quotation";
import { getBusinessSettings } from "@/lib/settings";
import { recordAudit } from "./audit";
import { fulfilReservations, releaseReservations, reserveForOrder } from "./inventory";
import { escapeLike } from "./leads";
import { computeAndCheck, specification, type Computed } from "./pricing";
import { cancelJobForOrder, createJobForOrder, releaseJobOutputOnDelivery } from "./production";

export type OrderStatus = (typeof salesOrders.$inferSelect)["status"];
export type OrderType = (typeof salesOrders.$inferSelect)["type"];
export type PaymentMethod = (typeof payments.$inferSelect)["method"];

export const ORDER_STATUS_ORDER: OrderStatus[] = ["draft", "confirmed", "preparing", "ready", "delivered"];

/* ───────────────────────────── helpers ───────────────────────────── */

async function lockOrder(tx: DbOrTx, id: string) {
  const [o] = await tx.select().from(salesOrders).where(eq(salesOrders.id, id)).for("update");
  if (!o) throw notFound("That order could not be found.");
  return o;
}

/** Net money received: payments minus voids (voids are stored as negative rows). */
export async function netPaid(db: DbOrTx, orderId: string): Promise<string> {
  const [r] = await db.select({ s: sql<string>`coalesce(sum(${payments.amount}), 0)::text` }).from(payments).where(eq(payments.orderId, orderId));
  return moneyString(r?.s ?? "0");
}

/** Resolve each ready-made line to the stock item behind its product option; refuse untracked products. */
async function resolveStockItems(db: DbOrTx, items: QuotationItemInput[]): Promise<Map<string, string>> {
  const ids = [...new Set(items.map((i) => i.variantId).filter((v): v is string => Boolean(v)))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db.select({ id: productVariants.id, sku: productVariants.sku, inventoryItemId: productVariants.inventoryItemId }).from(productVariants).where(inArray(productVariants.id, ids));
  const untracked = rows.filter((r) => !r.inventoryItemId).map((r) => r.sku);
  if (untracked.length) {
    throw validation(`Turn on stock tracking first for: ${untracked.join(", ")}. Ready-made orders need counted stock so they cannot oversell.`, { itemsJson: [`Stock tracking is off for ${untracked.join(", ")}.`] });
  }
  for (const r of rows) map.set(r.id, r.inventoryItemId!);
  return map;
}

async function insertLines(tx: DbOrTx, orderId: string, c: Computed, stockItems: Map<string, string>) {
  await tx.insert(salesOrderItems).values(
    c.lines.map((l, idx) => ({
      orderId,
      position: idx + 1,
      variantId: l.item.variantId ?? null,
      inventoryItemId: l.item.variantId ? (stockItems.get(l.item.variantId) ?? null) : null,
      description: l.item.description,
      specification: specification(l.item),
      quantity: qtyString(l.item.quantity),
      unitPrice: moneyString(l.item.unitPrice),
      discountAmount: moneyString(l.item.discountAmount),
      lineTotal: l.lineTotal,
    })),
  );
}

/* ───────────────────────────── creating and editing ───────────────────────────── */

export interface ReadyMadeOrderInput {
  customerId: string;
  locationId: string;
  deliveryCharge: string;
  depositTerms?: string;
  notes?: string;
  items: QuotationItemInput[];
}

async function assertReadyMadeInput(db: DbOrTx, input: ReadyMadeOrderInput) {
  const [cust] = await db.select({ id: customers.id, archivedAt: customers.archivedAt }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!cust || cust.archivedAt) throw validation("Choose an active customer.", { customerId: ["Choose an active customer."] });
  const [loc] = await db.select({ id: locations.id, archivedAt: locations.archivedAt, isActive: locations.isActive }).from(locations).where(eq(locations.id, input.locationId)).limit(1);
  if (!loc || loc.archivedAt || !loc.isActive) throw validation("Choose an active location.", { locationId: ["Choose an active location."] });
  if (input.items.some((i) => i.kind !== "ready_made" || !i.variantId)) throw validation("A ready-made order can only contain ready-made products.", { itemsJson: ["Every line must be a product from the catalogue."] });
}

export async function createReadyMadeOrder(actor: Actor, input: ReadyMadeOrderInput): Promise<string> {
  requirePermission(actor, "orders:write");
  const db = getDb();
  await assertReadyMadeInput(db, input);
  const computed = await computeAndCheck(db, actor, input);
  const stockItems = await resolveStockItems(db, input.items);
  const currency = (await getBusinessSettings()).currency;
  return withTx(async (tx) => {
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('order') AS ref`)) as unknown as [{ ref: string }];
    const [o] = await tx
      .insert(salesOrders)
      .values({
        reference: ref,
        customerId: input.customerId,
        type: "ready_made",
        locationId: input.locationId,
        currency,
        subtotal: computed.totals.subtotal,
        discountTotal: computed.totals.discountTotal,
        deliveryCharge: computed.totals.deliveryCharge,
        total: computed.totals.total,
        depositTerms: input.depositTerms ?? null,
        notes: input.notes ?? null,
        createdBy: actor.id,
      })
      .returning({ id: salesOrders.id });
    await insertLines(tx, o!.id, computed, stockItems);
    await recordAudit(tx, actor, { action: "order.created", entityType: "sales_order", entityId: o!.id, after: { reference: ref, type: "ready_made", total: computed.totals.total } });
    return o!.id;
  });
}

/** Edit a DRAFT ready-made order (customer fixed; lines, location, delivery, notes). Confirmed orders are locked. */
export async function updateReadyMadeDraft(actor: Actor, id: string, input: Omit<ReadyMadeOrderInput, "customerId">): Promise<void> {
  requirePermission(actor, "orders:write");
  const db = getDb();
  const existing = await lockOrderSnapshot(db, id);
  await assertReadyMadeInput(db, { ...input, customerId: existing.customerId });
  const computed = await computeAndCheck(db, actor, input);
  const stockItems = await resolveStockItems(db, input.items);
  await withTx(async (tx) => {
    const o = await lockOrder(tx, id);
    if (o.status !== "draft") throw invalidState("Only a draft order can be edited.");
    if (o.type !== "ready_made") throw invalidState("Custom orders take their lines from the accepted quotation.");
    await tx.delete(salesOrderItems).where(eq(salesOrderItems.orderId, id));
    await tx
      .update(salesOrders)
      .set({
        locationId: input.locationId,
        subtotal: computed.totals.subtotal,
        discountTotal: computed.totals.discountTotal,
        deliveryCharge: computed.totals.deliveryCharge,
        total: computed.totals.total,
        depositTerms: input.depositTerms ?? null,
        notes: input.notes ?? null,
      })
      .where(eq(salesOrders.id, id));
    await insertLines(tx, id, computed, stockItems);
    await recordAudit(tx, actor, { action: "order.draft_updated", entityType: "sales_order", entityId: id, before: { total: o.total }, after: { total: computed.totals.total } });
  });
}

async function lockOrderSnapshot(db: DbOrTx, id: string) {
  const [o] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  if (!o) throw notFound("That order could not be found.");
  return o;
}

/** Notes, deposit terms and wanted-by date can change while the order is still a draft (any type). */
export async function updateOrderTerms(actor: Actor, id: string, input: { depositTerms?: string; requestedCompletionDate?: string; notes?: string }): Promise<void> {
  requirePermission(actor, "orders:write");
  await withTx(async (tx) => {
    const o = await lockOrder(tx, id);
    if (o.status === "delivered" || o.status === "cancelled") throw invalidState("A finished order can no longer be edited.");
    await tx
      .update(salesOrders)
      .set({ depositTerms: input.depositTerms ?? null, requestedCompletionDate: input.requestedCompletionDate ?? null, notes: input.notes ?? null })
      .where(eq(salesOrders.id, id));
    await recordAudit(tx, actor, { action: "order.terms_updated", entityType: "sales_order", entityId: id, before: { depositTerms: o.depositTerms, requestedCompletionDate: o.requestedCompletionDate }, after: { depositTerms: input.depositTerms ?? null, requestedCompletionDate: input.requestedCompletionDate ?? null } });
  });
}

/**
 * Accepted quotation → order. The order gets its own copy of the accepted lines and prices (so later catalogue price
 * changes cannot alter it) and keeps the link to the exact revision the customer accepted. One order per quotation.
 */
export async function convertQuotationToOrder(actor: Actor, quotationId: string, input: { locationId?: string; depositTerms?: string; requestedCompletionDate?: string; notes?: string }): Promise<string> {
  requirePermission(actor, "quotations:convert");
  requirePermission(actor, "orders:write");
  return withTx(async (tx) => {
    const [q] = await tx.select().from(quotations).where(eq(quotations.id, quotationId)).for("update");
    if (!q) throw notFound("That quotation could not be found.");
    if (q.status === "converted") throw invalidState("This quotation has already been turned into an order.");
    if (q.status !== "accepted") throw invalidState("Only an accepted quotation can become an order.");
    const [rev] = await tx.select().from(quotationRevisions).where(and(eq(quotationRevisions.quotationId, q.id), eq(quotationRevisions.revisionNo, q.currentRevisionNo)));
    const items = await tx.select().from(quotationItems).where(eq(quotationItems.revisionId, rev!.id)).orderBy(asc(quotationItems.position));
    const kinds = new Set(items.map((i) => i.kind));
    if (kinds.size > 1) throw validation("This quotation mixes ready-made and custom items. Split it into two quotations (one of each) so each can be handled correctly.");
    const type: OrderType = items[0]!.kind;

    let locationId: string | null = null;
    let stock = new Map<string, string>();
    if (type === "ready_made") {
      if (!input.locationId) throw validation("Choose the location the stock comes from.", { locationId: ["Choose a location."] });
      const [loc] = await tx.select({ id: locations.id, archivedAt: locations.archivedAt }).from(locations).where(eq(locations.id, input.locationId)).limit(1);
      if (!loc || loc.archivedAt) throw validation("Choose an active location.", { locationId: ["Choose an active location."] });
      locationId = loc.id;
      stock = await resolveStockItems(tx, items.map((i) => ({ variantId: i.variantId ?? undefined }) as QuotationItemInput));
    }

    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('order') AS ref`)) as unknown as [{ ref: string }];
    const [o] = await tx
      .insert(salesOrders)
      .values({
        reference: ref,
        customerId: q.customerId,
        quotationId: q.id,
        quotationRevisionId: rev!.id,
        type,
        locationId,
        currency: q.currency,
        subtotal: rev!.subtotal,
        discountTotal: rev!.discountTotal,
        deliveryCharge: rev!.deliveryCharge,
        total: rev!.total,
        depositTerms: input.depositTerms ?? null,
        requestedCompletionDate: input.requestedCompletionDate ?? null,
        notes: input.notes ?? null,
        createdBy: actor.id,
      })
      .returning({ id: salesOrders.id });
    await tx.insert(salesOrderItems).values(
      items.map((i) => ({
        orderId: o!.id,
        position: i.position,
        variantId: i.variantId,
        inventoryItemId: i.variantId ? (stock.get(i.variantId) ?? null) : null,
        description: i.description,
        specification: i.specification,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountAmount: i.discountAmount,
        lineTotal: i.lineTotal,
      })),
    );
    await tx.update(quotations).set({ status: "converted" }).where(eq(quotations.id, q.id));
    await recordAudit(tx, actor, { action: "quotation.converted", entityType: "quotation", entityId: q.id, after: { orderId: o!.id, reference: ref, type } });
    await recordAudit(tx, actor, { action: "order.created", entityType: "sales_order", entityId: o!.id, after: { reference: ref, type, total: rev!.total, quotation: q.reference } });
    return o!.id;
  });
}

/* ───────────────────────────── lifecycle ───────────────────────────── */

/**
 * Confirm a draft. Ready-made: reserves the stock in the same transaction, or fails with exact shortages and changes
 * nothing. Custom: confirmation creates the production job in the same transaction.
 */
export async function confirmOrder(actor: Actor, id: string, now: Date = new Date()): Promise<void> {
  requirePermission(actor, "orders:confirm");
  await withTx(async (tx) => {
    const o = await lockOrder(tx, id);
    if (o.status !== "draft") throw invalidState("Only a draft order can be confirmed.");
    const lines = await tx.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, id)).orderBy(asc(salesOrderItems.position));
    if (lines.length === 0) throw validation("The order has no items.");
    if (o.type === "ready_made") {
      if (!o.locationId) throw validation("Choose the location the stock comes from.");
      // Merge identical items so the shortage message is one line per product.
      const reserveLines = lines.map((l) => ({ orderItemId: l.id, itemId: l.inventoryItemId!, quantity: l.quantity }));
      if (reserveLines.some((l) => !l.itemId)) throw validation("A line has no counted stock behind it. Turn on stock tracking for that product.");
      await reserveForOrder(tx, actor.id, id, o.locationId, reserveLines);
    }
    await tx.update(salesOrders).set({ status: "confirmed", confirmedAt: now }).where(eq(salesOrders.id, id));
    if (o.type === "custom") await createJobForOrder(tx, actor, o);
    await recordAudit(tx, actor, { action: "order.confirmed", entityType: "sales_order", entityId: id, after: { reference: o.reference, total: o.total } });
  });
}

const FORWARD: Record<string, OrderStatus[]> = {
  confirmed: ["preparing", "ready", "delivered"],
  preparing: ["ready", "delivered"],
  ready: ["delivered"],
};

/** Move a confirmed order forward. Delivery is the moment reserved stock actually leaves. Production NEVER does this for you. */
export async function advanceOrder(actor: Actor, id: string, to: "preparing" | "ready" | "delivered", now: Date = new Date()): Promise<void> {
  requirePermission(actor, "orders:write");
  await withTx((tx) => advanceOrderInTx(tx, actor, id, to, now));
}

/**
 * The transition itself, for callers that already hold the right permission (the delivery module marks an order
 * delivered when its delivery is). Locks the order, so a double submit moves it once and the second attempt is refused.
 */
export async function advanceOrderInTx(tx: DbOrTx, actor: Actor, id: string, to: "preparing" | "ready" | "delivered", now: Date = new Date()): Promise<void> {
  const o = await lockOrder(tx, id);
  if (!(FORWARD[o.status] ?? []).includes(to)) throw invalidState(`An order that is ${o.status} cannot move to ${to}.`);
  if (to === "delivered" && o.type === "ready_made") await fulfilReservations(tx, actor.id, id);
  if (to === "delivered" && o.type === "custom") await releaseJobOutputOnDelivery(tx, actor, id);
  await tx.update(salesOrders).set({ status: to, deliveredAt: to === "delivered" ? now : null }).where(eq(salesOrders.id, id));
  await recordAudit(tx, actor, { action: `order.${to}`, entityType: "sales_order", entityId: id, before: { status: o.status }, after: { status: to } });
}

/** Cancel with a reason. Reserved stock is released exactly once. Once money has been taken, a Manager/Owner must do it. */
export async function cancelOrder(actor: Actor, id: string, reason: string, now: Date = new Date()): Promise<void> {
  requirePermission(actor, "orders:cancel");
  const why = reason.trim();
  if (!why) throw validation("Say why the order is being cancelled.", { reason: ["Add a short reason."] });
  await withTx(async (tx) => {
    const o = await lockOrder(tx, id);
    if (o.status === "cancelled") throw invalidState("This order is already cancelled.");
    if (o.status === "delivered") throw invalidState("A delivered order cannot be cancelled. Record a return or complaint instead.");
    const paid = dec(await netPaid(tx, id));
    if (paid.gt(0) && !can(actor, "orders:cancel_paid")) throw forbidden("Money has already been received on this order. A manager or the owner must cancel it (and refund the customer).");
    const released = await releaseReservations(tx, actor.id, id, `Order cancelled: ${why}`);
    await cancelJobForOrder(tx, actor, id, why);
    await tx.update(salesOrders).set({ status: "cancelled", cancelledAt: now, cancelReason: why }).where(eq(salesOrders.id, id));
    // A converted quotation stays converted; the cancelled order keeps the history.
    await recordAudit(tx, actor, { action: "order.cancelled", entityType: "sales_order", entityId: id, before: { status: o.status, netPaid: paid.toFixed(2) }, after: { reservationsReleased: released }, reason: why });
  });
}

/* ───────────────────────────── payments ───────────────────────────── */

export async function recordPayment(
  actor: Actor,
  input: { orderId: string; amount: string; method: PaymentMethod; paidAt?: Date; reference?: string; note?: string },
): Promise<string> {
  requirePermission(actor, "payments:record");
  const amount = dec(input.amount);
  if (!amount.gt(0)) throw validation("Enter an amount greater than zero.", { amount: ["Enter an amount greater than zero."] });
  return withTx(async (tx) => {
    const o = await lockOrder(tx, input.orderId); // serialises concurrent payments on the same order
    if (o.status === "draft") throw invalidState("Confirm the order before recording payments against it.");
    if (o.status === "cancelled") throw invalidState("This order is cancelled. Payments cannot be added.");
    const outstanding = outstandingBalance(o.total, [await netPaid(tx, o.id)]);
    if (amount.gt(outstanding)) {
      throw validation(`That is more than the outstanding balance (${outstanding.toFixed(2)} ${o.currency}).`, { amount: [`The most you can record is ${outstanding.toFixed(2)}.`] });
    }
    const [p] = await tx
      .insert(payments)
      .values({ orderId: o.id, amount: moneyString(amount), method: input.method, paidAt: input.paidAt ?? new Date(), reference: input.reference ?? null, note: input.note ?? null, recordedBy: actor.id })
      .returning({ id: payments.id });
    await recordAudit(tx, actor, { action: "payment.recorded", entityType: "payment", entityId: p!.id, after: { orderId: o.id, amount: moneyString(amount), method: input.method } });
    return p!.id;
  });
}

/** Reverse a payment (never deleted): adds a negative row linked to the original, with a reason. Audited. */
export async function voidPayment(actor: Actor, paymentId: string, reason: string): Promise<string> {
  requirePermission(actor, "payments:void");
  const why = reason.trim();
  if (!why) throw validation("Say why this payment is being voided.", { reason: ["Add a short reason."] });
  return withTx(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId));
    if (!p) throw notFound("That payment could not be found.");
    await lockOrder(tx, p.orderId);
    if (dec(p.amount).lte(0)) throw invalidState("That entry is already a reversal.");
    const [already] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.voidsPaymentId, paymentId));
    if (already) throw invalidState("That payment has already been voided.");
    const [v] = await tx
      .insert(payments)
      .values({ orderId: p.orderId, amount: moneyString(dec(p.amount).negated()), method: p.method, voidsPaymentId: paymentId, note: `Voided: ${why}`, recordedBy: actor.id })
      .returning({ id: payments.id });
    await recordAudit(tx, actor, { action: "payment.voided", entityType: "payment", entityId: paymentId, before: { amount: p.amount }, after: { reversalId: v!.id }, reason: why });
    return v!.id;
  });
}

/* ───────────────────────────── reading ───────────────────────────── */

export interface OrderFilters {
  status?: OrderStatus;
  type?: OrderType;
  q?: string;
  customerId?: string;
  withBalanceOnly?: boolean;
  page: number;
  pageSize: number;
}

/** Sales staff see payment figures only for orders they created (payments:view scope "own"). */
function paymentVisibility(actor: Actor, createdBy: string | null): boolean {
  const scope = scopeOf(actor, "payments:view");
  return scope === "all" || (scope === "own" && createdBy === actor.id);
}

export async function listOrders(actor: Actor, f: OrderFilters) {
  requirePermission(actor, "orders:view");
  const where: SQL[] = [];
  if (f.status) where.push(eq(salesOrders.status, f.status));
  if (f.type) where.push(eq(salesOrders.type, f.type));
  if (f.customerId) where.push(eq(salesOrders.customerId, f.customerId));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(salesOrders.reference, like), ilike(customers.name, like), ilike(customers.company, like))!);
  }
  const paidSql = sql<string>`coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = ${outer(salesOrders.id)}), 0)::text`;
  if (f.withBalanceOnly) where.push(sql`${salesOrders.status} <> 'cancelled' AND ${salesOrders.status} <> 'draft' AND ${salesOrders.total} > coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = ${outer(salesOrders.id)}), 0)`);
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: salesOrders.id,
        reference: salesOrders.reference,
        type: salesOrders.type,
        status: salesOrders.status,
        currency: salesOrders.currency,
        total: salesOrders.total,
        createdBy: salesOrders.createdBy,
        createdAt: salesOrders.createdAt,
        customerId: customers.id,
        customerName: customers.name,
        paid: paidSql,
      })
      .from(salesOrders)
      .innerJoin(customers, eq(customers.id, salesOrders.customerId))
      .where(cond)
      .orderBy(desc(salesOrders.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(salesOrders).innerJoin(customers, eq(customers.id, salesOrders.customerId)).where(cond),
  ]);
  const n = countRows[0]?.n ?? 0;
  return {
    rows: rows.map((r) => {
      const visible = paymentVisibility(actor, r.createdBy);
      return { ...r, paid: visible ? moneyString(r.paid) : null, outstanding: visible ? outstandingBalance(r.total, [r.paid]).toFixed(2) : null };
    }),
    total: n,
    pageCount: Math.max(1, Math.ceil(n / f.pageSize)),
  };
}

export async function getOrder(actor: Actor, id: string) {
  requirePermission(actor, "orders:view");
  const db = getDb();
  const [row] = await db
    .select({ o: salesOrders, customerName: customers.name, customerPhone: customers.phone, customerCompany: customers.company, locationName: locations.name, quotationReference: quotations.reference })
    .from(salesOrders)
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .leftJoin(locations, eq(locations.id, salesOrders.locationId))
    .leftJoin(quotations, eq(quotations.id, salesOrders.quotationId))
    .where(eq(salesOrders.id, id))
    .limit(1);
  if (!row) throw notFound("That order could not be found.");
  const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, id)).orderBy(asc(salesOrderItems.position));

  let money: { entries: Array<typeof payments.$inferSelect & { voided: boolean; recordedByName: string | null }>; paid: string; outstanding: string } | null = null;
  if (paymentVisibility(actor, row.o.createdBy)) {
    const entries = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.createdAt));
    const voidedIds = new Set(entries.filter((e) => e.voidsPaymentId).map((e) => e.voidsPaymentId));
    const staffIds = [...new Set(entries.map((e) => e.recordedBy).filter((x): x is string => Boolean(x)))];
    const names = staffIds.length ? await db.select({ id: profiles.id, name: profiles.fullName }).from(profiles).where(inArray(profiles.id, staffIds)) : [];
    const nameOf = new Map(names.map((n) => [n.id, n.name]));
    const paid = moneyString(entries.reduce((s, e) => s.plus(e.amount), dec(0)));
    money = {
      entries: entries.map((e) => ({ ...e, voided: voidedIds.has(e.id), recordedByName: e.recordedBy ? (nameOf.get(e.recordedBy) ?? null) : null })),
      paid,
      outstanding: outstandingBalance(row.o.total, [paid]).toFixed(2),
    };
  }

  // Draft ready-made orders: show what is available right now so staff see shortages BEFORE confirming.
  let availability: Record<string, string> | null = null;
  if (row.o.status === "draft" && row.o.type === "ready_made" && row.o.locationId) {
    const ids = items.map((i) => i.inventoryItemId).filter((x): x is string => Boolean(x));
    const bal = ids.length ? await db.select().from(inventoryBalances).where(and(inArray(inventoryBalances.itemId, ids), eq(inventoryBalances.locationId, row.o.locationId))) : [];
    availability = {};
    for (const i of items) {
      const b = bal.find((x) => x.itemId === i.inventoryItemId);
      availability[i.id] = qtyString(b ? dec(b.onHand).minus(b.reserved) : 0);
    }
  }
  return {
    order: row.o,
    customer: { id: row.o.customerId, name: row.customerName, phone: row.customerPhone, company: row.customerCompany },
    locationName: row.locationName,
    quotationReference: row.quotationReference,
    items,
    money,
    availability,
  };
}

