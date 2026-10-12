import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { can, requirePermission, scopeOf, type Actor, type Permission } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import {
  customers,
  inventoryItems,
  jobMaterials,
  labourEntries,
  locations,
  materialConsumption,
  productionIssues,
  productionJobAssignees,
  productionJobFiles,
  productionJobs,
  productionStageHistory,
  profiles,
  quotations,
  salesOrderItems,
  salesOrders,
  uploadedFiles,
  userRoles,
} from "@/lib/db/schema";
import { forbidden, invalidState, notFound, validation } from "@/lib/errors";
import { FLOW, flowIndex, type JobStage } from "@/lib/production";
import { dec, moneyString, qtyString, roundMoney } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { todayLocal } from "@/lib/time";
import { recordAudit } from "./audit";
import { applyMovements } from "./inventory";
import { escapeLike } from "./leads";
import { getProductionSettings } from "./settings";
import { linkUploads, verifyUploads } from "./files";

type Order = typeof salesOrders.$inferSelect;

/** Qualified outer reference for correlated subqueries (an unqualified "id" would bind to the inner table). */
const JOB_ID = sql.raw('"production_jobs"."id"');

/* ───────────────────────────── access ───────────────────────────── */

/** Workshop staff hold some permissions with scope "own": they only reach jobs they are assigned to. */
async function assertJobAccess(db: DbOrTx, actor: Actor, jobId: string, permission: Permission): Promise<void> {
  const scope = requirePermission(actor, permission);
  if (scope === "all") return;
  const [row] = await db.select({ u: productionJobAssignees.userId }).from(productionJobAssignees).where(and(eq(productionJobAssignees.jobId, jobId), eq(productionJobAssignees.userId, actor.id))).limit(1);
  if (!row) throw forbidden("That job is not assigned to you.");
}

/* ───────────────────────────── creation (called when a custom order is confirmed) ───────────────────────────── */

/**
 * Create the production job for a freshly confirmed custom order, in the order's transaction.
 * Copies the specification and the reference files that came with the enquiry/quotation.
 */
export async function createJobForOrder(tx: DbOrTx, actor: Actor, order: Order): Promise<string> {
  const lines = await tx.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, order.id)).orderBy(asc(salesOrderItems.position));
  const description = lines.length === 1 ? lines[0]!.description : `${lines[0]!.description} and ${lines.length - 1} more`;
  const spec = lines.map((l) => ({ description: l.description, quantity: l.quantity, specification: l.specification }));
  const settings = await getProductionSettings(tx);
  const [{ ref }] = (await tx.execute(sql`SELECT next_reference('job') AS ref`)) as unknown as [{ ref: string }];

  let outputItemId: string | null = null;
  let outputLocationId: string | null = null;
  let outputQuantity = "1.000";
  if (settings.createsFinishedStock) {
    const [loc] = await tx.select({ id: locations.id }).from(locations).where(and(eq(locations.kind, "workshop"), eq(locations.isActive, true), isNull(locations.archivedAt))).orderBy(asc(locations.createdAt)).limit(1);
    if (loc) {
      const [item] = await tx.insert(inventoryItems).values({ kind: "finished_good", sku: ref, name: `Custom piece ${ref}: ${description}`.slice(0, 120), unit: "pcs", createdBy: actor.id }).returning({ id: inventoryItems.id });
      outputItemId = item!.id;
      outputLocationId = loc.id;
      outputQuantity = qtyString(lines.reduce((s, l) => s.plus(l.quantity), dec(0)));
    }
  }

  const [job] = await tx
    .insert(productionJobs)
    .values({ reference: ref, orderId: order.id, customerId: order.customerId, description, specification: spec, targetDate: order.requestedCompletionDate, outputItemId, outputLocationId, outputQuantity, createdBy: actor.id })
    .returning({ id: productionJobs.id });
  await tx.insert(productionStageHistory).values({ jobId: job!.id, fromStage: null, toStage: "awaiting_materials", note: `Job created from order ${order.reference}.`, changedBy: actor.id });

  // Reference images/drawings: files attached to the accepted quotation and to the enquiry it came from.
  if (order.quotationId) {
    const [q] = await tx.select({ leadId: quotations.leadId }).from(quotations).where(eq(quotations.id, order.quotationId)).limit(1);
    const conds: SQL[] = [and(eq(uploadedFiles.entityType, "quotation"), eq(uploadedFiles.entityId, order.quotationId))!];
    if (q?.leadId) conds.push(and(eq(uploadedFiles.entityType, "lead"), eq(uploadedFiles.entityId, q.leadId))!);
    const files = await tx.select({ id: uploadedFiles.id }).from(uploadedFiles).where(and(eq(uploadedFiles.status, "linked"), or(...conds)));
    if (files.length) await tx.insert(productionJobFiles).values(files.map((f) => ({ jobId: job!.id, fileId: f.id }))).onConflictDoNothing();
  }
  await recordAudit(tx, actor, { action: "job.created", entityType: "production_job", entityId: job!.id, after: { reference: ref, order: order.reference } });
  return job!.id;
}

