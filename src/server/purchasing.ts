import "server-only";
import { outer } from "@/lib/db/outer";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import {
  goodsReceiptItems,
  goodsReceipts,
  inventoryItems,
  locations,
  profiles,
  purchaseOrderItems,
  purchaseOrders,
  supplierPayments,
  suppliers,
} from "@/lib/db/schema";
import { invalidState, notFound, validation } from "@/lib/errors";
import { dec, moneyString, qtyString, roundMoney } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { recordAudit } from "./audit";
import { applyMovements } from "./inventory";
import { escapeLike } from "./leads";

export type PoStatus = (typeof purchaseOrders.$inferSelect)["status"];
export type PaymentMethod = (typeof supplierPayments.$inferSelect)["method"];

/* ───────────────────────────── suppliers ───────────────────────────── */

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  suppliedMaterials?: string;
  notes?: string;
}

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export async function listSuppliers(actor: Actor, f: { q?: string; includeArchived?: boolean } = {}) {
  requirePermission(actor, "suppliers:view");
  const conds: SQL[] = [];
  if (!f.includeArchived) conds.push(isNull(suppliers.archivedAt));
  if (f.q?.trim()) {
    const like = `%${escapeLike(f.q.trim())}%`;
    conds.push(or(ilike(suppliers.name, like), ilike(suppliers.suppliedMaterials, like), ilike(suppliers.contactName, like))!);
  }
  return getDb()
    .select()
    .from(suppliers)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(actor: Actor, id: string) {
  requirePermission(actor, "suppliers:view");
  const db = getDb();
  const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!s) throw notFound("That supplier could not be found.");
  const orders = await db
    .select({ id: purchaseOrders.id, reference: purchaseOrders.reference, status: purchaseOrders.status, createdAt: purchaseOrders.createdAt, expectedOn: purchaseOrders.expectedOn })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, id))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(50);
  return { supplier: s, orders };
}

export async function saveSupplier(actor: Actor, input: SupplierInput & { id?: string }): Promise<string> {
  requirePermission(actor, "suppliers:write");
  const name = input.name.trim();
  if (!name) throw validation("Enter the supplier's name.", { name: ["Enter the supplier's name."] });
  const values = {
    name,
    contactName: blank(input.contactName),
    phone: blank(input.phone),
    email: blank(input.email),
    address: blank(input.address),
    suppliedMaterials: blank(input.suppliedMaterials),
    notes: blank(input.notes),
  };
  return withTx(async (tx) => {
    if (input.id) {
      const [before] = await tx.select().from(suppliers).where(eq(suppliers.id, input.id)).limit(1);
      if (!before) throw notFound("That supplier could not be found.");
      await tx.update(suppliers).set(values).where(eq(suppliers.id, input.id));
      await recordAudit(tx, actor, { action: "supplier.updated", entityType: "supplier", entityId: input.id, before: { name: before.name }, after: { name } });
      return input.id;
    }
    const [row] = await tx.insert(suppliers).values(values).returning({ id: suppliers.id });
    await recordAudit(tx, actor, { action: "supplier.created", entityType: "supplier", entityId: row!.id, after: { name } });
    return row!.id;
  });
}

/** Suppliers with history are archived, never deleted. */
export async function setSupplierArchived(actor: Actor, id: string, archived: boolean): Promise<void> {
  requirePermission(actor, "suppliers:write");
  await withTx(async (tx) => {
    const res = await tx.update(suppliers).set({ archivedAt: archived ? new Date() : null }).where(eq(suppliers.id, id)).returning({ id: suppliers.id });
    if (res.length === 0) throw notFound("That supplier could not be found.");
    await recordAudit(tx, actor, { action: archived ? "supplier.archived" : "supplier.restored", entityType: "supplier", entityId: id });
  });
}

/* ───────────────────────────── purchase orders ───────────────────────────── */

export interface PoLineInput {
  itemId: string;
  quantity: string;
  expectedUnitCost: string;
}
export interface PoInput {
  supplierId: string;
  locationId: string;
  expectedOn?: string;
  notes?: string;
  items: PoLineInput[];
}

