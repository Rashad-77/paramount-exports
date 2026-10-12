import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx } from "@/lib/db/client";
import { customers, leadActivities, leads, products, profiles, uploadedFiles, userRoles } from "@/lib/db/schema";
import { notFound, validation } from "@/lib/errors";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadSource, type LeadStatus } from "@/lib/crm";
import { recordAudit } from "./audit";

export interface PageParams {
  page: number;
  pageSize: number;
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface LeadFilters extends PageParams {
  status?: LeadStatus | "open";
  source?: LeadSource;
  assignedTo?: string | "unassigned" | "me";
  q?: string;
  sort?: "newest" | "oldest" | "followup";
}

export async function listLeads(actor: Actor, f: LeadFilters) {
  requirePermission(actor, "leads:view");
  const where: SQL[] = [];
  if (f.status === "open") where.push(inArray(leads.status, ["new", "contacted", "requirements_confirmed", "quotation_sent", "negotiation"]));
  else if (f.status) where.push(eq(leads.status, f.status));
  if (f.source) where.push(eq(leads.source, f.source));
  if (f.assignedTo === "unassigned") where.push(sql`${leads.assignedTo} IS NULL`);
  else if (f.assignedTo === "me") where.push(eq(leads.assignedTo, actor.id));
  else if (f.assignedTo) where.push(eq(leads.assignedTo, f.assignedTo));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(leads.contactName, like), ilike(leads.contactPhone, like), ilike(leads.contactEmail, like), ilike(leads.reference, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const order = f.sort === "oldest" ? asc(leads.createdAt) : f.sort === "followup" ? sql`${leads.nextFollowUpOn} ASC NULLS LAST` : desc(leads.createdAt);

  const db = getDb();
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        reference: leads.reference,
        kind: leads.kind,
        source: leads.source,
        status: leads.status,
        contactName: leads.contactName,
        contactPhone: leads.contactPhone,
        assignedTo: leads.assignedTo,
        assigneeName: profiles.fullName,
        nextFollowUpOn: leads.nextFollowUpOn,
        createdAt: leads.createdAt,
        hasDuplicate: sql<boolean>`${leads.possibleDuplicateCustomerId} IS NOT NULL AND ${leads.customerId} IS NULL`,
      })
      .from(leads)
      .leftJoin(profiles, eq(profiles.id, leads.assignedTo))
      .where(cond)
      .orderBy(order, desc(leads.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(leads).where(cond),
  ]);
  const n = countRows[0]?.n ?? 0;
  return { rows, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function getLead(actor: Actor, id: string) {
  requirePermission(actor, "leads:view");
  const db = getDb();
  const [lead] = await db
    .select({ lead: leads, assigneeName: profiles.fullName, productName: products.name, productSlug: products.slug })
    .from(leads)
    .leftJoin(profiles, eq(profiles.id, leads.assignedTo))
    .leftJoin(products, eq(products.id, leads.productId))
    .where(eq(leads.id, id))
    .limit(1);
  if (!lead) throw notFound("That enquiry could not be found.");

  const files = can(actor, "files:view_customer_private")
    ? await db
        .select({ id: uploadedFiles.id, name: uploadedFiles.originalName, size: uploadedFiles.sizeBytes, contentType: uploadedFiles.contentType })
        .from(uploadedFiles)
        .where(and(eq(uploadedFiles.entityType, "lead"), eq(uploadedFiles.entityId, id), eq(uploadedFiles.status, "linked")))
    : [];
  const [dup] = lead.lead.possibleDuplicateCustomerId
    ? await db.select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email }).from(customers).where(eq(customers.id, lead.lead.possibleDuplicateCustomerId)).limit(1)
    : [];
  return { ...lead, files, possibleDuplicate: dup ?? null };
}

/** Active staff who can work leads — the people a lead may be assigned to. */
export async function listAssignableStaff(actor: Actor): Promise<Array<{ id: string; name: string }>> {
  requirePermission(actor, "leads:view");
  const rows = await getDb()
    .selectDistinct({ id: profiles.id, name: profiles.fullName })
    .from(profiles)
    .innerJoin(userRoles, eq(userRoles.userId, profiles.id))
    .where(and(eq(profiles.isActive, true), inArray(userRoles.role, ["owner", "manager", "sales"])))
    .orderBy(asc(profiles.fullName));
  return rows;
}

export async function assignLead(actor: Actor, leadId: string, assigneeId: string | null): Promise<void> {
  requirePermission(actor, "leads:assign");
  if (assigneeId) {
    const ok = (await listAssignableStaff(actor)).some((s) => s.id === assigneeId);
    if (!ok) throw validation("Choose an active team member who works on enquiries.");
  }
  await withTx(async (tx) => {
    const [before] = await tx.select({ assignedTo: leads.assignedTo }).from(leads).where(eq(leads.id, leadId)).for("update");
    if (!before) throw notFound("That enquiry could not be found.");
    await tx.update(leads).set({ assignedTo: assigneeId }).where(eq(leads.id, leadId));
    await recordAudit(tx, actor, { action: "lead.assigned", entityType: "lead", entityId: leadId, before: { assignedTo: before.assignedTo }, after: { assignedTo: assigneeId } });
  });
}

export async function changeLeadStatus(actor: Actor, leadId: string, status: LeadStatus, lostReason?: string): Promise<void> {
  requirePermission(actor, "leads:write");
  if (!LEAD_STATUSES.includes(status)) throw validation("Choose a valid status.");
  if (status === "lost" && !lostReason?.trim()) throw validation("Say why the enquiry was lost.", { lostReason: ["Add a short reason (e.g. chose another supplier, budget)."] });
  await withTx(async (tx) => {
    const [before] = await tx.select({ status: leads.status, lostReason: leads.lostReason }).from(leads).where(eq(leads.id, leadId)).for("update");
    if (!before) throw notFound("That enquiry could not be found.");
    const closing = status === "won" || status === "lost";
    await tx
      .update(leads)
      .set({ status, lostReason: status === "lost" ? lostReason!.trim() : null, closedAt: closing ? new Date() : null })
      .where(eq(leads.id, leadId));
    if (before.status !== status) {
      await tx.insert(leadActivities).values({
        leadId,
        type: "status_change",
        body: `Status changed from ${LEAD_STATUS_LABEL[before.status]} to ${LEAD_STATUS_LABEL[status]}${status === "lost" ? ` — ${lostReason!.trim()}` : ""}.`,
        createdBy: actor.id,
      });
    }
    await recordAudit(tx, actor, { action: "lead.status_changed", entityType: "lead", entityId: leadId, before, after: { status, lostReason: status === "lost" ? lostReason!.trim() : null } });
  });
}