/** The order was cancelled: stop the job. Materials already used stay recorded. */
export async function cancelJobForOrder(tx: DbOrTx, actor: Actor, orderId: string, reason: string): Promise<void> {
  const [job] = await tx.select().from(productionJobs).where(eq(productionJobs.orderId, orderId)).for("update");
  if (!job || job.stage === "cancelled") return;
  await tx.update(productionJobs).set({ stage: "cancelled" }).where(eq(productionJobs.id, job.id));
  await tx.insert(productionStageHistory).values({ jobId: job.id, fromStage: job.stage, toStage: "cancelled", note: `Order cancelled: ${reason}`, changedBy: actor.id });
}

/**
 * Delivery of a custom order: if the finished piece was added to stock when production completed, take it out now.
 * Exactly once (the output_sold_at flag is one-way and enforced by a trigger).
 */
export async function releaseJobOutputOnDelivery(tx: DbOrTx, actor: Actor, orderId: string): Promise<void> {
  const [job] = await tx.select().from(productionJobs).where(eq(productionJobs.orderId, orderId)).for("update");
  if (!job || !job.outputItemId || !job.outputLocationId || !job.outputRecordedAt || job.outputSoldAt) return;
  await applyMovements(tx, actor.id, [{ itemId: job.outputItemId, locationId: job.outputLocationId, type: "sale", onHandDelta: dec(job.outputQuantity).negated().toString(), refType: "production_job", refId: job.id, reason: "Custom order delivered" }]);
  await tx.update(productionJobs).set({ outputSoldAt: new Date() }).where(eq(productionJobs.id, job.id));
}

/* ───────────────────────────── stage changes ───────────────────────────── */

export async function changeStage(actor: Actor, jobId: string, to: JobStage, note?: string): Promise<void> {
  const why = note?.trim() || null;
  await withTx(async (tx) => {
    await assertJobAccess(tx, actor, jobId, "production:update_stage");
    const [job] = await tx.select().from(productionJobs).where(eq(productionJobs.id, jobId)).for("update");
    if (!job) throw notFound("That job could not be found.");
    if (job.stage === "cancelled") throw invalidState("This job was cancelled with its order.");
    if (to === "cancelled") throw invalidState("A job is cancelled by cancelling its order.");
    if (to === job.stage) throw invalidState("The job is already at that stage.");
    const manager = can(actor, "production:write");

    let note2 = why;
    if (to === "on_hold") {
      if (!why) throw validation("Say why the job is being put on hold.", { note: ["Add a short reason."] });
    } else if (job.stage === "on_hold") {
      const resumeTo = job.stageBeforeHold;
      if (to !== resumeTo && !why) throw validation("Add a note when resuming at a different stage.", { note: ["Say why it resumes here."] });
    } else {
      const backward = flowIndex(to) < flowIndex(job.stage);
      if (backward && !why) throw validation("Add a note explaining why the job is going back (rework).", { note: ["Say what needs redoing."] });
      if (backward && job.stage === "ready_for_delivery" && !manager) throw forbidden("Only a manager can reopen a job that is ready for delivery.");
      if (to === "ready_for_delivery" && job.stage !== "quality_check" && !manager) throw invalidState("A job must pass its quality check before it is ready for delivery.");
    }

    const patch: Partial<typeof productionJobs.$inferInsert> = { stage: to };
    if (to === "on_hold") patch.stageBeforeHold = job.stage;
    if (job.stage === "on_hold") patch.stageBeforeHold = null;
    if (to === "ready_for_delivery") patch.completedAt = job.completedAt ?? new Date();
    else if (job.stage === "ready_for_delivery") patch.completedAt = null;

    // Optional finished-goods workflow: add the finished piece to stock the FIRST time the job completes only.
    if (to === "ready_for_delivery" && job.outputItemId && job.outputLocationId && !job.outputRecordedAt) {
      await applyMovements(tx, actor.id, [{ itemId: job.outputItemId, locationId: job.outputLocationId, type: "production_output", onHandDelta: job.outputQuantity, refType: "production_job", refId: job.id, reason: `Job ${job.reference} completed` }]);
      patch.outputRecordedAt = new Date();
      note2 = note2 ?? "Finished piece added to stock.";
    }
    await tx.update(productionJobs).set(patch).where(eq(productionJobs.id, jobId));
    await tx.insert(productionStageHistory).values({ jobId, fromStage: job.stage, toStage: to, note: note2, changedBy: actor.id });
    if (to === "ready_for_delivery") await recordAudit(tx, actor, { action: "job.completed", entityType: "production_job", entityId: jobId, after: { reference: job.reference, stockRecorded: Boolean(patch.outputRecordedAt) } });
  });
}

