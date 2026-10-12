import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { customers, leadActivities, leads, quotationItems, quotationRevisions, quotations, uploadedFiles } from "@/lib/db/schema";
import { invalidState, notFound, validation } from "@/lib/errors";
import { moneyString, qtyString } from "@/lib/money";
import type { QuotationDraftInput, QuotationStatus } from "@/lib/schemas/quotation";
import { getBusinessSettings } from "@/lib/settings";
import { todayLocal } from "@/lib/time";
import { recordAudit } from "./audit";
import { linkUploads, verifyUploads } from "./files";
import { escapeLike } from "./leads";
import { computeAndCheck, specification, type Computed } from "./pricing";

async function writeItems(tx: DbOrTx, revisionId: string, c: Computed) {
  if (c.lines.length === 0) return;
  await tx.insert(quotationItems).values(
    c.lines.map((l, idx) => ({
      revisionId,
      position: idx + 1,
      kind: l.item.kind,
      variantId: l.item.variantId ?? null,
      description: l.item.description,
      specification: specification(l.item),
      quantity: qtyString(l.item.quantity),
      unitPrice: moneyString(l.item.unitPrice),
      discountAmount: moneyString(l.item.discountAmount),
      lineTotal: l.lineTotal,
    })),
  );
}

export async function createQuotation(actor: Actor, input: QuotationDraftInput & { customerId: string; leadId?: string }): Promise<string> {
  requirePermission(actor, "quotations:write");
  const db = getDb();
  const [customer] = await db.select({ id: customers.id, archivedAt: customers.archivedAt }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!customer || customer.archivedAt) throw validation("Choose an active customer.", { customerId: ["Choose an active customer."] });
  if (input.leadId) {
    const [lead] = await db.select({ customerId: leads.customerId }).from(leads).where(eq(leads.id, input.leadId)).limit(1);
    if (!lead) throw notFound("That enquiry could not be found.");
    if (lead.customerId !== input.customerId) throw validation("Link the enquiry to this customer before quoting.", { customerId: ["This enquiry is linked to a different customer."] });
  }
  const computed = await computeAndCheck(db, actor, input);
  const currency = (await getBusinessSettings()).currency;

  return withTx(async (tx) => {
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('quotation') AS ref`)) as unknown as [{ ref: string }];
    const [q] = await tx
      .insert(quotations)
      .values({ reference: ref, customerId: input.customerId, leadId: input.leadId ?? null, currency, createdBy: actor.id })
      .returning({ id: quotations.id });
    const [rev] = await tx
      .insert(quotationRevisions)
      .values({
        quotationId: q!.id,
        revisionNo: 1,
        validUntil: input.validUntil,
        deliveryCharge: computed.totals.deliveryCharge,
        subtotal: computed.totals.subtotal,
        discountTotal: computed.totals.discountTotal,
        total: computed.totals.total,
        terms: input.terms ?? null,
        customerNotes: input.customerNotes ?? null,
        internalNotes: input.internalNotes ?? null,
        createdBy: actor.id,
      })
      .returning({ id: quotationRevisions.id });
    await writeItems(tx, rev!.id, computed);
    if (input.leadId) await tx.insert(leadActivities).values({ leadId: input.leadId, customerId: input.customerId, type: "note", body: `Quotation ${ref} drafted.`, createdBy: actor.id });
    await recordAudit(tx, actor, { action: "quotation.created", entityType: "quotation", entityId: q!.id, after: { reference: ref, total: computed.totals.total } });
    return q!.id;
  });
}

async function lockQuotation(tx: DbOrTx, id: string) {
  const [q] = await tx.select().from(quotations).where(eq(quotations.id, id)).for("update");
  if (!q) throw notFound("That quotation could not be found.");
  return q;
}

async function currentRevision(tx: DbOrTx, q: { id: string; currentRevisionNo: number }) {
  const [rev] = await tx.select().from(quotationRevisions).where(and(eq(quotationRevisions.quotationId, q.id), eq(quotationRevisions.revisionNo, q.currentRevisionNo)));
  if (!rev) throw notFound("That quotation could not be found.");
  return rev;
}

/** Edit the working draft. A sent revision can never be edited (database trigger); use reviseQuotation instead. */
export async function updateQuotationDraft(actor: Actor, id: string, input: QuotationDraftInput): Promise<void> {
  requirePermission(actor, "quotations:write");
  const computed = await computeAndCheck(getDb(), actor, input);
  await withTx(async (tx) => {
    const q = await lockQuotation(tx, id);
    if (q.status !== "draft") throw invalidState("Only a draft can be edited. Create a new revision to change a sent quotation.");
    const rev = await currentRevision(tx, q);
    await tx.delete(quotationItems).where(eq(quotationItems.revisionId, rev.id));
    await tx
      .update(quotationRevisions)
      .set({
        validUntil: input.validUntil,
        deliveryCharge: computed.totals.deliveryCharge,
        subtotal: computed.totals.subtotal,
        discountTotal: computed.totals.discountTotal,
        total: computed.totals.total,
        terms: input.terms ?? null,
        customerNotes: input.customerNotes ?? null,
        internalNotes: input.internalNotes ?? null,
      })
      .where(eq(quotationRevisions.id, rev.id));
    await writeItems(tx, rev.id, computed);
    await recordAudit(tx, actor, { action: "quotation.draft_updated", entityType: "quotation", entityId: id, before: { total: rev.total }, after: { total: computed.totals.total, revision: rev.revisionNo } });
  });
}

export async function sendQuotation(actor: Actor, id: string, now: Date = new Date()): Promise<void> {
  requirePermission(actor, "quotations:send");
  const today = todayLocal((await getBusinessSettings()).timezone, now);
  await withTx(async (tx) => {
    const q = await lockQuotation(tx, id);
    if (q.status !== "draft") throw invalidState("Only a draft can be marked as sent.");
    const rev = await currentRevision(tx, q);
    const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(quotationItems).where(eq(quotationItems.revisionId, rev.id));
    if (n === 0) throw validation("Add at least one item before sending.");
    if (rev.validUntil < today) throw validation("The valid-until date has already passed. Choose a later date first.", { validUntil: ["Choose a date from today onwards."] });
    await tx.update(quotationRevisions).set({ frozenAt: now, frozenBy: actor.id }).where(eq(quotationRevisions.id, rev.id));
    await tx.update(quotations).set({ status: "sent", sentAt: now, decidedAt: null }).where(eq(quotations.id, id));
    if (q.leadId) {
      const [lead] = await tx.select({ status: leads.status }).from(leads).where(eq(leads.id, q.leadId)).for("update");
      if (lead && ["new", "contacted", "requirements_confirmed"].includes(lead.status)) {
        await tx.update(leads).set({ status: "quotation_sent" }).where(eq(leads.id, q.leadId));
        await tx.insert(leadActivities).values({ leadId: q.leadId, customerId: q.customerId, type: "status_change", body: `Status changed to Quotation sent (${q.reference}).`, createdBy: actor.id });
      }
    }
    await recordAudit(tx, actor, { action: "quotation.sent", entityType: "quotation", entityId: id, after: { reference: q.reference, revision: rev.revisionNo, total: rev.total } });
  });
}

export async function decideQuotation(actor: Actor, id: string, decision: "accepted" | "rejected", now: Date = new Date()): Promise<void> {
  requirePermission(actor, "quotations:write");
  const today = todayLocal((await getBusinessSettings()).timezone, now);
  let expired = false;
  await withTx(async (tx) => {
    const q = await lockQuotation(tx, id);
    if (q.status !== "sent") throw invalidState("Only a sent quotation can be accepted or rejected.");
    const rev = await currentRevision(tx, q);
    if (decision === "accepted" && rev.validUntil < today) {
      await tx.update(quotations).set({ status: "expired" }).where(eq(quotations.id, id));
      await recordAudit(tx, null, { action: "quotation.expired", entityType: "quotation", entityId: id });
      expired = true;
      return;
    }
    await tx.update(quotations).set({ status: decision, decidedAt: now }).where(eq(quotations.id, id));
    if (decision === "accepted" && q.leadId) {
      const [lead] = await tx.select({ status: leads.status }).from(leads).where(eq(leads.id, q.leadId)).for("update");
      if (lead && lead.status !== "won" && lead.status !== "lost") {
        await tx.update(leads).set({ status: "won", closedAt: now, lostReason: null }).where(eq(leads.id, q.leadId));
        await tx.insert(leadActivities).values({ leadId: q.leadId, customerId: q.customerId, type: "status_change", body: `Quotation ${q.reference} accepted — enquiry marked Won.`, createdBy: actor.id });
      }
    }
    await recordAudit(tx, actor, { action: `quotation.${decision}`, entityType: "quotation", entityId: id, after: { reference: q.reference, total: rev.total } });
  });
  if (expired) throw invalidState("This quotation has passed its valid-until date and has been marked expired. Create a new revision to extend it.");
}

/** New working draft copied from the latest revision. Accepted/converted quotations are final and cannot be revised. */
export async function reviseQuotation(actor: Actor, id: string): Promise<number> {
  requirePermission(actor, "quotations:write");
  return withTx(async (tx) => {
    const q = await lockQuotation(tx, id);
    if (!["sent", "rejected", "expired"].includes(q.status)) {
      throw invalidState(q.status === "draft" ? "This quotation is already a draft; edit it directly." : "An accepted quotation cannot be changed. Start a new quotation instead.");
    }
    const prev = await currentRevision(tx, q);
    const items = await tx.select().from(quotationItems).where(eq(quotationItems.revisionId, prev.id)).orderBy(asc(quotationItems.position));
    const no = q.currentRevisionNo + 1;
    const [rev] = await tx
      .insert(quotationRevisions)
      .values({
        quotationId: id,
        revisionNo: no,
        validUntil: prev.validUntil,
        deliveryCharge: prev.deliveryCharge,
        subtotal: prev.subtotal,
        discountTotal: prev.discountTotal,
        total: prev.total,
        terms: prev.terms,
        customerNotes: prev.customerNotes,
        internalNotes: prev.internalNotes,
        createdBy: actor.id,
      })
      .returning({ id: quotationRevisions.id });
    if (items.length) {
      await tx.insert(quotationItems).values(
        items.map((i) => ({ revisionId: rev!.id, position: i.position, kind: i.kind, variantId: i.variantId, description: i.description, specification: i.specification, quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, lineTotal: i.lineTotal })),
      );
    }
    await tx.update(quotations).set({ status: "draft", currentRevisionNo: no, sentAt: null, decidedAt: null }).where(eq(quotations.id, id));
    await recordAudit(tx, actor, { action: "quotation.revised", entityType: "quotation", entityId: id, before: { revision: prev.revisionNo, status: q.status }, after: { revision: no } });
    return no;
  });
}

/** Mark sent quotations whose valid-until date has passed as expired. Run by the daily cron. */
export async function expireStaleQuotations(db: DbOrTx, today: string): Promise<number> {
  const rows = await db.execute<{ id: string }>(sql`
    UPDATE quotations q SET status = 'expired'
    FROM quotation_revisions r
    WHERE q.status = 'sent' AND r.quotation_id = q.id AND r.revision_no = q.current_revision_no AND r.valid_until < ${today}
    RETURNING q.id`);
  const n = (rows as unknown as Array<{ id: string }>).length;
  if (n > 0) await recordAudit(db, null, { action: "quotation.expired_batch", entityType: "quotation", after: { count: n } });
  return n;
}

export interface QuotationFilters {
  status?: QuotationStatus;
  q?: string;
  customerId?: string;
  page: number;
  pageSize: number;
}

export async function listQuotations(actor: Actor, f: QuotationFilters, now: Date = new Date()) {
  requirePermission(actor, "quotations:view");
  const today = todayLocal((await getBusinessSettings()).timezone, now);
  const where: SQL[] = [];
  if (f.status) where.push(eq(quotations.status, f.status));
  if (f.customerId) where.push(eq(quotations.customerId, f.customerId));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(quotations.reference, like), ilike(customers.name, like), ilike(customers.company, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const base = db
    .select({
      id: quotations.id,
      reference: quotations.reference,
      status: quotations.status,
      currency: quotations.currency,
      customerId: customers.id,
      customerName: customers.name,
      revisionNo: quotations.currentRevisionNo,
      total: quotationRevisions.total,
      validUntil: quotationRevisions.validUntil,
      createdAt: quotations.createdAt,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .innerJoin(quotationRevisions, and(eq(quotationRevisions.quotationId, quotations.id), eq(quotationRevisions.revisionNo, quotations.currentRevisionNo)))
    .where(cond);
  const [rows, countRows] = await Promise.all([
    base.orderBy(desc(quotations.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(quotations).innerJoin(customers, eq(customers.id, quotations.customerId)).where(cond),
  ]);
  const n = countRows[0]?.n ?? 0;
  return { rows: rows.map((r) => ({ ...r, pastValidity: r.status === "sent" && r.validUntil < today })), total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)), today };
}

export async function getQuotation(actor: Actor, id: string, revisionNo?: number, now: Date = new Date()) {
  requirePermission(actor, "quotations:view");
  const today = todayLocal((await getBusinessSettings()).timezone, now);
  const db = getDb();
  const [row] = await db
    .select({ q: quotations, customerName: customers.name, customerCompany: customers.company, customerPhone: customers.phone, customerEmail: customers.email, customerAddress: customers.address, leadReference: leads.reference })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .leftJoin(leads, eq(leads.id, quotations.leadId))
    .where(eq(quotations.id, id))
    .limit(1);
  if (!row) throw notFound("That quotation could not be found.");
  const revisions = await db.select().from(quotationRevisions).where(eq(quotationRevisions.quotationId, id)).orderBy(desc(quotationRevisions.revisionNo));
  const shown = revisions.find((r) => r.revisionNo === (revisionNo ?? row.q.currentRevisionNo));
  if (!shown) throw notFound("That revision could not be found.");
  const items = await db.select().from(quotationItems).where(eq(quotationItems.revisionId, shown.id)).orderBy(asc(quotationItems.position));
  const files = can(actor, "files:view_customer_private")
    ? await db
        .select({ id: uploadedFiles.id, name: uploadedFiles.originalName, size: uploadedFiles.sizeBytes })
        .from(uploadedFiles)
        .where(and(eq(uploadedFiles.entityType, "quotation"), eq(uploadedFiles.entityId, id), eq(uploadedFiles.status, "linked")))
    : [];
  const current = revisions.find((r) => r.revisionNo === row.q.currentRevisionNo)!;
  return {
    quotation: row.q,
    customer: { id: row.q.customerId, name: row.customerName, company: row.customerCompany, phone: row.customerPhone, email: row.customerEmail, address: row.customerAddress },
    leadReference: row.leadReference,
    revisions: revisions.map((r) => ({ revisionNo: r.revisionNo, validUntil: r.validUntil, total: r.total, frozenAt: r.frozenAt, createdAt: r.createdAt })),
    revision: shown,
    isCurrent: shown.revisionNo === row.q.currentRevisionNo,
    items,
    files,
    pastValidity: row.q.status === "sent" && current.validUntil < today,
  };
}

export async function attachQuotationFiles(actor: Actor, quotationId: string, fileIds: string[]): Promise<void> {
  requirePermission(actor, "quotations:write");
  if (fileIds.length === 0) throw validation("Upload at least one file.", { fileIds: ["Upload at least one file."] });
  const verified = await verifyUploads(fileIds, "quotation_attachment", actor);
  await withTx(async (tx) => {
    const [q] = await tx.select({ id: quotations.id }).from(quotations).where(eq(quotations.id, quotationId)).for("update");
    if (!q) throw notFound("That quotation could not be found.");
    await linkUploads(tx, verified, { type: "quotation", id: quotationId });
    await recordAudit(tx, actor, { action: "quotation.files_attached", entityType: "quotation", entityId: quotationId, after: { count: verified.length } });
  });
}
