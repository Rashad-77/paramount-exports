import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { inventoryBalances, inventoryItems, inventoryMovements, locations, productVariants, products, profiles, salesOrderItems, stockReservations, stockTransferItems, stockTransfers } from "@/lib/db/schema";
import { AppError, conflict, forbidden, notFound, validation } from "@/lib/errors";
import { dec, qtyString } from "@/lib/money";
import { recordAudit } from "./audit";
import { escapeLike } from "./leads";

export type MovementType = (typeof inventoryMovements.$inferInsert)["type"];

export interface MovementInput {
  itemId: string;
  locationId: string;
  type: MovementType;
  onHandDelta: string;
  reservedDelta?: string;
  reason?: string | null;
  refType?: string | null;
  refId?: string | null;
}

export class InsufficientStockError extends AppError {
  readonly shortages: Array<{ itemId: string; name: string; available: string; needed: string }>;
  constructor(shortages: InsufficientStockError["shortages"]) {
    const list = shortages.map((s) => `${s.name} (available ${s.available}, needed ${s.needed})`).join("; ");
    super("INSUFFICIENT_STOCK", `Not enough stock: ${list}.`);
    this.shortages = shortages;
  }
}

/* ───────────────────────────── the ledger ───────────────────────────── */

/**
 * The ONLY way stock changes. Call inside a transaction.
 *  1. make sure a balance row exists for every item+location touched;
 *  2. lock those rows in a fixed (item, location) order — no deadlocks between concurrent multi-line orders;
 *  3. replay the movements against the locked balances and refuse (with exact numbers) anything that would
 *     take on-hand or available stock below zero;
 *  4. append the movements. A trigger updates balances; CHECK constraints are the last line of defence.
 */
export async function applyMovements(tx: DbOrTx, actorId: string | null, movements: MovementInput[]): Promise<void> {
  if (movements.length === 0) return;
  const key = (m: { itemId: string; locationId: string }) => `${m.itemId}|${m.locationId}`;
  const pairs = [...new Map(movements.map((m) => [key(m), { itemId: m.itemId, locationId: m.locationId }])).values()].sort((a, b) => (a.itemId + a.locationId < b.itemId + b.locationId ? -1 : 1));

  await tx.insert(inventoryBalances).values(pairs).onConflictDoNothing();
  const state = new Map<string, { onHand: ReturnType<typeof dec>; reserved: ReturnType<typeof dec> }>();
  for (const p of pairs) {
    const [row] = await tx
      .select({ onHand: inventoryBalances.onHand, reserved: inventoryBalances.reserved })
      .from(inventoryBalances)
      .where(and(eq(inventoryBalances.itemId, p.itemId), eq(inventoryBalances.locationId, p.locationId)))
      .for("update");
    state.set(key(p), { onHand: dec(row!.onHand), reserved: dec(row!.reserved) });
  }

  const short = new Map<string, { available: string; needed: string }>();
  for (const m of movements) {
    const s = state.get(key(m))!;
    const available = s.onHand.minus(s.reserved);
    const oh = dec(m.onHandDelta);
    const rv = dec(m.reservedDelta ?? "0");
    const nextOnHand = s.onHand.plus(oh);
    const nextReserved = s.reserved.plus(rv);
    if (nextOnHand.isNegative() || nextReserved.isNegative() || nextReserved.gt(nextOnHand)) {
      const needed = oh.isNegative() ? oh.abs() : rv; // what the caller wanted to take or hold
      short.set(m.itemId, { available: qtyString(available.lt(0) ? 0 : available), needed: qtyString(needed) });
    }
    s.onHand = nextOnHand;
    s.reserved = nextReserved;
  }
  if (short.size) {
    const names = await tx.select({ id: inventoryItems.id, name: inventoryItems.name }).from(inventoryItems).where(inArray(inventoryItems.id, [...short.keys()]));
    throw new InsufficientStockError([...short.entries()].map(([itemId, v]) => ({ itemId, name: names.find((n) => n.id === itemId)?.name ?? "item", ...v })));
  }

  await tx.insert(inventoryMovements).values(
    movements.map((m) => ({
      itemId: m.itemId,
      locationId: m.locationId,
      type: m.type,
      onHandDelta: qtyString(m.onHandDelta),
      reservedDelta: qtyString(m.reservedDelta ?? "0"),
      reason: m.reason ?? null,
      refType: m.refType ?? null,
      refId: m.refId ?? null,
      actorId,
    })),
  );
}