function checkLines(items: PoLineInput[]): void {
  if (items.length === 0) throw validation("Add at least one item.", { items: ["Add at least one item."] });
  const seen = new Set<string>();
  for (const [i, l] of items.entries()) {
    if (!dec(l.quantity).gt(0)) throw validation(`Line ${i + 1}: enter a quantity greater than zero.`, { items: [`Line ${i + 1}: enter a quantity greater than zero.`] });
    if (dec(l.expectedUnitCost).isNegative()) throw validation(`Line ${i + 1}: the cost cannot be negative.`, { items: [`Line ${i + 1}: the cost cannot be negative.`] });
    if (seen.has(l.itemId)) throw validation("Each item can appear only once. Combine the quantities.", { items: ["Each item can appear only once. Combine the quantities."] });
    seen.add(l.itemId);
  }
}

async function validateTargets(tx: DbOrTx, input: PoInput): Promise<void> {
  const [s] = await tx.select({ id: suppliers.id, archivedAt: suppliers.archivedAt }).from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
  if (!s || s.archivedAt) throw validation("Choose an active supplier.", { supplierId: ["Choose an active supplier."] });
  const [l] = await tx.select({ id: locations.id, archivedAt: locations.archivedAt }).from(locations).where(eq(locations.id, input.locationId)).limit(1);
  if (!l || l.archivedAt) throw validation("Choose where the goods will be received.", { locationId: ["Choose where the goods will be received."] });
  const found = await tx.select({ id: inventoryItems.id }).from(inventoryItems).where(inArray(inventoryItems.id, input.items.map((i) => i.itemId)));
  if (found.length !== input.items.length) throw validation("One of the items could not be found.", { items: ["One of the items could not be found."] });
}

function lineRows(poId: string, items: PoLineInput[]) {
  return items.map((l, i) => ({ purchaseOrderId: poId, position: i + 1, itemId: l.itemId, quantityOrdered: qtyString(l.quantity), expectedUnitCost: moneyString(l.expectedUnitCost) }));
}

