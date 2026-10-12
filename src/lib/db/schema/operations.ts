import { sql } from "drizzle-orm";
import { boolean, check, date, index, numeric, pgEnum, pgTable, text, time, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { customers } from "./crm";
import { profiles, uploadedFiles } from "./foundation";
import { productionJobs } from "./production";
import { suppliers } from "./purchasing";
import { paymentMethod, salesOrders } from "./sales";

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/* ───────────────────────────── deliveries ───────────────────────────── */

export const deliveryStatus = pgEnum("delivery_status", ["planned", "out_for_delivery", "delivered", "failed"]);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    status: deliveryStatus("status").notNull().default("planned"),
    scheduledOn: date("scheduled_on").notNull(),
    windowStart: time("window_start"),
    windowEnd: time("window_end"),
    addressLine: text("address_line").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    /** Informational: what was agreed for delivery. The amount charged to the customer is the order's delivery charge. */
    fee: money("fee").notNull().default("0"),
    assigneeId: uuid("assignee_id").references(() => profiles.id, { onDelete: "restrict" }),
    notes: text("notes"),
    proofNote: text("proof_note"),
    proofFileId: uuid("proof_file_id").references(() => uploadedFiles.id, { onDelete: "restrict" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedReason: text("failed_reason"),
    rescheduledFromId: uuid("rescheduled_from_id").references((): AnyPgColumn => deliveries.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deliveries_order_idx").on(t.orderId),
    index("deliveries_scheduled_idx").on(t.scheduledOn),
    index("deliveries_assignee_idx").on(t.assigneeId),
    /** At most one open delivery per order; a failed one is rescheduled as a NEW row. */
    uniqueIndex("deliveries_one_open_per_order").on(t.orderId).where(sql`${t.status} IN ('planned', 'out_for_delivery')`),
    check("deliveries_fee_nonneg", sql`${t.fee} >= 0`),
    check("deliveries_delivered_has_time", sql`${t.status} <> 'delivered' OR ${t.deliveredAt} IS NOT NULL`),
    check("deliveries_failed_has_reason", sql`${t.status} <> 'failed' OR ${t.failedReason} IS NOT NULL`),
    check("deliveries_window_order", sql`${t.windowStart} IS NULL OR ${t.windowEnd} IS NULL OR ${t.windowStart} < ${t.windowEnd}`),
  ],
);

export const deliveryEvents = pgTable(
  "delivery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "restrict" }),
    fromStatus: deliveryStatus("from_status"),
    toStatus: deliveryStatus("to_status").notNull(),
    note: text("note"),
    changedBy: uuid("changed_by").references(() => profiles.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("delivery_events_delivery_idx").on(t.deliveryId, t.changedAt)],
);

/* ───────────────────────────── expenses ───────────────────────────── */

export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Operational expense record. Never edited or deleted: a mistake is voided (with a reason) and re-entered. */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spentOn: date("spent_on").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    description: text("description").notNull(),
    payee: text("payee"),
    method: paymentMethod("method").notNull().default("cash"),
    reference: text("reference"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => salesOrders.id, { onDelete: "restrict" }),
    jobId: uuid("job_id").references(() => productionJobs.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => profiles.id, { onDelete: "restrict" }),
    voidReason: text("void_reason"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_spent_idx").on(t.spentOn),
    index("expenses_category_idx").on(t.categoryId),
    check("expenses_amount_positive", sql`${t.amount} > 0`),
    check("expenses_void_has_reason", sql`${t.voidedAt} IS NULL OR (${t.voidReason} IS NOT NULL AND ${t.voidedBy} IS NOT NULL)`),
  ],
);

/* ───────────────────────────── after-sales ───────────────────────────── */

export const caseType = pgEnum("after_sales_type", ["warranty", "repair", "complaint"]);
export const caseStatus = pgEnum("after_sales_status", ["open", "in_progress", "resolved", "closed"]);

export const afterSalesCases = pgTable(
  "after_sales_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => salesOrders.id, { onDelete: "restrict" }),
    type: caseType("type").notNull(),
    status: caseStatus("status").notNull().default("open"),
    subject: text("subject").notNull(),
    description: text("description"),
    resolution: text("resolution"),
    assigneeId: uuid("assignee_id").references(() => profiles.id, { onDelete: "restrict" }),
    dueOn: date("due_on"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("after_sales_customer_idx").on(t.customerId),
    index("after_sales_status_idx").on(t.status),
    check("after_sales_resolved_has_resolution", sql`${t.status} NOT IN ('resolved', 'closed') OR ${t.resolution} IS NOT NULL`),
  ],
);

/** Append-only case history: notes and status changes. */
export const afterSalesNotes = pgTable(
  "after_sales_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => afterSalesCases.id, { onDelete: "restrict" }),
    fromStatus: caseStatus("from_status"),
    toStatus: caseStatus("to_status"),
    body: text("body"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("after_sales_notes_case_idx").on(t.caseId, t.createdAt)],
);