/* ───────────────────────────── details, assignment, issues ───────────────────────────── */

export async function updateJobDetails(actor: Actor, jobId: string, input: { description: string; priority: "low" | "normal" | "high" | "urgent"; targetDate?: string }): Promise<void> {
  requirePermission(actor, "production:write");
  await withTx(async (tx) => {
    const [job] = await tx.select().from(productionJobs).where(eq(productionJobs.id, jobId)).for("update");
    if (!job) throw notFound("That job could not be found.");
    await tx.update(productionJobs).set({ description: input.description, priority: input.priority, targetDate: input.targetDate ?? null }).where(eq(productionJobs.id, jobId));
    await recordAudit(tx, actor, { action: "job.updated", entityType: "production_job", entityId: jobId, before: { priority: job.priority, targetDate: job.targetDate }, after: { priority: input.priority, targetDate: input.targetDate ?? null } });
  });
}

export async function listWorkers(actor: Actor): Promise<Array<{ id: string; name: string }>> {
  requirePermission(actor, "production:view");
  return getDb()
    .selectDistinct({ id: profiles.id, name: profiles.fullName })
    .from(profiles)
    .innerJoin(userRoles, eq(userRoles.userId, profiles.id))
    .where(and(eq(profiles.isActive, true), inArray(userRoles.role, ["workshop", "manager", "owner"])))
    .orderBy(asc(profiles.fullName));
}

export async function setAssignees(actor: Actor, jobId: string, userIds: string[]): Promise<void> {
  requirePermission(actor, "production:write");
  const ids = [...new Set(userIds)];
  const workers = new Set((await listWorkers(actor)).map((w) => w.id));
  if (ids.some((i) => !workers.has(i))) throw validation("Choose active workshop staff.", { assigneeIds: ["Choose active workshop staff."] });
  await withTx(async (tx) => {
    const [job] = await tx.select({ id: productionJobs.id }).from(productionJobs).where(eq(productionJobs.id, jobId)).for("update");
    if (!job) throw notFound("That job could not be found.");
    const before = await tx.select({ u: productionJobAssignees.userId }).from(productionJobAssignees).where(eq(productionJobAssignees.jobId, jobId));
    await tx.delete(productionJobAssignees).where(eq(productionJobAssignees.jobId, jobId));
    if (ids.length) await tx.insert(productionJobAssignees).values(ids.map((userId) => ({ jobId, userId })));
    await recordAudit(tx, actor, { action: "job.assigned", entityType: "production_job", entityId: jobId, before: { users: before.map((b) => b.u) }, after: { users: ids } });
  });
}

export async function addIssue(actor: Actor, jobId: string, type: "delay" | "rework" | "issue", note: string): Promise<void> {
  const text = note.trim();
  if (!text) throw validation("Describe the issue.", { note: ["Add a short description."] });
  await withTx(async (tx) => {
    await assertJobAccess(tx, actor, jobId, "production:update_stage");
    const [job] = await tx.select({ id: productionJobs.id }).from(productionJobs).where(eq(productionJobs.id, jobId));
    if (!job) throw notFound("That job could not be found.");
    await tx.insert(productionIssues).values({ jobId, type, note: text, createdBy: actor.id });
  });
}

