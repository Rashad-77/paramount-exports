import "server-only";
import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, scopeOf, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { customers, deliveries, deliveryEvents, profiles, salesOrders, uploadedFiles, userRoles } from "@/lib/db/schema";
import { forbidden, invalidState, notFound, validation } from "@/lib/errors";
import { dec, moneyString } from "@/lib/money";
import { recordAudit } from "./audit";
import { linkUploads, verifyUploads } from "./files";
import { escapeLike } from "./leads";
import { advanceOrderInTx } from "./orders";

export type DeliveryStatus = (typeof deliveries.$inferSelect)["status"];

export interface DeliveryInput {
  orderId: string;
  scheduledOn: string;
  windowStart?: string;
  windowEnd?: string;
  addressLine: string;
  contactName: string;
  contactPhone: string;
  fee?: string;
  assigneeId?: string;
  notes?: string;
}

const OPEN_ORDER_STATUSES = ["confirmed", "preparing", "ready"];
const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

function checkWindow(i: Pick<DeliveryInput, "windowStart" | "windowEnd">) {
  if (i.windowStart && i.windowEnd && i.windowStart >= i.windowEnd) throw validation("The delivery window must end after it starts.", { windowEnd: ["Choose a later end time."] });
  if ((i.windowStart && !i.windowEnd) || (!i.windowStart && i.windowEnd)) throw validation("Enter both the start and end of the window, or neither.", { windowEnd: ["Enter both times, or leave both blank."] });
}

async function assertAssignable(db: DbOrTx, assigneeId: string | undefined) {
  if (!assigneeId) return;
  const [p] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.id, assigneeId), eq(profiles.isActive, true)));
  if (!p) throw validation("Choose an active staff member.", { assigneeId: ["Choose an active staff member."] });
}

/** Staff who can be sent on a delivery. */
export async function listDeliveryStaff(actor: Actor): Promise<Array<{ id: string; name: string }>> {
  requirePermission(actor, "deliveries:write");
  return getDb()
    .selectDistinct({ id: profiles.id, name: profiles.fullName })
    .from(profiles)
    .innerJoin(userRoles, eq(userRoles.userId, profiles.id))
    .where(eq(profiles.isActive, true))
    .orderBy(asc(profiles.fullName));
}

/** Pre-filled values for the schedule form: the customer's own details and the order's delivery charge. */
export async function deliveryDefaults(actor: Actor, orderId: string) {
  requirePermission(actor, "deliveries:write");
  const [row] = await getDb()
    .select({ ref: salesOrders.reference, status: salesOrders.status, fee: salesOrders.deliveryCharge, name: customers.name, phone: customers.phone, address: customers.address })
    .from(salesOrders)
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(eq(salesOrders.id, orderId));
  if (!row) throw notFound("That order could not be found.");
  return { orderReference: row.ref, orderStatus: row.status, fee: row.fee, contactName: row.name, contactPhone: row.phone, addressLine: row.address ?? "" };
}