/* ───────────────────────────── locations ───────────────────────────── */

export async function listLocations(actor: Actor, includeArchived = false) {
  requirePermission(actor, "inventory:view");
  return getDb()
    .select()
    .from(locations)
    .where(includeArchived ? undefined : isNull(locations.archivedAt))
    .orderBy(asc(locations.name));
}

export async function saveLocation(actor: Actor, input: { id?: string; name: string; kind: "showroom" | "workshop" | "warehouse"; isActive: boolean }): Promise<string> {
  requirePermission(actor, "inventory:adjust");
  try {
    return await withTx(async (tx) => {
      if (input.id) {
        const [before] = await tx.select().from(locations).where(eq(locations.id, input.id)).for("update");
        if (!before) throw notFound("That location could not be found.");
        await tx.update(locations).set({ name: input.name, kind: input.kind, isActive: input.isActive }).where(eq(locations.id, input.id));
        await recordAudit(tx, actor, { action: "location.updated", entityType: "location", entityId: input.id, before: { name: before.name, kind: before.kind, isActive: before.isActive }, after: { name: input.name, kind: input.kind, isActive: input.isActive } });
        return input.id;
      }
      const [l] = await tx.insert(locations).values({ name: input.name, kind: input.kind, isActive: input.isActive }).returning({ id: locations.id });
      await recordAudit(tx, actor, { action: "location.created", entityType: "location", entityId: l!.id, after: { name: input.name, kind: input.kind } });
      return l!.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A location with that name already exists.");
    throw e;
  }
}

/* ───────────────────────────── items ───────────────────────────── */

const kindsFor = (actor: Actor): Array<"finished_good" | "raw_material" | "consumable"> => {
  const k: Array<"finished_good" | "raw_material" | "consumable"> = [];
  if (can(actor, "inventory:view")) k.push("finished_good");
  if (can(actor, "inventory:view_materials")) k.push("raw_material", "consumable");
  return k;
};

export function assertCanSeeKind(actor: Actor, kind: string) {
  if (!kindsFor(actor).includes(kind as never)) throw forbidden();
}

export async function createInventoryItem(actor: Actor, input: { kind: "finished_good" | "raw_material" | "consumable"; sku: string; name: string; unit: string; costPrice?: string }): Promise<string> {
  requirePermission(actor, "inventory:adjust");
  try {
    return await withTx(async (tx) => {
      const [i] = await tx.insert(inventoryItems).values({ kind: input.kind, sku: input.sku, name: input.name, unit: input.unit, costPrice: input.costPrice ?? null, createdBy: actor.id }).returning({ id: inventoryItems.id });
      await recordAudit(tx, actor, { action: "inventory_item.created", entityType: "inventory_item", entityId: i!.id, after: { sku: input.sku, name: input.name, kind: input.kind } });
      return i!.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "That SKU is already used by another stock item.", { sku: ["That SKU is already in use."] });
    throw e;
  }
}

export async function updateInventoryItem(actor: Actor, id: string, input: { name: string; unit: string; costPrice?: string; isActive: boolean }): Promise<void> {
  requirePermission(actor, "inventory:adjust");
  await withTx(async (tx) => {
    const [before] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id)).for("update");
    if (!before) throw notFound("That stock item could not be found.");
    await tx.update(inventoryItems).set({ name: input.name, unit: input.unit, costPrice: input.costPrice ?? null, isActive: input.isActive }).where(eq(inventoryItems.id, id));
    await recordAudit(tx, actor, { action: "inventory_item.updated", entityType: "inventory_item", entityId: id, before: { name: before.name, costPrice: before.costPrice, isActive: before.isActive }, after: { name: input.name, costPrice: input.costPrice ?? null, isActive: input.isActive } });
  });
}

/** Start counting stock for a product option: creates (or returns) its linked stock item. Idempotent. */
export async function enableStockTracking(actor: Actor, variantId: string): Promise<string> {
  requirePermission(actor, "products:write");
  return withTx(async (tx) => {
    const [v] = await tx
      .select({ id: productVariants.id, sku: productVariants.sku, label: productVariants.label, inventoryItemId: productVariants.inventoryItemId, name: products.name, cost: productVariants.listPrice })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(productVariants.id, variantId))
      .for("update", { of: productVariants });
    if (!v) throw notFound("That product option could not be found.");
    if (v.inventoryItemId) return v.inventoryItemId;
    const name = v.label === "Standard" ? v.name : `${v.name} — ${v.label}`;
    let skuValue = v.sku;
    const [clash] = await tx.select({ id: inventoryItems.id }).from(inventoryItems).where(eq(inventoryItems.sku, skuValue)).limit(1);
    if (clash) skuValue = `${v.sku}-STK`;
    const [i] = await tx.insert(inventoryItems).values({ kind: "finished_good", sku: skuValue, name, unit: "pcs", createdBy: actor.id }).returning({ id: inventoryItems.id });
    await tx.update(productVariants).set({ inventoryItemId: i!.id }).where(eq(productVariants.id, variantId));
    await recordAudit(tx, actor, { action: "stock_tracking.enabled", entityType: "product_variant", entityId: variantId, after: { inventoryItemId: i!.id } });
    return i!.id;
  });
}

