import "server-only";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, type Actor } from "@/lib/auth/permissions";
import { normaliseEmail, phoneKey } from "@/lib/contact";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { customers, followUpTasks, leadActivities, leads, profiles } from "@/lib/db/schema";
import { forbidden, notFound, validation } from "@/lib/errors";
import type { ActivityInput, FollowUpInput, ManualLeadInput } from "@/lib/schemas/crm";
import { getBusinessSettings } from "@/lib/settings";
import { todayLocal } from "@/lib/time";
import { recordAudit } from "./audit";
import { findCustomerMatches } from "./customers";
import { linkUploads, verifyUploads } from "./files";
import { listAssignableStaff } from "./leads";

/* ───────────────────────────── activities ───────────────────────────── */

export async function addActivity(actor: Actor, input: ActivityInput): Promise<string> {
  // Anyone who works on enquiries or customers may record what happened.
  if (!can(actor, "leads:write") && !can(actor, "customers:write")) requirePermission(actor, "leads:write");
  return withTx(async (tx) => {
    let customerId = input.customerId ?? null;
    if (input.leadId) {
      const [lead] = await tx.select({ id: leads.id, customerId: leads.customerId }).from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw notFound("That enquiry could not be found.");
      customerId = customerId ?? lead.customerId;
    } else if (customerId) {
      const [c] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!c) throw notFound("That customer could not be found.");
    }
    const [a] = await tx
      .insert(leadActivities)
      .values({ leadId: input.leadId ?? null, customerId, type: input.type, body: input.body, createdBy: actor.id })
      .returning({ id: leadActivities.id });
    return a!.id;
  });
}

export async function listActivities(actor: Actor, subject: { leadId?: string; customerId?: string }, limit = 50) {
  if (!can(actor, "leads:view") && !can(actor, "customers:view")) requirePermission(actor, "leads:view");
  const cond = subject.leadId ? eq(leadActivities.leadId, subject.leadId) : subject.customerId ? eq(leadActivities.customerId, subject.customerId) : sql`false`;
  return getDb()
    .select({
      id: leadActivities.id,
      type: leadActivities.type,
      body: leadActivities.body,
      occurredAt: leadActivities.occurredAt,
      leadId: leadActivities.leadId,
      byName: profiles.fullName,
    })
    .from(leadActivities)
    .leftJoin(profiles, eq(profiles.id, leadActivities.createdBy))
    .where(cond)
    .orderBy(desc(leadActivities.occurredAt), desc(leadActivities.createdAt))
    .limit(limit);
}

/* ───────────────────────────── follow-ups ───────────────────────────── */

/** Keep leads.next_follow_up_on equal to the earliest still-open task for that lead. */
async function syncLeadNextFollowUp(tx: DbOrTx, leadId: string) {
  await tx.execute(sql`
    UPDATE leads SET next_follow_up_on = (
      SELECT min(due_on) FROM follow_up_tasks WHERE lead_id = ${leadId} AND completed_at IS NULL
    ) WHERE id = ${leadId}`);
}

export async function createFollowUp(actor: Actor, input: FollowUpInput): Promise<string> {
  requirePermission(actor, "followups:manage");
  const staff = await listAssignableStaff(actor).catch(() => []);
  // listAssignableStaff needs leads:view; Sales/Manager/Owner all have it. Anyone else cannot reach here anyway.
  if (!staff.some((s) => s.id === input.assignedTo)) throw validation("Choose an active team member.", { assignedTo: ["Choose an active team member."] });
  return withTx(async (tx) => {
    let customerId = input.customerId ?? null;
    if (input.leadId) {
      const [lead] = await tx.select({ id: leads.id, customerId: leads.customerId }).from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw notFound("That enquiry could not be found.");
      customerId = customerId ?? lead.customerId;
    }
    const [t] = await tx
      .insert(followUpTasks)
      .values({ leadId: input.leadId ?? null, customerId, assignedTo: input.assignedTo, title: input.title, notes: input.notes ?? null, dueOn: input.dueOn, createdBy: actor.id })
      .returning({ id: followUpTasks.id });
    if (input.leadId) await syncLeadNextFollowUp(tx, input.leadId);
    return t!.id;
  });
}

export async function completeFollowUp(actor: Actor, taskId: string): Promise<void> {
  requirePermission(actor, "followups:manage");
  await withTx(async (tx) => {
    const [t] = await tx.select().from(followUpTasks).where(eq(followUpTasks.id, taskId)).for("update");
    if (!t) throw notFound("That follow-up could not be found.");
    if (t.completedAt) return; // already done: idempotent
    await tx.update(followUpTasks).set({ completedAt: new Date(), completedBy: actor.id }).where(eq(followUpTasks.id, taskId));
    if (t.leadId) await syncLeadNextFollowUp(tx, t.leadId);
  });
}

export interface FollowUpFilters {
  assignee?: "me" | "all" | string;
  status?: "open" | "overdue" | "done";
  page: number;
  pageSize: number;
}