export async function createPurchaseOrder(actor: Actor, input: PoInput): Promise<string> {
  requirePermission(actor, "purchasing:write");
  checkLines(input.items);
  const business = await getBusinessSettings();
  return withTx(async (tx) => {
    await validateTargets(tx, input);
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('purchase_order') AS ref`)) as unknown as [{ ref: string }];
    const [po] = await tx
      .insert(purchaseOrders)
      .values({ reference: ref, supplierId: input.supplierId, locationId: input.locationId, currency: business.currency, expectedOn: input.expectedOn || null, notes: blank(input.notes), createdBy: actor.id })
      .returning({ id: purchaseOrders.id });
    await tx.insert(purchaseOrderItems).values(lineRows(po!.id, input.items));
    await recordAudit(tx, actor, { action: "purchase_order.created", entityType: "purchase_order", entityId: po!.id, after: { reference: ref, supplierId: input.supplierId, lines: input.items.length } });
    return po!.id;
  });
}

async function lockPo(tx: DbOrTx, id: string) {
  const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).for("update");
  if (!po) throw notFound("That purchase order could not be found.");
  return po;
}

/** Only a draft can be edited; once sent, what was ordered is what the supplier agreed to. */
export async function updateDraftPurchaseOrder(actor: Actor, id: string, input: PoInput): Promise<void> {
  requirePermission(actor, "purchasing:write");
  checkLines(input.items);
  await withTx(async (tx) => {
    const po = await lockPo(tx, id);
    if (po.status !== "draft") throw invalidState("Only a draft purchase order can be edited.");
    await validateTargets(tx, input);
    await tx.update(purchaseOrders).set({ supplierId: input.supplierId, locationId: input.locationId, expectedOn: input.expectedOn || null, notes: blank(input.notes) }).where(eq(purchaseOrders.id, id));
    await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    await tx.insert(purchaseOrderItems).values(lineRows(id, input.items));
    await recordAudit(tx, actor, { action: "purchase_order.updated", entityType: "purchase_order", entityId: id, after: { lines: input.items.length } });
  });
}

export async function markPurchaseOrderSent(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, "purchasing:write");
  await withTx(async (tx) => {
    const po = await lockPo(tx, id);
    if (po.status !== "draft") throw invalidState("Only a draft purchase order can be marked as sent.");
    await tx.update(purchaseOrders).set({ status: "sent", sentAt: new Date() }).where(eq(purchaseOrders.id, id));
    await recordAudit(tx, actor, { action: "purchase_order.sent", entityType: "purchase_order", entityId: id, before: { status: po.status }, after: { status: "sent" } });
  });
}

/** Cancel with a reason. Not possible once goods have been received — receive/return those through stock adjustments. */
export async function cancelPurchaseOrder(actor: Actor, id: string, reason: string): Promise<void> {
  requirePermission(actor, "purchasing:write");
  const why = reason.trim();
  if (!why) throw validation("Say why the purchase order is being cancelled.", { reason: ["Add a short reason."] });
  await withTx(async (tx) => {
    const po = await lockPo(tx, id);
    if (po.status === "cancelled") throw invalidState("This purchase order is already cancelled.");
    if (po.status === "partially_received" || po.status === "received") throw invalidState("Goods have already been received against this order, so it cannot be cancelled.");
    await tx.update(purchaseOrders).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: why }).where(eq(purchaseOrders.id, id));
    await recordAudit(tx, actor, { action: "purchase_order.cancelled", entityType: "purchase_order", entityId: id, before: { status: po.status }, reason: why });
  });
}

/* ───────────────────────────── goods receipts ───────────────────────────── */

export interface ReceiptLineInput {
  purchaseOrderItemId: string;
  quantity: string;
}

/**
 * Receive goods against a sent / partly received order. Stock increases by exactly the quantity entered
 * (never the ordered quantity), a line can never be over-received, and the order status follows the totals.
 * Runs under the purchase order's row lock, so two people receiving at once cannot exceed the order.
 */
export async function receiveGoods(actor: Actor, purchaseOrderId: string, input: { note?: string; lines: ReceiptLineInput[] }): Promise<{ id: string; reference: string }> {
  requirePermission(actor, "purchasing:receive");
  const lines = input.lines.filter((l) => l.quantity.trim() !== "" && !dec(l.quantity).isZero());
  if (lines.length === 0) throw validation("Enter the quantity received for at least one item.", { lines: ["Enter the quantity received for at least one item."] });
  for (const l of lines) {
    if (!dec(l.quantity).gt(0)) throw validation("Quantities received must be greater than zero.", { lines: ["Quantities received must be greater than zero."] });
  }
  if (new Set(lines.map((l) => l.purchaseOrderItemId)).size !== lines.length) throw validation("Each item can appear only once.", { lines: ["Each item can appear only once."] });

  return withTx(async (tx) => {
    const po = await lockPo(tx, purchaseOrderId);
    if (po.status === "draft") throw invalidState("Mark the purchase order as sent before receiving goods against it.");
    if (po.status === "cancelled") throw invalidState("This purchase order is cancelled.");
    if (po.status === "received") throw invalidState("Everything on this purchase order has already been received.");

    const poLines = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
    const receivedRows = await tx
      .select({ lineId: goodsReceiptItems.purchaseOrderItemId, qty: sql<string>`coalesce(sum(${goodsReceiptItems.quantity}), 0)::text` })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceipts.id, goodsReceiptItems.receiptId))
      .where(eq(goodsReceipts.purchaseOrderId, po.id))
      .groupBy(goodsReceiptItems.purchaseOrderItemId);
    const received = new Map(receivedRows.map((r) => [r.lineId, dec(r.qty)]));
    const byId = new Map(poLines.map((l) => [l.id, l]));

    const problems: string[] = [];
    for (const l of lines) {
      const pl = byId.get(l.purchaseOrderItemId);
      if (!pl) throw validation("A line does not belong to this purchase order.");
      const remaining = dec(pl.quantityOrdered).minus(received.get(pl.id) ?? 0);
      if (dec(l.quantity).gt(remaining)) problems.push(`only ${qtyString(remaining)} still expected for one of the items (you entered ${qtyString(l.quantity)})`);
    }
    if (problems.length) throw validation(`Too much received: ${problems.join("; ")}.`, { lines: problems });

    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('receipt') AS ref`)) as unknown as [{ ref: string }];
    const [gr] = await tx.insert(goodsReceipts).values({ reference: ref, purchaseOrderId: po.id, note: blank(input.note), receivedBy: actor.id }).returning({ id: goodsReceipts.id });
    const movementIds = await applyMovements(
      tx,
      actor.id,
      lines.map((l) => ({ itemId: byId.get(l.purchaseOrderItemId)!.itemId, locationId: po.locationId, type: "receipt" as const, onHandDelta: qtyString(l.quantity), reason: `Received against ${po.reference}`, refType: "goods_receipt", refId: gr!.id })),
    );
    await tx.insert(goodsReceiptItems).values(lines.map((l, i) => ({ receiptId: gr!.id, purchaseOrderItemId: l.purchaseOrderItemId, quantity: qtyString(l.quantity), movementId: movementIds[i]! })));

    for (const l of lines) received.set(l.purchaseOrderItemId, (received.get(l.purchaseOrderItemId) ?? dec(0)).plus(l.quantity));
    const complete = poLines.every((pl) => (received.get(pl.id) ?? dec(0)).gte(pl.quantityOrdered));
    const status: PoStatus = complete ? "received" : "partially_received";
    await tx.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, po.id));
    await recordAudit(tx, actor, { action: "goods.received", entityType: "purchase_order", entityId: po.id, before: { status: po.status }, after: { status, receipt: ref, lines: lines.map((l) => ({ line: l.purchaseOrderItemId, quantity: qtyString(l.quantity) })) } });
    return { id: gr!.id, reference: ref };
  });
}