export async function resolveIssue(actor: Actor, issueId: string): Promise<void> {
  await withTx(async (tx) => {
    const [i] = await tx.select().from(productionIssues).where(eq(productionIssues.id, issueId)).for("update");
    if (!i) throw notFound("That issue could not be found.");
    await assertJobAccess(tx, actor, i.jobId, "production:update_stage");
    if (!i.resolvedAt) await tx.update(productionIssues).set({ resolvedAt: new Date() }).where(eq(productionIssues.id, issueId));
  });
}

export async function attachJobFiles(actor: Actor, jobId: string, fileIds: string[]): Promise<void> {
  requirePermission(actor, "production:write");
  if (fileIds.length === 0) throw validation("Upload at least one file.", { fileIds: ["Upload at least one file."] });
  const verified = await verifyUploads(fileIds, "job_reference", actor);
  await withTx(async (tx) => {
    const [job] = await tx.select({ id: productionJobs.id }).from(productionJobs).where(eq(productionJobs.id, jobId)).for("update");
    if (!job) throw notFound("That job could not be found.");
    await linkUploads(tx, verified, { type: "production_job", id: jobId });
    await tx.insert(productionJobFiles).values(verified.map((f) => ({ jobId, fileId: f.id }))).onConflictDoNothing();
    await recordAudit(tx, actor, { action: "job.files_attached", entityType: "production_job", entityId: jobId, after: { count: verified.length } });
  });
}

/* ───────────────────────────── materials ───────────────────────────── */

async function materialItem(db: DbOrTx, actor: Actor, itemId: string) {
  const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);
  if (!item) throw notFound("That material could not be found.");
  if (item.kind === "finished_good") throw validation("Choose a raw material or consumable.", { itemId: ["Choose a raw material or consumable."] });
  if (!can(actor, "inventory:view_materials")) throw forbidden();
  return item;
}

export async function planMaterial(actor: Actor, jobId: string, input: { itemId: string; plannedQuantity: string; estimatedUnitCost?: string; note?: string }): Promise<void> {
  requirePermission(actor, "production:write");
  if (!dec(input.plannedQuantity).gt(0)) throw validation("Enter a quantity greater than zero.", { plannedQuantity: ["Enter a quantity greater than zero."] });
  await withTx(async (tx) => {
    const item = await materialItem(tx, actor, input.itemId);
    const [job] = await tx.select({ id: productionJobs.id }).from(productionJobs).where(eq(productionJobs.id, jobId)).for("update");
    if (!job) throw notFound("That job could not be found.");
    const unit = input.estimatedUnitCost ?? item.costPrice ?? null;
    await tx
      .insert(jobMaterials)
      .values({ jobId, itemId: input.itemId, plannedQuantity: qtyString(input.plannedQuantity), estimatedUnitCost: unit, note: input.note ?? null })
      .onConflictDoUpdate({ target: [jobMaterials.jobId, jobMaterials.itemId], set: { plannedQuantity: qtyString(input.plannedQuantity), estimatedUnitCost: unit, note: input.note ?? null } });
  });
}

export async function removeMaterialPlan(actor: Actor, planId: string): Promise<void> {
  requirePermission(actor, "production:write");
  await getDb().delete(jobMaterials).where(eq(jobMaterials.id, planId));
}

/**
 * Record what was ACTUALLY used (and wasted) on a job. This — and only this — takes raw materials out of stock for the job.
 * The movements and the record are created together in one transaction, exactly once: a repeated `requestKey` (a double-clicked
 * button, a retry after a slow connection) returns the original record without deducting again.
 */