export interface StockFilters {
  q?: string;
  kind?: "finished_good" | "raw_material" | "consumable";
  /** Raw materials and consumables only (the Materials page). */
  materialsOnly?: boolean;
  locationId?: string;
  lowOnly?: boolean;
  page: number;
  pageSize: number;
}

export interface StockRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  kind: string;
  isActive: boolean;
  byLocation: Record<string, { onHand: string; reserved: string; available: string; threshold: string | null; low: boolean }>;
  low: boolean;
}

export async function listStock(actor: Actor, f: StockFilters) {
  const allowed = kindsFor(actor);
  if (allowed.length === 0) requirePermission(actor, "inventory:view");
  const kinds = (f.kind ? allowed.filter((k) => k === f.kind) : allowed).filter((k) => !f.materialsOnly || k !== "finished_good");
  const db = getDb();
  const where: SQL[] = [inArray(inventoryItems.kind, kinds.length ? kinds : ["finished_good"]), isNull(inventoryItems.archivedAt)];
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(inventoryItems.name, like), ilike(inventoryItems.sku, like))!);
  }
  const lowSql = sql`EXISTS (SELECT 1 FROM inventory_balances b WHERE b.item_id = ${inventoryItems.id} AND b.low_stock_threshold IS NOT NULL AND (b.on_hand - b.reserved) <= b.low_stock_threshold ${f.locationId ? sql`AND b.location_id = ${f.locationId}` : sql``})`;
  if (f.lowOnly) where.push(lowSql);
  const cond = and(...where);

  const [items, countRows, locs] = await Promise.all([
    db.select().from(inventoryItems).where(cond).orderBy(asc(inventoryItems.name)).limit(f.pageSize).offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(inventoryItems).where(cond),
    db.select().from(locations).where(isNull(locations.archivedAt)).orderBy(asc(locations.name)),
  ]);
  const balances = items.length ? await db.select().from(inventoryBalances).where(inArray(inventoryBalances.itemId, items.map((i) => i.id))) : [];
  const rows: StockRow[] = items.map((i) => {
    const byLocation: StockRow["byLocation"] = {};
    let low = false;
    for (const b of balances.filter((x) => x.itemId === i.id)) {
      const available = dec(b.onHand).minus(b.reserved);
      const isLow = b.lowStockThreshold !== null && available.lte(b.lowStockThreshold);
      low = low || isLow;
      byLocation[b.locationId] = { onHand: b.onHand, reserved: b.reserved, available: qtyString(available), threshold: b.lowStockThreshold, low: isLow };
    }
    return { id: i.id, sku: i.sku, name: i.name, unit: i.unit, kind: i.kind, isActive: i.isActive, byLocation, low };
  });
  const n = countRows[0]?.n ?? 0;
  return { rows, locations: locs, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function getItemWithLedger(actor: Actor, itemId: string, page = 1, pageSize = 30) {
  const db = getDb();
  const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);
  if (!item) throw notFound("That stock item could not be found.");
  assertCanSeeKind(actor, item.kind);
  const [balances, movements, countRows, link] = await Promise.all([
    db
      .select({ locationId: inventoryBalances.locationId, locationName: locations.name, onHand: inventoryBalances.onHand, reserved: inventoryBalances.reserved, threshold: inventoryBalances.lowStockThreshold })
      .from(inventoryBalances)
      .innerJoin(locations, eq(locations.id, inventoryBalances.locationId))
      .where(eq(inventoryBalances.itemId, itemId))
      .orderBy(asc(locations.name)),
    db
      .select({
        id: inventoryMovements.id,
        type: inventoryMovements.type,
        onHandDelta: inventoryMovements.onHandDelta,
        reservedDelta: inventoryMovements.reservedDelta,
        reason: inventoryMovements.reason,
        refType: inventoryMovements.refType,
        refId: inventoryMovements.refId,
        createdAt: inventoryMovements.createdAt,
        locationName: locations.name,
        byName: profiles.fullName,
      })
      .from(inventoryMovements)
      .innerJoin(locations, eq(locations.id, inventoryMovements.locationId))
      .leftJoin(profiles, eq(profiles.id, inventoryMovements.actorId))
      .where(eq(inventoryMovements.itemId, itemId))
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(inventoryMovements).where(eq(inventoryMovements.itemId, itemId)),
    db.select({ variantId: productVariants.id, productId: productVariants.productId }).from(productVariants).where(eq(productVariants.inventoryItemId, itemId)).limit(1),
  ]);
  const n = countRows[0]?.n ?? 0;
  return { item, balances: balances.map((b) => ({ ...b, available: qtyString(dec(b.onHand).minus(b.reserved)) })), movements, total: n, pageCount: Math.max(1, Math.ceil(n / pageSize)), product: link[0] ?? null };
}

