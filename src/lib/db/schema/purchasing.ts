import { sql } from "drizzle-orm";
import { check, date, index, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { locations, profiles } from "./foundation";
import { inventoryItems, inventoryMovements } from "./inventory";
import { paymentMethod } from "./sales";

export const poStatus = pgEnum("po_status", ["draft", "sent", "partially_received", "received", "cancelled"]);

const qty = (name: string) => numeric(name, { precision: 14, scale: 3 });
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    suppliedMaterials: text("supplied_materials"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suppliers_name_idx").on(t.name)],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    status: poStatus("status").notNull().default("draft"),
    /** Where received goods are put into stock. */
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    currency: text("currency").notNull(),
    expectedOn: date("expected_on"),
    notes: text("notes"),
    /** Operational tracking only (not a supplier ledger). */
    supplierInvoiceRef: text("supplier_invoice_ref"),
    supplierInvoiceAmount: money("supplier_invoice_amount"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("purchase_orders_supplier_idx").on(t.supplierId),
    index("purchase_orders_status_idx").on(t.status),
    check("purchase_orders_invoice_nonneg", sql`${t.supplierInvoiceAmount} IS NULL OR ${t.supplierInvoiceAmount} >= 0`),
    check("purchase_orders_cancel_reason", sql`${t.status} <> 'cancelled' OR ${t.cancelReason} IS NOT NULL`),
  ],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantityOrdered: qty("quantity_ordered").notNull(),
    expectedUnitCost: money("expected_unit_cost").notNull().default("0"),
  },
  (t) => [
    unique("purchase_order_items_position").on(t.purchaseOrderId, t.position),
    check("purchase_order_items_values", sql`${t.quantityOrdered} > 0 AND ${t.expectedUnitCost} >= 0`),
  ],
);

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    note: text("note"),
    receivedBy: uuid("received_by").references(() => profiles.id, { onDelete: "restrict" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goods_receipts_po_idx").on(t.purchaseOrderId)],
);

/** Quantities ACTUALLY received. Stock increases by exactly these, never by the ordered amount. */
export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "restrict" }),
    purchaseOrderItemId: uuid("purchase_order_item_id")
      .notNull()
      .references(() => purchaseOrderItems.id, { onDelete: "restrict" }),
    quantity: qty("quantity").notNull(),
    movementId: uuid("movement_id")
      .notNull()
      .references(() => inventoryMovements.id, { onDelete: "restrict" })
      .unique(),
  },
  (t) => [index("goods_receipt_items_line_idx").on(t.purchaseOrderItemId), check("goods_receipt_items_qty_positive", sql`${t.quantity} > 0`)],
);

/** Append-only record of money paid to a supplier against a purchase order. */
export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    method: paymentMethod("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    reference: text("reference"),
    note: text("note"),
    recordedBy: uuid("recorded_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("supplier_payments_po_idx").on(t.purchaseOrderId), check("supplier_payments_positive", sql`${t.amount} > 0`)],
);