export async function recordConsumption(
  actor: Actor,
  input: { jobId: string; itemId: string; locationId: string; quantity: string; wasteQuantity?: string; note?: string; requestKey?: string },
): Promise<{ id: string; duplicate: boolean }> {
  const used = dec(input.quantity || "0");
  const waste = dec(input.wasteQuantity || "0");
  if (used.isNegative() || waste.isNegative() || used.plus(waste).lte(0)) throw validation("Enter how much was used (and wasted, if any).", { quantity: ["Enter a quantity greater than zero."] });

  if (input.requestKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestKey)) throw validation("That submission key is not valid. Reload the page and try again.");

  const run = () =>
    withTx(async (tx) => {
      await assertJobAccess(tx, actor, input.jobId, "production:record_materials");
      if (input.requestKey) {
        const [existing] = await tx.select({ id: materialConsumption.id }).from(materialConsumption).where(eq(materialConsumption.requestKey, input.requestKey));
        if (existing) return { id: existing.id, duplicate: true };
      }
      const [job] = await tx.select().from(productionJobs).where(eq(productionJobs.id, input.jobId)).for("update");
      if (!job) throw notFound("That job could not be found.");
      if (job.stage === "cancelled") throw invalidState("This job was cancelled; materials cannot be recorded against it.");
      const item = await materialItem(tx, actor, input.itemId);
      const [loc] = await tx.select({ id: locations.id, archivedAt: locations.archivedAt }).from(locations).where(eq(locations.id, input.locationId)).limit(1);
      if (!loc || loc.archivedAt) throw validation("Choose an active location.", { locationId: ["Choose an active location."] });

      const movements = [];
      if (used.gt(0)) movements.push({ itemId: item.id, locationId: loc.id, type: "production_consume" as const, onHandDelta: used.negated().toString(), refType: "production_job", refId: job.id, reason: `Used on ${job.reference}` });
      if (waste.gt(0)) movements.push({ itemId: item.id, locationId: loc.id, type: "waste" as const, onHandDelta: waste.negated().toString(), refType: "production_job", refId: job.id, reason: `Wasted on ${job.reference}` });
      const ids = await applyMovements(tx, actor.id, movements);
      let k = 0;
      const consumeId = used.gt(0) ? ids[k++]! : null;
      const wasteId = waste.gt(0) ? ids[k++]! : null;
      const [rec] = await tx
        .insert(materialConsumption)
        .values({ jobId: job.id, itemId: item.id, locationId: loc.id, quantity: qtyString(used), wasteQuantity: qtyString(waste), unitCost: item.costPrice, consumeMovementId: consumeId, wasteMovementId: wasteId, requestKey: input.requestKey ?? null, note: input.note ?? null, recordedBy: actor.id })
        .returning({ id: materialConsumption.id });
      return { id: rec!.id, duplicate: false };
    });
  try {
    return await run();
  } catch (e) {
    // Two identical submissions raced: the loser's transaction (including its stock movements) rolled back; return the winner.
    if (input.requestKey && isUniqueViolation(e)) {
      const [existing] = await getDb().select({ id: materialConsumption.id }).from(materialConsumption).where(eq(materialConsumption.requestKey, input.requestKey));
      if (existing) return { id: existing.id, duplicate: true };
    }
    throw e;
  }
}

export async function recordLabour(actor: Actor, jobId: string, input: { description: string; hours?: string; hourlyRate?: string; amount?: string }): Promise<void> {
  requirePermission(actor, "production:write");
  const settings = await getProductionSettings(getDb());
  if (!settings.trackLabour) throw invalidState("Labour tracking is switched off in Settings.");
  let amount: string;
  if (input.hours && input.hourlyRate) amount = moneyString(dec(input.hours).times(input.hourlyRate));
  else if (input.amount) amount = moneyString(input.amount);
  else throw validation("Enter the amount, or both hours and an hourly rate.", { amount: ["Enter an amount, or hours and a rate."] });
  await withTx(async (tx) => {
    const [job] = await tx.select({ id: productionJobs.id }).from(productionJobs).where(eq(productionJobs.id, jobId));
    if (!job) throw notFound("That job could not be found.");
    await tx.insert(labourEntries).values({ jobId, description: input.description, hours: input.hours ? dec(input.hours).toFixed(2) : null, hourlyRate: input.hourlyRate ?? null, amount, createdBy: actor.id });
  });
}

/* ───────────────────────────── reading ───────────────────────────── */

export interface JobFilters {
  stage?: JobStage;
  assignee?: "me" | string;
  overdueOnly?: boolean;
  q?: string;
  page: number;
  pageSize: number;
}

const ACTIVE_STAGES: JobStage[] = ["awaiting_materials", "ready_to_start", "cutting_preparation", "assembly", "sanding_finishing", "quality_check", "on_hold"];

function scopeFilter(actor: Actor): SQL | undefined {
  return scopeOf(actor, "production:view") === "own" ? sql`EXISTS (SELECT 1 FROM production_job_assignees a WHERE a.job_id = ${JOB_ID} AND a.user_id = ${actor.id})` : undefined;
}