/* ───────────────────────────── supplier invoice & payments ───────────────────────────── */

/** Record what the supplier invoiced. Operational tracking only — this is not a payables ledger. */
export async function recordSupplierInvoice(actor: Actor, purchaseOrderId: string, input: { ref?: string; amount: string }): Promise<void> {
  requirePermission(actor, "purchasing:record_payment");
  const amount = dec(input.amount);
  if (amount.isNegative()) throw validation("The invoice amount cannot be negative.", { amount: ["The invoice amount cannot be negative."] });
  await withTx(async (tx) => {
    const po = await lockPo(tx, purchaseOrderId);
    if (po.status === "draft" || po.status === "cancelled") throw invalidState("Invoices can be recorded once the order has been sent.");
    const paid = await totalPaid(tx, po.id);
    if (amount.lt(paid)) throw validation(`The invoice cannot be less than what has already been paid (${moneyString(paid)}).`, { amount: [`It cannot be less than what has been paid (${moneyString(paid)}).`] });
    await tx.update(purchaseOrders).set({ supplierInvoiceRef: blank(input.ref), supplierInvoiceAmount: moneyString(amount) }).where(eq(purchaseOrders.id, po.id));
    await recordAudit(tx, actor, { action: "purchase_order.invoice_recorded", entityType: "purchase_order", entityId: po.id, before: { amount: po.supplierInvoiceAmount }, after: { amount: moneyString(amount), ref: input.ref ?? null } });
  });
}

async function totalPaid(db: DbOrTx, poId: string) {
  const [r] = await db.select({ s: sql<string>`coalesce(sum(${supplierPayments.amount}), 0)::text` }).from(supplierPayments).where(eq(supplierPayments.purchaseOrderId, poId));
  return dec(r?.s ?? "0");
}

