import { sql } from "drizzle-orm";
import { boolean, check, index, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles, locations } from "./foundation";

export const inventoryItemKind = pgEnum("inventory_item_kind", ["finished_good", "raw_material", "consumable"]);
export const movementType = pgEnum("movement_type", [
  "opening",
  "receipt",
  "sale",
  "reserve",
  "release",
  "transfer_out",
  "transfer_in",
  "production_consume",
  "production_output",
  "waste",
  "adjustment",
]);
export const reservationStatus = pgEnum("reservation_status", ["active", "fulfilled", "released"]);

const qty = (name: string) => numeric(name, { precision: 14, scale: 3 });

/** Anything that is counted: finished furniture, raw timber/boards, hardware, finishes. */
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: inventoryItemKind("kind").notNull(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    /** Display unit, e.g. pcs, m, m3, sheet, kg, litre. */
    unit: text("unit").notNull().default("pcs"),
    /** Standard cost per unit (used for estimated job costs). Optional; never presented as audited. */
    costPrice: numeric("cost_price", { precision: 14, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inventory_items_kind_idx").on(t.kind), check("inventory_items_cost_nonneg", sql`${t.costPrice} IS NULL OR ${t.costPrice} >= 0`)],
);

/**
 * Current quantities per item and location. Maintained ONLY by a trigger on inventory_movements, so it cannot
 * drift from the ledger. CHECKs make negative stock and over-reservation impossible even if a bug slips through.
 */
export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    onHand: qty("on_hand").notNull().default("0"),
    reserved: qty("reserved").notNull().default("0"),
    lowStockThreshold: qty("low_stock_threshold"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.locationId] }),
    check("inventory_balances_on_hand_nonneg", sql`${t.onHand} >= 0`),
    check("inventory_balances_reserved_nonneg", sql`${t.reserved} >= 0`),
    check("inventory_balances_reserved_within_on_hand", sql`${t.reserved} <= ${t.onHand}`),
    check("inventory_balances_threshold_nonneg", sql`${t.lowStockThreshold} IS NULL OR ${t.lowStockThreshold} >= 0`),
  ],
);

/** The ledger. Append-only (trigger). History is corrected with new movements, never edits. */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    type: movementType("type").notNull(),
    onHandDelta: qty("on_hand_delta").notNull(),
    reservedDelta: qty("reserved_delta").notNull().default("0"),
    reason: text("reason"),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_movements_item_idx").on(t.itemId, t.createdAt),
    index("inventory_movements_ref_idx").on(t.refType, t.refId),
    index("inventory_movements_location_idx").on(t.locationId),
  ],
);

export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    fromLocationId: uuid("from_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    toLocationId: uuid("to_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("stock_transfers_different_locations", sql`${t.fromLocationId} <> ${t.toLocationId}`)],
);

export const stockTransferItems = pgTable(
  "stock_transfer_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => stockTransfers.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantity: qty("quantity").notNull(),
  },
  (t) => [index("stock_transfer_items_transfer_idx").on(t.transferId), check("stock_transfer_items_qty_positive", sql`${t.quantity} > 0`)],
);