export async function listJobs(actor: Actor, f: JobFilters, now: Date = new Date()) {
  requirePermission(actor, "production:view");
  const today = todayLocal((await getBusinessSettings()).timezone, now);
  const where: SQL[] = [];
  const sc = scopeFilter(actor);
  if (sc) where.push(sc);
  if (f.stage) where.push(eq(productionJobs.stage, f.stage));
  if (f.assignee === "me") where.push(sql`EXISTS (SELECT 1 FROM production_job_assignees a WHERE a.job_id = ${JOB_ID} AND a.user_id = ${actor.id})`);
  else if (f.assignee) where.push(sql`EXISTS (SELECT 1 FROM production_job_assignees a WHERE a.job_id = ${JOB_ID} AND a.user_id = ${f.assignee})`);
  if (f.overdueOnly) where.push(and(sql`${productionJobs.targetDate} < ${today}`, notInArray(productionJobs.stage, ["ready_for_delivery", "cancelled"]))!);
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(productionJobs.reference, like), ilike(productionJobs.description, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: productionJobs.id,
        reference: productionJobs.reference,
        description: productionJobs.description,
        stage: productionJobs.stage,
        priority: productionJobs.priority,
        targetDate: productionJobs.targetDate,
        assignees: sql<string | null>`(SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) FROM production_job_assignees a JOIN profiles p ON p.id = a.user_id WHERE a.job_id = ${JOB_ID})`,
        openIssues: sql<number>`(SELECT count(*)::int FROM production_issues i WHERE i.job_id = ${JOB_ID} AND i.resolved_at IS NULL)`,
      })
      .from(productionJobs)
      .where(cond)
      .orderBy(sql`CASE ${productionJobs.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`, sql`${productionJobs.targetDate} ASC NULLS LAST`, asc(productionJobs.reference))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(productionJobs).where(cond),
  ]);
  const n = countRows[0]?.n ?? 0;
  return { rows: rows.map((r) => ({ ...r, overdue: Boolean(r.targetDate && r.targetDate < today && r.stage !== "ready_for_delivery" && r.stage !== "cancelled") })), today, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

/** All active jobs for the board (columns by stage). Recently completed jobs stay in "Ready for delivery". */
export async function listBoard(actor: Actor, now: Date = new Date()) {
  requirePermission(actor, "production:view");
  const recent = new Date(now.getTime() - 14 * 86400_000);
  const sc = scopeFilter(actor);
  const cond = and(or(inArray(productionJobs.stage, ACTIVE_STAGES), and(eq(productionJobs.stage, "ready_for_delivery"), sql`${productionJobs.completedAt} >= ${recent.toISOString()}::timestamptz`)), sc);
  const r = await listJobsWhere(actor, cond, now);
  return r;
}

async function listJobsWhere(actor: Actor, cond: SQL | undefined, now: Date) {
  const today = todayLocal((await getBusinessSettings()).timezone, now);
  const rows = await getDb()
    .select({
      id: productionJobs.id,
      reference: productionJobs.reference,
      description: productionJobs.description,
      stage: productionJobs.stage,
      priority: productionJobs.priority,
      targetDate: productionJobs.targetDate,
      assignees: sql<string | null>`(SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) FROM production_job_assignees a JOIN profiles p ON p.id = a.user_id WHERE a.job_id = ${JOB_ID})`,
      openIssues: sql<number>`(SELECT count(*)::int FROM production_issues i WHERE i.job_id = ${JOB_ID} AND i.resolved_at IS NULL)`,
    })
    .from(productionJobs)
    .where(cond)
    .orderBy(sql`CASE ${productionJobs.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`, sql`${productionJobs.targetDate} ASC NULLS LAST`)
    .limit(300);
  void actor;
  return { rows: rows.map((r) => ({ ...r, overdue: Boolean(r.targetDate && r.targetDate < today && r.stage !== "ready_for_delivery") })), today };
}

export async function getJob(actor: Actor, jobId: string) {
  await assertJobAccess(getDb(), actor, jobId, "production:view");
  const db = getDb();
  const [row] = await db
    .select({ j: productionJobs, orderReference: salesOrders.reference, orderStatus: salesOrders.status, orderTotal: salesOrders.total, orderCurrency: salesOrders.currency, customerName: customers.name })
    .from(productionJobs)
    .innerJoin(salesOrders, eq(salesOrders.id, productionJobs.orderId))
    .innerJoin(customers, eq(customers.id, productionJobs.customerId))
    .where(eq(productionJobs.id, jobId))
    .limit(1);
  if (!row) throw notFound("That job could not be found.");
  const [assignees, history, issues, plan, consumption, files, labour] = await Promise.all([
    db.select({ id: profiles.id, name: profiles.fullName }).from(productionJobAssignees).innerJoin(profiles, eq(profiles.id, productionJobAssignees.userId)).where(eq(productionJobAssignees.jobId, jobId)).orderBy(asc(profiles.fullName)),
    db.select({ id: productionStageHistory.id, from: productionStageHistory.fromStage, to: productionStageHistory.toStage, note: productionStageHistory.note, at: productionStageHistory.changedAt, byName: profiles.fullName }).from(productionStageHistory).leftJoin(profiles, eq(profiles.id, productionStageHistory.changedBy)).where(eq(productionStageHistory.jobId, jobId)).orderBy(desc(productionStageHistory.changedAt), desc(productionStageHistory.id)),
    db.select({ id: productionIssues.id, type: productionIssues.type, note: productionIssues.note, resolvedAt: productionIssues.resolvedAt, createdAt: productionIssues.createdAt, byName: profiles.fullName }).from(productionIssues).leftJoin(profiles, eq(profiles.id, productionIssues.createdBy)).where(eq(productionIssues.jobId, jobId)).orderBy(desc(productionIssues.createdAt)),
    db.select({ id: jobMaterials.id, itemId: jobMaterials.itemId, name: inventoryItems.name, unit: inventoryItems.unit, planned: jobMaterials.plannedQuantity, unitCost: jobMaterials.estimatedUnitCost, note: jobMaterials.note }).from(jobMaterials).innerJoin(inventoryItems, eq(inventoryItems.id, jobMaterials.itemId)).where(eq(jobMaterials.jobId, jobId)).orderBy(asc(inventoryItems.name)),
    db.select({ id: materialConsumption.id, name: inventoryItems.name, unit: inventoryItems.unit, quantity: materialConsumption.quantity, waste: materialConsumption.wasteQuantity, unitCost: materialConsumption.unitCost, at: materialConsumption.createdAt, note: materialConsumption.note, byName: profiles.fullName, locationName: locations.name }).from(materialConsumption).innerJoin(inventoryItems, eq(inventoryItems.id, materialConsumption.itemId)).innerJoin(locations, eq(locations.id, materialConsumption.locationId)).leftJoin(profiles, eq(profiles.id, materialConsumption.recordedBy)).where(eq(materialConsumption.jobId, jobId)).orderBy(desc(materialConsumption.createdAt)),
    db.select({ id: uploadedFiles.id, name: uploadedFiles.originalName, contentType: uploadedFiles.contentType }).from(productionJobFiles).innerJoin(uploadedFiles, eq(uploadedFiles.id, productionJobFiles.fileId)).where(eq(productionJobFiles.jobId, jobId)),
    can(actor, "production:view_costs") ? db.select().from(labourEntries).where(eq(labourEntries.jobId, jobId)).orderBy(desc(labourEntries.createdAt)) : Promise.resolve([]),
  ]);
  const settings = await getProductionSettings(db);
  const costs = can(actor, "production:view_costs");
  return {
    job: row.j,
    order: { id: row.j.orderId, reference: row.orderReference, status: row.orderStatus },
    // The workshop never sees who the customer is or what they paid.
    customerName: can(actor, "customers:view") ? row.customerName : null,
    orderTotal: can(actor, "production:view_costs") ? { amount: row.orderTotal, currency: row.orderCurrency } : null,
    assignees,
    history,
    issues,
    // Unit costs are finance information: the workshop sees quantities only.
    plan: costs ? plan : plan.map((p) => ({ ...p, unitCost: null })),
    consumption: costs ? consumption : consumption.map((c) => ({ ...c, unitCost: null })),
    files,
    labour,
    canSeeCosts: costs,
    trackLabour: settings.trackLabour,
  };
}

/** For the order page: sales staff may see where a custom order is in production (stage only). */
export async function getJobStatusForOrder(actor: Actor, orderId: string) {
  if (!can(actor, "production:view") && !can(actor, "production:view_status")) return null;
  const [j] = await getDb().select({ id: productionJobs.id, reference: productionJobs.reference, stage: productionJobs.stage, targetDate: productionJobs.targetDate, completedAt: productionJobs.completedAt }).from(productionJobs).where(eq(productionJobs.orderId, orderId)).limit(1);
  if (!j) return null;
  return { ...j, linkable: scopeOf(actor, "production:view") === "all" };
}

/**
 * Estimated vs actual DIRECT cost and a margin ESTIMATE. Always labelled as an estimate: it only knows what was entered,
 * so missing costs are listed and `complete` stays false until nothing is missing and the job is finished.
 */
export async function getJobCosting(actor: Actor, jobId: string) {
  requirePermission(actor, "production:view_costs");
  const db = getDb();
  const [row] = await db.select({ j: productionJobs, total: salesOrders.total, currency: salesOrders.currency }).from(productionJobs).innerJoin(salesOrders, eq(salesOrders.id, productionJobs.orderId)).where(eq(productionJobs.id, jobId));
  if (!row) throw notFound("That job could not be found.");
  const [plan, used, labour] = await Promise.all([
    db.select({ planned: jobMaterials.plannedQuantity, cost: jobMaterials.estimatedUnitCost, name: inventoryItems.name }).from(jobMaterials).innerJoin(inventoryItems, eq(inventoryItems.id, jobMaterials.itemId)).where(eq(jobMaterials.jobId, jobId)),
    db.select({ quantity: materialConsumption.quantity, waste: materialConsumption.wasteQuantity, cost: materialConsumption.unitCost, name: inventoryItems.name }).from(materialConsumption).innerJoin(inventoryItems, eq(inventoryItems.id, materialConsumption.itemId)).where(eq(materialConsumption.jobId, jobId)),
    db.select({ amount: labourEntries.amount }).from(labourEntries).where(eq(labourEntries.jobId, jobId)),
  ]);
  const missing = new Set<string>();
  let estimated = dec(0);
  for (const p of plan) {
    if (p.cost === null) missing.add(p.name);
    else estimated = estimated.plus(dec(p.planned).times(p.cost));
  }
  let materialsActual = dec(0);
  for (const u of used) {
    if (u.cost === null) missing.add(u.name);
    else materialsActual = materialsActual.plus(dec(u.quantity).plus(u.waste).times(u.cost));
  }
  const labourTotal = labour.reduce((s, l) => s.plus(l.amount), dec(0));
  const actual = materialsActual.plus(labourTotal);
  const price = dec(row.total);
  const hasActual = used.length > 0 || labour.length > 0;
  return {
    currency: row.currency,
    orderTotal: moneyString(price),
    estimatedMaterials: roundMoney(estimated).toFixed(2),
    actualMaterials: roundMoney(materialsActual).toFixed(2),
    actualLabour: roundMoney(labourTotal).toFixed(2),
    actualDirect: roundMoney(actual).toFixed(2),
    estimatedMargin: plan.length ? roundMoney(price.minus(estimated).minus(labourTotal)).toFixed(2) : null,
    actualMargin: hasActual ? roundMoney(price.minus(actual)).toFixed(2) : null,
    missingCosts: [...missing].sort(),
    finished: row.j.stage === "ready_for_delivery",
    /** True only when every used material has a cost and the job is finished. Even then it is an estimate, not audited profit. */
    complete: hasActual && missing.size === 0 && row.j.stage === "ready_for_delivery",
  };
}

export async function getWorkshopSummary(actor: Actor, now: Date = new Date()) {
  requirePermission(actor, "production:view");
  const today = todayLocal((await getBusinessSettings()).timezone, now);
  const sc = scopeFilter(actor);
  const rows = await getDb()
    .select({ stage: productionJobs.stage, n: sql<number>`count(*)::int`, overdue: sql<number>`count(*) FILTER (WHERE ${productionJobs.targetDate} < ${today})::int` })
    .from(productionJobs)
    .where(and(notInArray(productionJobs.stage, ["ready_for_delivery", "cancelled"]), sc))
    .groupBy(productionJobs.stage);
  const byStage: Record<string, number> = {};
  let overdue = 0;
  for (const r of rows) {
    byStage[r.stage] = r.n;
    overdue += r.overdue;
  }
  return { byStage, overdue, active: rows.reduce((s, r) => s + r.n, 0), today };
}

export { FLOW, ne, desc };