export async function listFollowUps(actor: Actor, f: FollowUpFilters, now: Date = new Date()) {
  requirePermission(actor, "followups:manage");
  const tz = (await getBusinessSettings()).timezone;
  const today = todayLocal(tz, now);
  const where: SQL[] = [];
  if (f.status === "done") where.push(sql`${followUpTasks.completedAt} IS NOT NULL`);
  else {
    where.push(isNull(followUpTasks.completedAt));
    if (f.status === "overdue") where.push(sql`${followUpTasks.dueOn} < ${today}`);
  }
  if (f.assignee === "me") where.push(eq(followUpTasks.assignedTo, actor.id));
  else if (f.assignee && f.assignee !== "all") where.push(eq(followUpTasks.assignedTo, f.assignee));
  const cond = and(...where);
  const db = getDb();
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: followUpTasks.id,
        title: followUpTasks.title,
        notes: followUpTasks.notes,
        dueOn: followUpTasks.dueOn,
        completedAt: followUpTasks.completedAt,
        assignedTo: followUpTasks.assignedTo,
        assigneeName: profiles.fullName,
        leadId: followUpTasks.leadId,
        customerId: followUpTasks.customerId,
        leadReference: leads.reference,
        leadName: leads.contactName,
        customerName: customers.name,
      })
      .from(followUpTasks)
      .innerJoin(profiles, eq(profiles.id, followUpTasks.assignedTo))
      .leftJoin(leads, eq(leads.id, followUpTasks.leadId))
      .leftJoin(customers, eq(customers.id, followUpTasks.customerId))
      .where(cond)
      .orderBy(f.status === "done" ? desc(followUpTasks.completedAt) : asc(followUpTasks.dueOn), asc(followUpTasks.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(followUpTasks).where(cond),
  ]);
  const n = countRows[0]?.n ?? 0;
  return { rows: rows.map((r) => ({ ...r, overdue: !r.completedAt && r.dueOn < today })), today, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function listFollowUpsFor(actor: Actor, subject: { leadId?: string; customerId?: string }) {
  requirePermission(actor, "followups:manage");
  const tz = (await getBusinessSettings()).timezone;
  const today = todayLocal(tz);
  const cond = subject.leadId ? eq(followUpTasks.leadId, subject.leadId) : subject.customerId ? eq(followUpTasks.customerId, subject.customerId) : sql`false`;
  const rows = await getDb()
    .select({ id: followUpTasks.id, title: followUpTasks.title, dueOn: followUpTasks.dueOn, completedAt: followUpTasks.completedAt, assigneeName: profiles.fullName })
    .from(followUpTasks)
    .innerJoin(profiles, eq(profiles.id, followUpTasks.assignedTo))
    .where(cond)
    .orderBy(sql`${followUpTasks.completedAt} IS NOT NULL`, asc(followUpTasks.dueOn));
  return rows.map((r) => ({ ...r, overdue: !r.completedAt && r.dueOn < today }));
}

/* ───────────────────────────── manually recorded leads ───────────────────────────── */

/** Phone, WhatsApp, showroom, referral or social enquiries that staff enter themselves. */
export async function createLeadManual(actor: Actor, input: ManualLeadInput, fileIds: string[] = []): Promise<{ id: string; reference: string }> {
  requirePermission(actor, "leads:write");
  const db = getDb();
  if (input.assignedTo && input.assignedTo !== actor.id) requirePermission(actor, "leads:assign");
  if (input.assignedTo) {
    if (!(await listAssignableStaff(actor)).some((s) => s.id === input.assignedTo)) throw validation("Choose an active team member.", { assignedTo: ["Choose an active team member."] });
  }
  const customerId = input.customerId ?? null;
  if (customerId) {
    const [c] = await db.select({ id: customers.id, archivedAt: customers.archivedAt }).from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!c || c.archivedAt) throw validation("Choose an active customer.", { customerId: ["Choose an active customer."] });
  }
  const key = phoneKey(input.phone);
  const dup = customerId ? null : (await findCustomerMatches(db, input.phone, input.email))[0];
  const verified = await verifyUploads(fileIds, "lead_attachment", actor);
  return withTx(async (tx) => {
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('lead') AS ref`)) as unknown as [{ ref: string }];
    const [lead] = await tx
      .insert(leads)
      .values({
        reference: ref,
        customerId,
        kind: input.kind,
        source: input.source,
        assignedTo: input.assignedTo ?? actor.id,
        contactName: input.name,
        contactPhone: input.phone,
        contactPhoneKey: key,
        contactEmail: input.email ?? null,
        contactEmailLower: input.email ? normaliseEmail(input.email) : null,
        preferredContact: input.preferredContact ?? null,
        message: input.message ?? null,
        possibleDuplicateCustomerId: dup?.id ?? null,
        createdBy: actor.id,
      })
      .returning({ id: leads.id, reference: leads.reference });
    await linkUploads(tx, verified, { type: "lead", id: lead!.id });
    await tx.insert(leadActivities).values({ leadId: lead!.id, customerId, type: "note", body: `Enquiry recorded by staff (${input.source.replace("_", " ")}).`, createdBy: actor.id });
    await recordAudit(tx, actor, { action: "lead.created_by_staff", entityType: "lead", entityId: lead!.id, after: { reference: lead!.reference, source: input.source } });
    return { id: lead!.id, reference: lead!.reference };
  });
}

export async function attachLeadFiles(actor: Actor, leadId: string, fileIds: string[]): Promise<void> {
  requirePermission(actor, "leads:write");
  if (!can(actor, "files:view_customer_private")) throw forbidden();
  if (fileIds.length === 0) throw validation("Upload at least one file.", { fileIds: ["Upload at least one file."] });
  const verified = await verifyUploads(fileIds, "lead_attachment", actor);
  await withTx(async (tx) => {
    const [lead] = await tx.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId)).for("update");
    if (!lead) throw notFound("That enquiry could not be found.");
    await linkUploads(tx, verified, { type: "lead", id: leadId });
    await tx.insert(leadActivities).values({ leadId, type: "note", body: `${verified.length} file(s) attached.`, createdBy: actor.id });
    await recordAudit(tx, actor, { action: "lead.files_attached", entityType: "lead", entityId: leadId, after: { count: verified.length } });
  });
}