/** Payments are append-only. They cannot exceed the supplier's invoice (or, with no invoice recorded, the order value). */
export async function recordSupplierPayment(
  actor: Actor,
  purchaseOrderId: string,
  input: { amount: string; method: PaymentMethod; paidAt?: Date; reference?: string; note?: string },
): Promise<string> {
  requirePermission(actor, "purchasing:record_payment");
  const amount = dec(input.amount);
  if (!amount.gt(0)) throw validation("Enter an amount greater than zero.", { amount: ["Enter an amount greater than zero."] });
  return withTx(async (tx) => {
    const po = await lockPo(tx, purchaseOrderId);
    if (po.status === "draft" || po.status === "cancelled") throw invalidState("Payments can be recorded once the order has been sent.");
    const lines = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
    const orderValue = lines.reduce((s, l) => s.plus(dec(l.quantityOrdered).times(l.expectedUnitCost)), dec(0));
    const ceiling = po.supplierInvoiceAmount !== null ? dec(po.supplierInvoiceAmount) : roundMoney(orderValue);
    const owed = ceiling.minus(await totalPaid(tx, po.id));
    if (amount.gt(owed)) {
      const label = po.supplierInvoiceAmount !== null ? "the supplier's invoice" : "the order value";
      throw validation(`That is more than ${label} allows (${owed.toFixed(2)} ${po.currency} still unpaid).`, { amount: [`The most you can record is ${owed.toFixed(2)}.`] });
    }
    const [p] = await tx
      .insert(supplierPayments)
      .values({ purchaseOrderId: po.id, amount: moneyString(amount), method: input.method, paidAt: input.paidAt ?? new Date(), reference: blank(input.reference), note: blank(input.note), recordedBy: actor.id })
      .returning({ id: supplierPayments.id });
    await recordAudit(tx, actor, { action: "supplier_payment.recorded", entityType: "purchase_order", entityId: po.id, after: { paymentId: p!.id, amount: moneyString(amount), method: input.method } });
    return p!.id;
  });
}

/* ───────────────────────────── reads ───────────────────────────── */

export type SupplierPaymentStatus = "unpaid" | "part_paid" | "paid" | "n_a";

function paymentStatus(po: { status: PoStatus; supplierInvoiceAmount: string | null }, orderValue: ReturnType<typeof dec>, paid: ReturnType<typeof dec>): SupplierPaymentStatus {
  if (po.status === "draft" || po.status === "cancelled") return "n_a";
  const due = po.supplierInvoiceAmount !== null ? dec(po.supplierInvoiceAmount) : orderValue;
  if (paid.isZero()) return "unpaid";
  return paid.gte(due) ? "paid" : "part_paid";
}

export interface PoFilters {
  q?: string;
  status?: PoStatus;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}

export async function listPurchaseOrders(actor: Actor, f: PoFilters = {}) {
  requirePermission(actor, "purchasing:view");
  const page = Math.max(1, f.page ?? 1);
  const pageSize = f.pageSize ?? 25;
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(purchaseOrders.status, f.status));
  if (f.supplierId) conds.push(eq(purchaseOrders.supplierId, f.supplierId));
  if (f.q?.trim()) {
    const like = `%${escapeLike(f.q.trim())}%`;
    conds.push(or(ilike(purchaseOrders.reference, like), ilike(suppliers.name, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        reference: purchaseOrders.reference,
        status: purchaseOrders.status,
        expectedOn: purchaseOrders.expectedOn,
        createdAt: purchaseOrders.createdAt,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        currency: purchaseOrders.currency,
        supplierInvoiceAmount: purchaseOrders.supplierInvoiceAmount,
        orderValue: sql<string>`coalesce((select sum(i.quantity_ordered * i.expected_unit_cost) from purchase_order_items i where i.purchase_order_id = ${outer(purchaseOrders.id)}), 0)::text`,
        paid: sql<string>`coalesce((select sum(p.amount) from supplier_payments p where p.purchase_order_id = ${outer(purchaseOrders.id)}), 0)::text`,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(where)
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(purchaseOrders).innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId)).where(where),
  ]);
  // Workshop staff receive goods but do not see purchase costs or what was paid.
  const money = can(actor, "production:view_costs");
  return {
    page,
    pageSize,
    total: count?.n ?? 0,
    showMoney: money,
    rows: rows.map((r) => ({
      ...r,
      supplierInvoiceAmount: money ? r.supplierInvoiceAmount : null,
      orderValue: money ? moneyString(r.orderValue) : null,
      paid: money ? moneyString(r.paid) : null,
      paymentStatus: money ? paymentStatus(r, dec(r.orderValue), dec(r.paid)) : ("n_a" as SupplierPaymentStatus),
    })),
  };
}