/* ───────────────────────────── manual stock changes ───────────────────────────── */

export type ManualKind = "opening" | "receipt" | "adjustment_up" | "adjustment_down" | "waste";

/**
 * Receipts, opening balances, corrections and write-offs. All need inventory:adjust and a REASON, and are audited.
 * Historical movements are never edited: a mistake is fixed with a new, opposite movement.
 */
export async function recordManualMovement(actor: Actor, input: { itemId: string; locationId: string; kind: ManualKind; quantity: string; reason: string }): Promise<void> {
  requirePermission(actor, "inventory:adjust");
  const reason = input.reason.trim();
  if (!reason) throw validation("A reason is required.", { reason: ["Say why the stock is changing."] });
  const q = dec(input.quantity);
  if (!q.gt(0)) throw validation("Enter a quantity greater than zero.", { quantity: ["Enter a quantity greater than zero."] });
  const type: MovementType = input.kind === "adjustment_up" || input.kind === "adjustment_down" ? "adjustment" : input.kind;
  const sign = input.kind === "adjustment_down" || input.kind === "waste" ? -1 : 1;
  await withTx(async (tx) => {
    const [item] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, input.itemId)).limit(1);
    if (!item) throw notFound("That stock item could not be found.");
    const [loc] = await tx.select({ id: locations.id, archivedAt: locations.archivedAt }).from(locations).where(eq(locations.id, input.locationId)).limit(1);
    if (!loc || loc.archivedAt) throw validation("Choose an active location.", { locationId: ["Choose an active location."] });
    const [before] = await tx.select({ onHand: inventoryBalances.onHand }).from(inventoryBalances).where(and(eq(inventoryBalances.itemId, input.itemId), eq(inventoryBalances.locationId, input.locationId)));
    await applyMovements(tx, actor.id, [{ itemId: input.itemId, locationId: input.locationId, type, onHandDelta: q.times(sign).toString(), reason, refType: "manual" }]);
    await recordAudit(tx, actor, { action: `inventory.${input.kind}`, entityType: "inventory_item", entityId: input.itemId, before: { onHand: before?.onHand ?? "0.000" }, after: { change: q.times(sign).toString(), location: input.locationId }, reason });
  });
}