export async function createDelivery(actor: Actor, input: DeliveryInput, opts: { rescheduledFromId?: string } = {}): Promise<string> {
  requirePermission(actor, "deliveries:write");
  checkWindow(input);
  const fee = dec(input.fee || "0");
  if (fee.isNegative()) throw validation("The fee cannot be negative.", { fee: ["The fee cannot be negative."] });
  try {
    return await withTx(async (tx) => {
      await assertAssignable(tx, input.assigneeId);
      const [o] = await tx.select().from(salesOrders).where(eq(salesOrders.id, input.orderId)).for("update");
      if (!o) throw notFound("That order could not be found.");
      if (!OPEN_ORDER_STATUSES.includes(o.status)) throw invalidState(o.status === "draft" ? "Confirm the order before scheduling its delivery." : `A ${o.status} order cannot be scheduled for delivery.`);
      const [{ ref }] = (await tx.execute(sql`SELECT next_reference('delivery') AS ref`)) as unknown as [{ ref: string }];
      const [d] = await tx
        .insert(deliveries)
        .values({
          reference: ref,
          orderId: o.id,
          scheduledOn: input.scheduledOn,
          windowStart: blank(input.windowStart),
          windowEnd: blank(input.windowEnd),
          addressLine: input.addressLine.trim(),
          contactName: input.contactName.trim(),
          contactPhone: input.contactPhone.trim(),
          fee: moneyString(fee),
          assigneeId: input.assigneeId ?? null,
          notes: blank(input.notes),
          rescheduledFromId: opts.rescheduledFromId ?? null,
          createdBy: actor.id,
        })
        .returning({ id: deliveries.id });
      await tx.insert(deliveryEvents).values({ deliveryId: d!.id, fromStatus: null, toStatus: "planned", note: opts.rescheduledFromId ? "Rescheduled after a failed attempt." : "Scheduled.", changedBy: actor.id });
      await recordAudit(tx, actor, { action: opts.rescheduledFromId ? "delivery.rescheduled" : "delivery.scheduled", entityType: "delivery", entityId: d!.id, after: { reference: ref, order: o.reference, scheduledOn: input.scheduledOn } });
      return d!.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw invalidState("This order already has a delivery that has not finished. Complete or fail it first.");
    throw e;
  }
}

export async function updateDelivery(actor: Actor, id: string, input: Omit<DeliveryInput, "orderId">): Promise<void> {
  requirePermission(actor, "deliveries:write");
  checkWindow(input);
  const fee = dec(input.fee || "0");
  if (fee.isNegative()) throw validation("The fee cannot be negative.", { fee: ["The fee cannot be negative."] });
  await withTx(async (tx) => {
    await assertAssignable(tx, input.assigneeId);
    const [d] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
    if (!d) throw notFound("That delivery could not be found.");
    if (d.status !== "planned") throw invalidState("Only a planned delivery can be changed. Once it is out, update its status instead.");
    await tx
      .update(deliveries)
      .set({ scheduledOn: input.scheduledOn, windowStart: blank(input.windowStart), windowEnd: blank(input.windowEnd), addressLine: input.addressLine.trim(), contactName: input.contactName.trim(), contactPhone: input.contactPhone.trim(), fee: moneyString(fee), assigneeId: input.assigneeId ?? null, notes: blank(input.notes) })
      .where(eq(deliveries.id, id));
    await recordAudit(tx, actor, { action: "delivery.updated", entityType: "delivery", entityId: id, before: { scheduledOn: d.scheduledOn, assigneeId: d.assigneeId }, after: { scheduledOn: input.scheduledOn, assigneeId: input.assigneeId ?? null } });
  });
}

/** Scope "own" (workshop) = deliveries assigned to the person. */
async function assertDeliveryAccess(db: DbOrTx, actor: Actor, delivery: { assigneeId: string | null }, permission: "deliveries:view" | "deliveries:update_status") {
  const scope = requirePermission(actor, permission);
  if (scope === "all") return;
  if (delivery.assigneeId !== actor.id) throw forbidden("That delivery is not assigned to you.");
  void db;
}

export async function setDeliveryStatus(
  actor: Actor,
  id: string,
  to: "out_for_delivery" | "delivered" | "failed",
  input: { note?: string; proofFileIds?: string[] } = {},
  now: Date = new Date(),
): Promise<void> {
  requirePermission(actor, "deliveries:update_status");
  const note = input.note?.trim() || null;
  const fileIds = input.proofFileIds ?? [];
  if (to === "failed" && !note) throw validation("Say why the delivery failed.", { note: ["Add a short reason."] });
  if (to === "delivered" && !note && fileIds.length === 0) throw validation("Add a proof note or a photo before marking this delivered.", { note: ["Add a note (who received it) or attach a photo."] });
  const verified = to === "delivered" ? await verifyUploads(fileIds, "delivery_proof", actor) : [];

  await withTx(async (tx) => {
    const [d] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
    if (!d) throw notFound("That delivery could not be found.");
    await assertDeliveryAccess(tx, actor, d, "deliveries:update_status");
    const allowed: Record<string, string[]> = { planned: ["out_for_delivery", "delivered", "failed"], out_for_delivery: ["delivered", "failed"] };
    if (!(allowed[d.status] ?? []).includes(to)) throw invalidState(`A delivery that is ${d.status.replace(/_/g, " ")} cannot be marked ${to.replace(/_/g, " ")}.`);

    const patch: Partial<typeof deliveries.$inferInsert> = { status: to };
    if (to === "delivered") {
      // The order is delivered with it: reserved stock leaves (or the finished custom piece), exactly once, in this transaction.
      const [o] = await tx.select({ status: salesOrders.status }).from(salesOrders).where(eq(salesOrders.id, d.orderId)).for("update");
      if (!o || o.status === "cancelled" || o.status === "draft") throw invalidState("The order is not in a state that can be delivered.");
      if (o.status !== "delivered") await advanceOrderInTx(tx, actor, d.orderId, "delivered", now);
      patch.deliveredAt = now;
      patch.proofNote = note;
      if (verified[0]) {
        await linkUploads(tx, verified, { type: "delivery", id: id });
        patch.proofFileId = verified[0].id;
      }
    }
    if (to === "failed") patch.failedReason = note;
    await tx.update(deliveries).set(patch).where(eq(deliveries.id, id));
    await tx.insert(deliveryEvents).values({ deliveryId: id, fromStatus: d.status, toStatus: to, note, changedBy: actor.id });
    await recordAudit(tx, actor, { action: `delivery.${to}`, entityType: "delivery", entityId: id, before: { status: d.status }, after: { status: to }, reason: to === "failed" ? (note ?? undefined) : undefined });
  });
}

/** After a failed attempt: schedule a NEW delivery for the same order (the failed one stays on record). */
export async function rescheduleDelivery(actor: Actor, failedId: string, input: Pick<DeliveryInput, "scheduledOn" | "windowStart" | "windowEnd" | "assigneeId" | "notes">): Promise<string> {
  requirePermission(actor, "deliveries:write");
  const [d] = await getDb().select().from(deliveries).where(eq(deliveries.id, failedId));
  if (!d) throw notFound("That delivery could not be found.");
  if (d.status !== "failed") throw invalidState("Only a failed delivery can be rescheduled.");
  return createDelivery(
    actor,
    { orderId: d.orderId, scheduledOn: input.scheduledOn, windowStart: input.windowStart, windowEnd: input.windowEnd, addressLine: d.addressLine, contactName: d.contactName, contactPhone: d.contactPhone, fee: d.fee, assigneeId: input.assigneeId ?? d.assigneeId ?? undefined, notes: input.notes ?? d.notes ?? undefined },
    { rescheduledFromId: d.id },
  );
}

export interface DeliveryFilters {
  status?: DeliveryStatus;
  from?: string;
  to?: string;
  mine?: boolean;
  q?: string;
  page: number;
  pageSize: number;
}

export async function listDeliveries(actor: Actor, f: DeliveryFilters) {
  const scope = requirePermission(actor, "deliveries:view");
  const where: SQL[] = [];
  if (scope === "own" || f.mine) where.push(eq(deliveries.assigneeId, actor.id));
  if (f.status) where.push(eq(deliveries.status, f.status));
  if (f.from) where.push(gte(deliveries.scheduledOn, f.from));
  if (f.to) where.push(lte(deliveries.scheduledOn, f.to));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(deliveries.reference, like), ilike(salesOrders.reference, like), ilike(deliveries.contactName, like), ilike(deliveries.addressLine, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: deliveries.id,
        reference: deliveries.reference,
        status: deliveries.status,
        scheduledOn: deliveries.scheduledOn,
        windowStart: deliveries.windowStart,
        windowEnd: deliveries.windowEnd,
        addressLine: deliveries.addressLine,
        contactName: deliveries.contactName,
        orderId: salesOrders.id,
        orderReference: salesOrders.reference,
        assigneeName: profiles.fullName,
      })
      .from(deliveries)
      .innerJoin(salesOrders, eq(salesOrders.id, deliveries.orderId))
      .leftJoin(profiles, eq(profiles.id, deliveries.assigneeId))
      .where(cond)
      .orderBy(sql`CASE ${deliveries.status} WHEN 'out_for_delivery' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END`, asc(deliveries.scheduledOn), asc(deliveries.windowStart))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(deliveries).innerJoin(salesOrders, eq(salesOrders.id, deliveries.orderId)).where(cond),
  ]);
  const n = count?.n ?? 0;
  return { rows, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function getDelivery(actor: Actor, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ d: deliveries, orderReference: salesOrders.reference, orderStatus: salesOrders.status, orderType: salesOrders.type, assigneeName: profiles.fullName })
    .from(deliveries)
    .innerJoin(salesOrders, eq(salesOrders.id, deliveries.orderId))
    .leftJoin(profiles, eq(profiles.id, deliveries.assigneeId))
    .where(eq(deliveries.id, id));
  if (!row) throw notFound("That delivery could not be found.");
  await assertDeliveryAccess(db, actor, row.d, "deliveries:view");
  const [events, proof] = await Promise.all([
    db.select({ id: deliveryEvents.id, from: deliveryEvents.fromStatus, to: deliveryEvents.toStatus, note: deliveryEvents.note, at: deliveryEvents.changedAt, byName: profiles.fullName }).from(deliveryEvents).leftJoin(profiles, eq(profiles.id, deliveryEvents.changedBy)).where(eq(deliveryEvents.deliveryId, id)).orderBy(desc(deliveryEvents.changedAt), desc(deliveryEvents.id)),
    row.d.proofFileId ? db.select({ id: uploadedFiles.id, name: uploadedFiles.originalName }).from(uploadedFiles).where(eq(uploadedFiles.id, row.d.proofFileId)) : Promise.resolve([]),
  ]);
  return {
    delivery: row.d,
    order: { id: row.d.orderId, reference: row.orderReference, status: row.orderStatus, type: row.orderType },
    assigneeName: row.assigneeName,
    events,
    proof: proof[0] ?? null,
    canSchedule: can(actor, "deliveries:write"),
    scopeOwn: scopeOf(actor, "deliveries:view") === "own",
  };
}

/** For the order page. */
export async function listDeliveriesForOrder(actor: Actor, orderId: string) {
  if (!can(actor, "deliveries:view")) return [];
  const own = scopeOf(actor, "deliveries:view") === "own";
  return getDb()
    .select({ id: deliveries.id, reference: deliveries.reference, status: deliveries.status, scheduledOn: deliveries.scheduledOn, assigneeName: profiles.fullName })
    .from(deliveries)
    .leftJoin(profiles, eq(profiles.id, deliveries.assigneeId))
    .where(and(eq(deliveries.orderId, orderId), own ? eq(deliveries.assigneeId, actor.id) : undefined))
    .orderBy(desc(deliveries.createdAt));
}
