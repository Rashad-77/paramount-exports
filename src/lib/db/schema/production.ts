import { sql } from "drizzle-orm";
import { check, date, index, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { customers } from "./crm";
import { locations, profiles, uploadedFiles } from "./foundation";
import { inventoryItems, inventoryMovements } from "./inventory";
import { salesOrders } from "./sales";

export const jobStage = pgEnum("job_stage", [
  "awaiting_materials",
  "ready_to_start",
  "cutting_preparation",
  "assembly",
  "sanding_finishing",
  "quality_check",
  "ready_for_delivery",
  "on_hold",
  "cancelled",
]);
export const jobPriority = pgEnum("job_priority", ["low", "normal", "high", "urgent"]);
export const issueType = pgEnum("issue_type", ["delay", "rework", "issue"]);

const qty = (name: string) => numeric(name, { precision: 14, scale: 3 });
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/** One production job per custom order, created when the order is confirmed. */
export const productionJobs = pgTable(
  "production_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" })
      .unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    /** Lines from the order (description, specification, quantity): dimensions, wood, finish, notes. */
    specification: jsonb("specification"),
    priority: jobPriority("priority").notNull().default("normal"),
    targetDate: date("target_date"),
    stage: jobStage("stage").notNull().default("awaiting_materials"),
    /** Where to resume when a job on hold restarts. */
    stageBeforeHold: jobStage("stage_before_hold"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Optional finished-goods workflow: when enabled, completing the job adds the piece to stock — once. */
    outputItemId: uuid("output_item_id").references(() => inventoryItems.id, { onDelete: "restrict" }),
    outputQuantity: qty("output_quantity").notNull().default("1"),
    outputLocationId: uuid("output_location_id").references(() => locations.id, { onDelete: "restrict" }),
    outputRecordedAt: timestamp("output_recorded_at", { withTimezone: true }),
    outputSoldAt: timestamp("output_sold_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("production_jobs_stage_idx").on(t.stage),
    index("production_jobs_target_idx").on(t.targetDate),
    check("production_jobs_output_sold_needs_recorded", sql`${t.outputSoldAt} IS NULL OR ${t.outputRecordedAt} IS NOT NULL`),
    check("production_jobs_output_qty_positive", sql`${t.outputQuantity} > 0`),
  ],
);

export const productionJobAssignees = pgTable(
  "production_job_assignees",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.userId] }), index("production_job_assignees_user_idx").on(t.userId)],
);

/** Reference images / drawings that belong to a job (existing uploads from the enquiry/quotation, or added by staff). */
export const productionJobFiles = pgTable(
  "production_job_files",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id, { onDelete: "restrict" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => uploadedFiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.fileId] })],
);

export const productionStageHistory = pgTable(
  "production_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id, { onDelete: "restrict" }),
    fromStage: jobStage("from_stage"),
    toStage: jobStage("to_stage").notNull(),
    note: text("note"),
    changedBy: uuid("changed_by").references(() => profiles.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("production_stage_history_job_idx").on(t.jobId, t.changedAt)],
);

export const productionIssues = pgTable(
  "production_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id, { onDelete: "restrict" }),
    type: issueType("type").notNull(),
    note: text("note").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("production_issues_job_idx").on(t.jobId)],
);

/** Planned materials (an estimate) for a job. Does not touch stock. */
export const jobMaterials = pgTable(
  "job_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    plannedQuantity: qty("planned_quantity").notNull(),
    estimatedUnitCost: money("estimated_unit_cost"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("job_materials_job_item").on(t.jobId, t.itemId), check("job_materials_values", sql`${t.plannedQuantity} > 0 AND (${t.estimatedUnitCost} IS NULL OR ${t.estimatedUnitCost} >= 0)`)],
);

/**
 * Actual material use against a job. Append-only. Each record creates its stock movements in the same transaction,
 * exactly once (`request_key` makes a double-submitted form harmless). Mistakes are corrected by a manager's stock
 * adjustment with a reason, never by editing a record.
 */
export const materialConsumption = pgTable(
  "material_consumption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    quantity: qty("quantity").notNull().default("0"),
    wasteQuantity: qty("waste_quantity").notNull().default("0"),
    /** Standard cost per unit when recorded (snapshot; null = no cost known). */
    unitCost: money("unit_cost"),
    consumeMovementId: uuid("consume_movement_id")
      .references(() => inventoryMovements.id, { onDelete: "restrict" })
      .unique(),
    wasteMovementId: uuid("waste_movement_id")
      .references(() => inventoryMovements.id, { onDelete: "restrict" })
      .unique(),
    requestKey: uuid("request_key").unique(),
    note: text("note"),
    recordedBy: uuid("recorded_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("material_consumption_job_idx").on(t.jobId),
    check("material_consumption_values", sql`${t.quantity} >= 0 AND ${t.wasteQuantity} >= 0 AND (${t.quantity} + ${t.wasteQuantity}) > 0`),
  ],
);

/** Optional direct labour cost (manual amount, or hours × rate). Not payroll. */
export const labourEntries = pgTable(
  "labour_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => productionJobs.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    hours: numeric("hours", { precision: 8, scale: 2 }),
    hourlyRate: money("hourly_rate"),
    amount: money("amount").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("labour_entries_job_idx").on(t.jobId), check("labour_entries_values", sql`${t.amount} >= 0 AND (${t.hours} IS NULL OR ${t.hours} >= 0)`)],
);