export async function getPurchaseOrder(actor: Actor, id: string) {
  requirePermission(actor, "purchasing:view");
  const db = getDb();
  const [po] = await db
    .select({ po: purchaseOrders, supplierName: suppliers.name, locationName: locations.name })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .innerJoin(locations, eq(locations.id, purchaseOrders.locationId))
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!po) throw notFound("That purchase order could not be found.");

  const [lines, receipts, payments] = await Promise.all([
    db
      .select({
        id: purchaseOrderItems.id,
        position: purchaseOrderItems.position,
        itemId: inventoryItems.id,
        itemName: inventoryItems.name,
        sku: inventoryItems.sku,
        unit: inventoryItems.unit,
        quantityOrdered: purchaseOrderItems.quantityOrdered,
        expectedUnitCost: purchaseOrderItems.expectedUnitCost,
        received: sql<string>`coalesce((select sum(g.quantity) from goods_receipt_items g where g.purchase_order_item_id = ${outer(purchaseOrderItems.id)}), 0)::text`,
      })
      .from(purchaseOrderItems)
      .innerJoin(inventoryItems, eq(inventoryItems.id, purchaseOrderItems.itemId))
      .where(eq(purchaseOrderItems.purchaseOrderId, id))
      .orderBy(asc(purchaseOrderItems.position)),
    db
      .select({ id: goodsReceipts.id, reference: goodsReceipts.reference, note: goodsReceipts.note, receivedAt: goodsReceipts.receivedAt, byName: profiles.fullName })
      .from(goodsReceipts)
      .leftJoin(profiles, eq(profiles.id, goodsReceipts.receivedBy))
      .where(eq(goodsReceipts.purchaseOrderId, id))
      .orderBy(desc(goodsReceipts.receivedAt)),
    db
      .select({ id: supplierPayments.id, amount: supplierPayments.amount, method: supplierPayments.method, paidAt: supplierPayments.paidAt, reference: supplierPayments.reference, note: supplierPayments.note, byName: profiles.fullName })
      .from(supplierPayments)
      .leftJoin(profiles, eq(profiles.id, supplierPayments.recordedBy))
      .where(eq(supplierPayments.purchaseOrderId, id))
      .orderBy(desc(supplierPayments.paidAt)),
  ]);

  const orderValue = lines.reduce((s, l) => s.plus(dec(l.quantityOrdered).times(l.expectedUnitCost)), dec(0));
  const paid = payments.reduce((s, p) => s.plus(p.amount), dec(0));
  const money = can(actor, "production:view_costs");
  return {
    ...po.po,
    supplierInvoiceRef: money ? po.po.supplierInvoiceRef : null,
    supplierInvoiceAmount: money ? po.po.supplierInvoiceAmount : null,
    showMoney: money,
    supplierName: po.supplierName,
    locationName: po.locationName,
    lines: lines.map((l) => ({ ...l, expectedUnitCost: money ? l.expectedUnitCost : null, remaining: qtyString(dec(l.quantityOrdered).minus(l.received)) })),
    receipts,
    payments: money ? payments : [],
    orderValue: money ? moneyString(orderValue) : null,
    paid: money ? moneyString(paid) : null,
    paymentStatus: money ? paymentStatus(po.po, orderValue, paid) : ("n_a" as SupplierPaymentStatus),
  };
}

/** Items that can be ordered or consumed, for pickers. Costs shown only to people who may see them. */
export async function listStockItemOptions(actor: Actor, opts: { materialsOnly?: boolean } = {}) {
  requirePermission(actor, "inventory:view_materials");
  const rows = await getDb()
    .select({ id: inventoryItems.id, sku: inventoryItems.sku, name: inventoryItems.name, unit: inventoryItems.unit, kind: inventoryItems.kind, costPrice: inventoryItems.costPrice })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.isActive, true), isNull(inventoryItems.archivedAt)))
    .orderBy(asc(inventoryItems.name));
  const showCost = can(actor, "production:view_costs");
  return rows.filter((r) => !opts.materialsOnly || r.kind !== "finished_good").map((r) => ({ ...r, costPrice: showCost ? r.costPrice : null }));
}