export async function setLowStockThreshold(actor: Actor, input: { itemId: string; locationId: string; threshold: string | null }): Promise<void> {
  requirePermission(actor, "inventory:adjust");
  if (input.threshold !== null && dec(input.threshold).isNegative()) throw validation("The threshold cannot be negative.");
  await withTx(async (tx) => {
    await tx.insert(inventoryBalances).values({ itemId: input.itemId, locationId: input.locationId }).onConflictDoNothing();
    await tx.update(inventoryBalances).set({ lowStockThreshold: input.threshold === null ? null : qtyString(input.threshold) }).where(and(eq(inventoryBalances.itemId, input.itemId), eq(inventoryBalances.locationId, input.locationId)));
    await recordAudit(tx, actor, { action: "inventory.threshold_set", entityType: "inventory_item", entityId: input.itemId, after: { locationId: input.locationId, threshold: input.threshold } });
  });
}

/* ───────────────────────────── transfers ───────────────────────────── */

export async function transferStock(actor: Actor, input: { fromLocationId: string; toLocationId: string; items: Array<{ itemId: string; quantity: string }>; note?: string }): Promise<{ id: string; reference: string }> {
  requirePermission(actor, "inventory:transfer");
  if (input.fromLocationId === input.toLocationId) throw validation("Choose two different locations.", { toLocationId: ["Choose a different destination."] });
  if (input.items.length === 0) throw validation("Add at least one item to transfer.");
  const merged = new Map<string, ReturnType<typeof dec>>();
  for (const i of input.items) {
    const q = dec(i.quantity);
    if (!q.gt(0)) throw validation("Quantities must be greater than zero.");
    merged.set(i.itemId, (merged.get(i.itemId) ?? dec(0)).plus(q));
  }
  return withTx(async (tx) => {
    const locs = await tx.select({ id: locations.id, archivedAt: locations.archivedAt }).from(locations).where(inArray(locations.id, [input.fromLocationId, input.toLocationId]));
    if (locs.length !== 2 || locs.some((l) => l.archivedAt)) throw validation("Choose two active locations.");
    const found = await tx.select().from(inventoryItems).where(inArray(inventoryItems.id, [...merged.keys()]));
    if (found.length !== merged.size) throw notFound("One of the stock items could not be found.");
    for (const i of found) assertCanSeeKind(actor, i.kind);

    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('transfer') AS ref`)) as unknown as [{ ref: string }];
    const [t] = await tx.insert(stockTransfers).values({ reference: ref, fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, note: input.note ?? null, createdBy: actor.id }).returning({ id: stockTransfers.id });
    await tx.insert(stockTransferItems).values([...merged.entries()].map(([itemId, q]) => ({ transferId: t!.id, itemId, quantity: qtyString(q) })));
    // Both sides in ONE transaction: if the source lacks stock, nothing moves at all.
    const movements: MovementInput[] = [...merged.entries()].flatMap(([itemId, q]) => [
      { itemId, locationId: input.fromLocationId, type: "transfer_out" as const, onHandDelta: q.negated().toString(), refType: "stock_transfer", refId: t!.id, reason: `Transfer ${ref}` },
      { itemId, locationId: input.toLocationId, type: "transfer_in" as const, onHandDelta: q.toString(), refType: "stock_transfer", refId: t!.id, reason: `Transfer ${ref}` },
    ]);
    await applyMovements(tx, actor.id, movements);
    await recordAudit(tx, actor, { action: "inventory.transfer", entityType: "stock_transfer", entityId: t!.id, after: { reference: ref, items: merged.size } });
    return { id: t!.id, reference: ref };
  });
}

export async function listTransfers(actor: Actor, page = 1, pageSize = 20) {
  requirePermission(actor, "inventory:transfer");
  const db = getDb();
  const from = sql<string>`(SELECT name FROM locations l WHERE l.id = ${stockTransfers.fromLocationId})`;
  const to = sql<string>`(SELECT name FROM locations l WHERE l.id = ${stockTransfers.toLocationId})`;
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: stockTransfers.id,
        reference: stockTransfers.reference,
        note: stockTransfers.note,
        createdAt: stockTransfers.createdAt,
        fromName: from,
        toName: to,
        byName: profiles.fullName,
        lines: sql<string>`(SELECT string_agg(i.name || ' × ' || trim(trailing '.' from trim(trailing '0' from ti.quantity::text)), ', ' ORDER BY i.name) FROM stock_transfer_items ti JOIN inventory_items i ON i.id = ti.item_id WHERE ti.transfer_id = ${stockTransfers.id})`,
      })
      .from(stockTransfers)
      .leftJoin(profiles, eq(profiles.id, stockTransfers.createdBy))
      .orderBy(desc(stockTransfers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(stockTransfers),
  ]);
  const n = countRows[0]?.n ?? 0;
  return { rows, total: n, pageCount: Math.max(1, Math.ceil(n / pageSize)) };
}

/* ───────────────────────────── reservations (used by orders) ───────────────────────────── */

export interface ReserveLine {
  orderItemId: string;
  itemId: string;
  quantity: string;
}

export async function reserveForOrder(tx: DbOrTx, actorId: string | null, orderId: string, locationId: string, lines: ReserveLine[]): Promise<void> {
  const movements: MovementInput[] = [];
  for (const l of lines) {
    await tx.insert(stockReservations).values({ orderItemId: l.orderItemId, itemId: l.itemId, locationId, quantity: qtyString(l.quantity) });
    movements.push({ itemId: l.itemId, locationId, type: "reserve", onHandDelta: "0", reservedDelta: qtyString(l.quantity), refType: "sales_order", refId: orderId, reason: "Order confirmed" });
  }
  await applyMovements(tx, actorId, movements);
}

async function activeReservations(tx: DbOrTx, orderId: string) {
  return tx
    .select({ r: stockReservations })
    .from(stockReservations)
    .innerJoin(salesOrderItems, eq(salesOrderItems.id, stockReservations.orderItemId))
    .where(and(eq(salesOrderItems.orderId, orderId), eq(stockReservations.status, "active")))
    .for("update", { of: stockReservations });
}

/** Delivery: the held stock leaves the building — on-hand and reserved fall together, exactly once. */
export async function fulfilReservations(tx: DbOrTx, actorId: string | null, orderId: string): Promise<number> {
  const rows = (await activeReservations(tx, orderId)).map((x) => x.r);
  if (rows.length === 0) return 0;
  await applyMovements(
    tx,
    actorId,
    rows.map((r) => ({ itemId: r.itemId, locationId: r.locationId, type: "sale" as const, onHandDelta: dec(r.quantity).negated().toString(), reservedDelta: dec(r.quantity).negated().toString(), refType: "sales_order", refId: orderId, reason: "Order delivered" })),
  );
  await tx.update(stockReservations).set({ status: "fulfilled" }).where(inArray(stockReservations.id, rows.map((r) => r.id)));
  return rows.length;
}

/** Cancellation: the held stock becomes available again, exactly once. */
export async function releaseReservations(tx: DbOrTx, actorId: string | null, orderId: string, reason: string): Promise<number> {
  const rows = (await activeReservations(tx, orderId)).map((x) => x.r);
  if (rows.length === 0) return 0;
  await applyMovements(
    tx,
    actorId,
    rows.map((r) => ({ itemId: r.itemId, locationId: r.locationId, type: "release" as const, onHandDelta: "0", reservedDelta: dec(r.quantity).negated().toString(), refType: "sales_order", refId: orderId, reason })),
  );
  await tx.update(stockReservations).set({ status: "released" }).where(inArray(stockReservations.id, rows.map((r) => r.id)));
  return rows.length;
}

/* ───────────────────────────── integrity & alerts ───────────────────────────── */

/** Every balance must equal the sum of its movements. Returns the mismatches (should always be empty). */
export async function reconcileInventory(db: DbOrTx = getDb()): Promise<Array<{ itemId: string; locationId: string; balanceOnHand: string; ledgerOnHand: string; balanceReserved: string; ledgerReserved: string }>> {
  const rows = await db.execute(sql`
    SELECT coalesce(b.item_id, m.item_id) AS item_id, coalesce(b.location_id, m.location_id) AS location_id,
           coalesce(b.on_hand, 0)::text AS balance_on_hand, coalesce(m.oh, 0)::text AS ledger_on_hand,
           coalesce(b.reserved, 0)::text AS balance_reserved, coalesce(m.rv, 0)::text AS ledger_reserved
    FROM inventory_balances b
    FULL JOIN (SELECT item_id, location_id, sum(on_hand_delta) AS oh, sum(reserved_delta) AS rv FROM inventory_movements GROUP BY 1, 2) m
      ON m.item_id = b.item_id AND m.location_id = b.location_id
    WHERE coalesce(b.on_hand, 0) <> coalesce(m.oh, 0) OR coalesce(b.reserved, 0) <> coalesce(m.rv, 0)`);
  return (rows as unknown as Array<Record<string, string>>).map((r) => ({
    itemId: r.item_id!,
    locationId: r.location_id!,
    balanceOnHand: r.balance_on_hand!,
    ledgerOnHand: r.ledger_on_hand!,
    balanceReserved: r.balance_reserved!,
    ledgerReserved: r.ledger_reserved!,
  }));
}

export async function lowStockAlerts(actor: Actor) {
  const kinds = kindsFor(actor);
  if (kinds.length === 0) requirePermission(actor, "inventory:view");
  const rows = await getDb().execute(sql`
    SELECT i.id, i.name, i.sku, i.unit, i.kind::text AS kind, l.name AS location, b.on_hand::text AS on_hand, b.reserved::text AS reserved,
           (b.on_hand - b.reserved)::text AS available, b.low_stock_threshold::text AS threshold
    FROM inventory_balances b
    JOIN inventory_items i ON i.id = b.item_id
    JOIN locations l ON l.id = b.location_id
    WHERE b.low_stock_threshold IS NOT NULL AND (b.on_hand - b.reserved) <= b.low_stock_threshold AND i.archived_at IS NULL
      AND i.kind::text = ANY(${sql.raw(`ARRAY[${kinds.map((k) => `'${k}'`).join(",")}]`)})
    ORDER BY i.name, l.name`);
  return rows as unknown as Array<{ id: string; name: string; sku: string; unit: string; kind: string; location: string; on_hand: string; reserved: string; available: string; threshold: string }>;
}
