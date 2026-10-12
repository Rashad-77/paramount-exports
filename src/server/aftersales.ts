import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { afterSalesCases, afterSalesNotes, customers, profiles, salesOrders } from "@/lib/db/schema";
import { invalidState, notFound, validation } from "@/lib/errors";
import { recordAudit } from "./audit";
import { escapeLike } from "./leads";

export type CaseType = (typeof afterSalesCases.$inferSelect)["type"];
export type CaseStatus = (typeof afterSalesCases.$inferSelect)["status"];

export const CASE_FLOW: Record<CaseStatus, CaseStatus[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["open", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export async function createCase(actor: Actor, input: { customerId: string; orderId?: string; type: CaseType; subject: string; description?: string; assigneeId?: string; dueOn?: string }): Promise<string> {
  requirePermission(actor, "aftersales:manage");
  const subject = input.subject.trim();
  if (!subject) throw validation("Give the case a short subject.", { subject: ["Give the case a short subject."] });
  return withTx(async (tx) => {
    const [c] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId));
    if (!c) throw validation("Choose a customer.", { customerId: ["Choose a customer."] });
    if (input.orderId) {
      const [o] = await tx.select({ customerId: salesOrders.customerId }).from(salesOrders).where(eq(salesOrders.id, input.orderId));
      if (!o) throw validation("That order could not be found.", { orderId: ["That order could not be found."] });
      if (o.customerId !== input.customerId) throw validation("That order belongs to a different customer.", { orderId: ["Choose one of this customer's orders."] });
    }
    if (input.assigneeId) {
      const [p] = await tx.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.id, input.assigneeId), eq(profiles.isActive, true)));
      if (!p) throw validation("Choose an active staff member.", { assigneeId: ["Choose an active staff member."] });
    }
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('case') AS ref`)) as unknown as [{ ref: string }];
    const [row] = await tx
      .insert(afterSalesCases)
      .values({ reference: ref, customerId: input.customerId, orderId: input.orderId ?? null, type: input.type, subject, description: blank(input.description), assigneeId: input.assigneeId ?? null, dueOn: input.dueOn ?? null, createdBy: actor.id })
      .returning({ id: afterSalesCases.id });
    await tx.insert(afterSalesNotes).values({ caseId: row!.id, fromStatus: null, toStatus: "open", body: "Case opened.", createdBy: actor.id });
    await recordAudit(tx, actor, { action: "case.created", entityType: "after_sales_case", entityId: row!.id, after: { reference: ref, type: input.type, customerId: input.customerId } });
    return row!.id;
  });
}

export async function updateCase(actor: Actor, id: string, input: { subject: string; description?: string; assigneeId?: string; dueOn?: string }): Promise<void> {
  requirePermission(actor, "aftersales:manage");
  const subject = input.subject.trim();
  if (!subject) throw validation("Give the case a short subject.", { subject: ["Give the case a short subject."] });
  await withTx(async (tx) => {
    const c = await lockCase(tx, id);
    if (c.status === "closed") throw invalidState("A closed case cannot be changed.");
    await tx.update(afterSalesCases).set({ subject, description: blank(input.description), assigneeId: input.assigneeId ?? null, dueOn: input.dueOn ?? null }).where(eq(afterSalesCases.id, id));
    await recordAudit(tx, actor, { action: "case.updated", entityType: "after_sales_case", entityId: id, before: { assigneeId: c.assigneeId, dueOn: c.dueOn }, after: { assigneeId: input.assigneeId ?? null, dueOn: input.dueOn ?? null } });
  });
}

async function lockCase(tx: DbOrTx, id: string) {
  const [c] = await tx.select().from(afterSalesCases).where(eq(afterSalesCases.id, id)).for("update");
  if (!c) throw notFound("That case could not be found.");
  return c;
}

/** Resolving or closing needs a written resolution — so "closed" always means something was done and recorded. */
export async function changeCaseStatus(actor: Actor, id: string, to: CaseStatus, input: { resolution?: string; note?: string } = {}): Promise<void> {
  requirePermission(actor, "aftersales:manage");
  await withTx(async (tx) => {
    const c = await lockCase(tx, id);
    if (!CASE_FLOW[c.status].includes(to)) throw invalidState(`A case that is ${c.status.replace("_", " ")} cannot move to ${to.replace("_", " ")}.`);
    const resolution = input.resolution?.trim() || c.resolution;
    if ((to === "resolved" || to === "closed") && !resolution) throw validation("Record what was done to resolve this case.", { resolution: ["Describe the resolution."] });
    await tx
      .update(afterSalesCases)
      .set({ status: to, resolution: to === "resolved" || to === "closed" ? resolution : c.resolution, resolvedAt: to === "resolved" ? new Date() : to === "in_progress" || to === "open" ? null : c.resolvedAt })
      .where(eq(afterSalesCases.id, id));
    await tx.insert(afterSalesNotes).values({ caseId: id, fromStatus: c.status, toStatus: to, body: blank(input.note) ?? (to === "resolved" || to === "closed" ? resolution : null), createdBy: actor.id });
    await recordAudit(tx, actor, { action: `case.${to}`, entityType: "after_sales_case", entityId: id, before: { status: c.status }, after: { status: to } });
  });
}

export async function addCaseNote(actor: Actor, id: string, body: string): Promise<void> {
  requirePermission(actor, "aftersales:manage");
  const text = body.trim();
  if (!text) throw validation("Write a note first.", { body: ["Write a note first."] });
  await withTx(async (tx) => {
    const c = await lockCase(tx, id);
    if (c.status === "closed") throw invalidState("A closed case cannot be changed.");
    await tx.insert(afterSalesNotes).values({ caseId: id, body: text, createdBy: actor.id });
  });
}

export interface CaseFilters {
  status?: CaseStatus | "active";
  type?: CaseType;
  q?: string;
  customerId?: string;
  page: number;
  pageSize: number;
}

export async function listCases(actor: Actor, f: CaseFilters) {
  requirePermission(actor, "aftersales:view");
  const where: SQL[] = [];
  if (f.status === "active") where.push(inArray(afterSalesCases.status, ["open", "in_progress"]));
  else if (f.status) where.push(eq(afterSalesCases.status, f.status));
  if (f.type) where.push(eq(afterSalesCases.type, f.type));
  if (f.customerId) where.push(eq(afterSalesCases.customerId, f.customerId));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(afterSalesCases.reference, like), ilike(afterSalesCases.subject, like), ilike(customers.name, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, [count]] = await Promise.all([
    db
      .select({ id: afterSalesCases.id, reference: afterSalesCases.reference, type: afterSalesCases.type, status: afterSalesCases.status, subject: afterSalesCases.subject, dueOn: afterSalesCases.dueOn, createdAt: afterSalesCases.createdAt, customerId: customers.id, customerName: customers.name, assigneeName: profiles.fullName })
      .from(afterSalesCases)
      .innerJoin(customers, eq(customers.id, afterSalesCases.customerId))
      .leftJoin(profiles, eq(profiles.id, afterSalesCases.assigneeId))
      .where(cond)
      .orderBy(sql`CASE ${afterSalesCases.status} WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END`, asc(afterSalesCases.dueOn), desc(afterSalesCases.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(afterSalesCases).innerJoin(customers, eq(customers.id, afterSalesCases.customerId)).where(cond),
  ]);
  const n = count?.n ?? 0;
  return { rows, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function getCase(actor: Actor, id: string) {
  requirePermission(actor, "aftersales:view");
  const db = getDb();
  const [row] = await db
    .select({ c: afterSalesCases, customerName: customers.name, orderReference: salesOrders.reference, assigneeName: profiles.fullName })
    .from(afterSalesCases)
    .innerJoin(customers, eq(customers.id, afterSalesCases.customerId))
    .leftJoin(salesOrders, eq(salesOrders.id, afterSalesCases.orderId))
    .leftJoin(profiles, eq(profiles.id, afterSalesCases.assigneeId))
    .where(eq(afterSalesCases.id, id));
  if (!row) throw notFound("That case could not be found.");
  const notes = await db
    .select({ id: afterSalesNotes.id, from: afterSalesNotes.fromStatus, to: afterSalesNotes.toStatus, body: afterSalesNotes.body, at: afterSalesNotes.createdAt, byName: profiles.fullName })
    .from(afterSalesNotes)
    .leftJoin(profiles, eq(profiles.id, afterSalesNotes.createdBy))
    .where(eq(afterSalesNotes.caseId, id))
    .orderBy(desc(afterSalesNotes.createdAt), desc(afterSalesNotes.id));
  return { case: row.c, customerName: row.customerName, orderReference: row.orderReference, assigneeName: row.assigneeName, notes };
}

export async function listCasesForOrder(actor: Actor, orderId: string) {
  if (!actor.isActive) return [];
  try {
    requirePermission(actor, "aftersales:view");
  } catch {
    return [];
  }
  return getDb().select({ id: afterSalesCases.id, reference: afterSalesCases.reference, type: afterSalesCases.type, status: afterSalesCases.status, subject: afterSalesCases.subject }).from(afterSalesCases).where(eq(afterSalesCases.orderId, orderId)).orderBy(desc(afterSalesCases.createdAt));
}
