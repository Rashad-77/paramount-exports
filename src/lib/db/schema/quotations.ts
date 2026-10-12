import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { productVariants } from "./catalogue";
import { customers, leads } from "./crm";
import { profiles } from "./foundation";

export const quotationStatus = pgEnum("quotation_status", ["draft", "sent", "accepted", "rejected", "expired", "converted"]);
export const quotationItemKind = pgEnum("quotation_item_kind", ["ready_made", "custom"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "restrict" }),
    status: quotationStatus("status").notNull().default("draft"),
    currentRevisionNo: integer("current_revision_no").notNull().default(1),
    currency: text("currency").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quotations_customer_idx").on(t.customerId),
    index("quotations_status_idx").on(t.status),
    index("quotations_lead_idx").on(t.leadId),
    check("quotations_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/** One row per version. A revision is frozen when sent: from then on neither it nor its items can change (trigger). */
export const quotationRevisions = pgTable(
  "quotation_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "restrict" }),
    revisionNo: integer("revision_no").notNull(),
    validUntil: date("valid_until").notNull(),
    deliveryCharge: money("delivery_charge").notNull().default("0"),
    subtotal: money("subtotal").notNull().default("0"),
    discountTotal: money("discount_total").notNull().default("0"),
    total: money("total").notNull().default("0"),
    terms: text("terms"),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    frozenBy: uuid("frozen_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("quotation_revisions_unique").on(t.quotationId, t.revisionNo),
    check("quotation_revisions_amounts_nonneg", sql`${t.deliveryCharge} >= 0 AND ${t.subtotal} >= 0 AND ${t.discountTotal} >= 0 AND ${t.total} >= 0`),
  ],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => quotationRevisions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    kind: quotationItemKind("kind").notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    /** Custom pieces: dimensions / material / finish / notes. */
    specification: jsonb("specification"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: money("unit_price").notNull(),
    discountAmount: money("discount_amount").notNull().default("0"),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [
    index("quotation_items_revision_idx").on(t.revisionId, t.position),
    check("quotation_items_values", sql`${t.quantity} > 0 AND ${t.unitPrice} >= 0 AND ${t.discountAmount} >= 0 AND ${t.lineTotal} >= 0`),
  ],
);
