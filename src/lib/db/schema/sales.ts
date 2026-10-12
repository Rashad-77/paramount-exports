import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { productVariants } from "./catalogue";
import { customers } from "./crm";
import { inventoryItems, reservationStatus } from "./inventory";
import { locations, profiles } from "./foundation";
import { quotationRevisions, quotations } from "./quotations";

export const orderType = pgEnum("order_type", ["ready_made", "custom"]);
export const orderStatus = pgEnum("order_status", ["draft", "confirmed", "preparing", "ready", "delivered", "cancelled"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card", "bank_transfer", "cheque", "other"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    /** One order per accepted quotation (unique). Custom orders must come from a quotation. */
    quotationId: uuid("quotation_id")
      .references(() => quotations.id, { onDelete: "restrict" })
      .unique(),
    quotationRevisionId: uuid("quotation_revision_id").references(() => quotationRevisions.id, { onDelete: "restrict" }),
    type: orderType("type").notNull(),
    status: orderStatus("status").notNull().default("draft"),
    /** Ready-made: the location stock is reserved from and delivered from. */
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "restrict" }),
    currency: text("currency").notNull(),
    subtotal: money("subtotal").notNull().default("0"),
    discountTotal: money("discount_total").notNull().default("0"),
    deliveryCharge: money("delivery_charge").notNull().default("0"),
    total: money("total").notNull().default("0"),
    /** Free text: the agreed deposit / payment terms. No percentage is assumed. */
    depositTerms: text("deposit_terms"),
    requestedCompletionDate: date("requested_completion_date"),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sales_orders_customer_idx").on(t.customerId),
    index("sales_orders_status_idx").on(t.status),
    index("sales_orders_created_idx").on(t.createdAt),
    check("sales_orders_custom_needs_quotation", sql`${t.type} <> 'custom' OR ${t.quotationId} IS NOT NULL`),
    check("sales_orders_ready_made_needs_location", sql`${t.type} <> 'ready_made' OR ${t.locationId} IS NOT NULL`),
    check("sales_orders_cancel_has_reason", sql`${t.status} <> 'cancelled' OR ${t.cancelReason} IS NOT NULL`),
    check("sales_orders_amounts_nonneg", sql`${t.subtotal} >= 0 AND ${t.discountTotal} >= 0 AND ${t.deliveryCharge} >= 0 AND ${t.total} >= 0`),
  ],
);

export const salesOrderItems = pgTable(
  "sales_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    /** Resolved from the variant when the line is saved; the stock this line reserves and sells. */
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    specification: jsonb("specification"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: money("unit_price").notNull(),
    discountAmount: money("discount_amount").notNull().default("0"),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [
    index("sales_order_items_order_idx").on(t.orderId, t.position),
    check("sales_order_items_values", sql`${t.quantity} > 0 AND ${t.unitPrice} >= 0 AND ${t.discountAmount} >= 0 AND ${t.lineTotal} >= 0`),
  ],
);

/** Stock held for an order line from confirmation until delivery (fulfilled) or cancellation (released). */
export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => salesOrderItems.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    status: reservationStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_reservations_order_item_idx").on(t.orderItemId), index("stock_reservations_status_idx").on(t.status), check("stock_reservations_qty_positive", sql`${t.quantity} > 0`)],
);

/**
 * Append-only. A void is a NEGATIVE row pointing at the original (voids_payment_id), so the history shows both.
 * Outstanding balance = order total − Σ amount.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    method: paymentMethod("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    reference: text("reference"),
    note: text("note"),
    voidsPaymentId: uuid("voids_payment_id").references((): AnyPgColumn => payments.id, { onDelete: "restrict" }),
    recordedBy: uuid("recorded_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_paid_at_idx").on(t.paidAt),
    unique("payments_one_void_per_payment").on(t.voidsPaymentId),
    check("payments_sign", sql`(${t.voidsPaymentId} IS NULL AND ${t.amount} > 0) OR (${t.voidsPaymentId} IS NOT NULL AND ${t.amount} < 0)`),
  ],
);
