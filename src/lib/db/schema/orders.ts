import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, check, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { productVariants, products } from "./catalogue";
import { customerAccounts } from "./accounts";
import { profiles } from "./foundation";

/** Online orders: placed on the public website, paid for offline (on delivery, by bank transfer, or at the showroom). No online payments. */

export const orderStatus = pgEnum("online_order_status", ["new", "confirmed", "in_progress", "ready", "out_for_delivery", "delivered", "refunded", "cancelled"]);
export const orderPayment = pgEnum("online_order_payment", ["on_delivery", "bank_transfer", "at_showroom"]);
export const orderFulfilment = pgEnum("online_order_fulfilment", ["delivery", "pickup"]);
export const contactMethod = pgEnum("contact_method", ["phone", "whatsapp", "email"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const orders = pgTable(
  "online_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    status: orderStatus("status").notNull().default("new"),
    /** Contact details exactly as the customer entered them. */
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    /** Normalised phone (see lib/contact.ts), used to group a customer's orders. */
    phoneKey: text("phone_key").notNull(),
    email: text("email"),
    emailLower: text("email_lower"),
    fulfilment: orderFulfilment("fulfilment").notNull().default("delivery"),
    /** Delivery address; empty for showroom pickup. */
    address: text("address"),
    paymentMethod: orderPayment("payment_method").notNull().default("on_delivery"),
    /** Set by staff when the money has been received offline. Never set by the website. */
    isPaid: boolean("is_paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Cached from the payment rows: the money received (the order total once it is paid). */
    paidAmount: money("paid_amount").notNull().default("0"),
    /** A discount staff gave on the order, taken off the items before delivery is added. */
    discount: money("discount").notNull().default("0"),
    discountReason: text("discount_reason"),
    /** Numbered when the order is confirmed (or first paid): INV-000001. */
    invoiceNumber: text("invoice_number").unique(),
    /** Staff have entered the delivery charge (0 counts). A delivery cannot be confirmed before this. */
    deliveryChargeSet: boolean("delivery_charge_set").notNull().default(false),
    currency: text("currency").notNull(),
    subtotal: money("subtotal").notNull().default("0"),
    /** Delivery charge is agreed by staff with the customer; 0 until entered. */
    deliveryCharge: money("delivery_charge").notNull().default("0"),
    total: money("total").notNull().default("0"),
    customerNote: text("customer_note"),
    staffNote: text("staff_note"),
    cancelReason: text("cancel_reason"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** The day staff plan to deliver the order or have it ready to collect. */
    scheduledFor: date("scheduled_for"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    outForDeliveryAt: timestamp("out_for_delivery_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    /** Set when the owner marks the order refunded; the money goes back outside the system. */
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundReason: text("refund_reason"),
    handledBy: uuid("handled_by").references(() => profiles.id, { onDelete: "set null" }),
    /** The signed-in customer who placed it, when there was one. Guests leave this empty. */
    accountId: uuid("account_id").references(() => customerAccounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("online_orders_status_idx").on(t.status),
    index("online_orders_created_idx").on(t.createdAt),
    index("online_orders_phone_key_idx").on(t.phoneKey),
    index("online_orders_account_idx").on(t.accountId, t.createdAt),
    check("online_orders_amounts_nonneg", sql`${t.subtotal} >= 0 AND ${t.deliveryCharge} >= 0 AND ${t.total} >= 0`),
    check("online_orders_cancel_has_reason", sql`${t.status} <> 'cancelled' OR ${t.cancelReason} IS NOT NULL`),
    check("online_orders_delivery_has_address", sql`${t.fulfilment} <> 'delivery' OR ${t.address} IS NOT NULL`),
  ],
);

/** One line per product option, with the name and price copied at the time of ordering so later catalogue edits never change an order. */
export const orderItems = pgTable(
  "online_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label"),
    sku: text("sku"),
    unitPrice: money("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [
    index("online_order_items_order_idx").on(t.orderId, t.position),
    check("online_order_items_values", sql`${t.quantity} > 0 AND ${t.quantity} <= 99 AND ${t.unitPrice} >= 0 AND ${t.lineTotal} >= 0`),
  ],
);

/** Contact-form and enquiry messages from the website (general, about a product, or a custom-furniture request). */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    kind: text("kind").notNull().default("general"),
    isHandled: boolean("is_handled").notNull().default(false),
    /** Staff are working on an enquiry but have not answered it yet. */
    inProgress: boolean("in_progress").notNull().default(false),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    handledBy: uuid("handled_by").references(() => profiles.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    phoneKey: text("phone_key").notNull(),
    email: text("email"),
    preferredContact: contactMethod("preferred_contact"),
    message: text("message"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    /** Custom-furniture details exactly as submitted (type, dimensions, material, finish, budget, target date). */
    payload: jsonb("payload"),
    /** The signed-in customer who sent it, when there was one. */
    accountId: uuid("account_id").references(() => customerAccounts.id, { onDelete: "set null" }),
    /** Made-to-measure requests are quotations: requested, then quoted by staff, then accepted or declined by the customer. */
    quoteStatus: text("quote_status"),
    quotedAmount: money("quoted_amount"),
    quoteNote: text("quote_note"),
    quoteValidUntil: date("quote_valid_until"),
    quotedAt: timestamp("quoted_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    /** The confirmed order made from an accepted quotation. */
    orderId: uuid("order_id").references((): AnyPgColumn => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_handled_idx").on(t.isHandled, t.createdAt),
    index("messages_account_idx").on(t.accountId, t.createdAt),
    check("messages_kind_known", sql`${t.kind} IN ('general', 'product_enquiry', 'custom')`),
    check("messages_quote_status_known", sql`${t.quoteStatus} IS NULL OR ${t.quoteStatus} IN ('requested', 'under_review', 'quoted', 'accepted', 'declined', 'cancelled')`),
    check("messages_quote_amount_nonneg", sql`${t.quotedAmount} IS NULL OR ${t.quotedAmount} >= 0`),
  ],
);

/** The payment record of an order: each payment gets a receipt number (RCP-). A mistake is voided, never deleted. */
export const orderPayments = pgTable(
  "online_order_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["payment"] }).notNull().default("payment"),
    amount: money("amount").notNull(),
    method: text("method", { enum: ["cash", "bank_transfer", "card", "other"] }).notNull(),
    reference: text("reference"),
    note: text("note"),
    number: text("number").notNull().unique(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    recordedBy: uuid("recorded_by").references(() => profiles.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => profiles.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("online_order_payments_order_idx").on(t.orderId, t.createdAt)],
);

/** Replies staff send to a customer from the enquiry or quotation page: who sent it, and how it reached the customer (email, their account, or both). */
export const messageReplies = pgTable(
  "message_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    sentBy: uuid("sent_by").references(() => profiles.id, { onDelete: "set null" }),
    emailedTo: text("emailed_to"),
    onAccount: boolean("on_account").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("message_replies_message_idx").on(t.messageId, t.createdAt)],
);
