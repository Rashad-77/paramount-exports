import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { auditLogs, inventoryMovements, payments, stockReservations } from "@/lib/db/schema";
import { customerSchema } from "@/lib/schemas/crm";
import { InsufficientStockError, createInventoryItem, fulfilReservations, listStock, lowStockAlerts, reconcileInventory, recordManualMovement, setLowStockThreshold, transferStock, getItemWithLedger, saveLocation, listTransfers } from "@/server/inventory";
import { advanceOrder, cancelOrder, confirmOrder, convertQuotationToOrder, createReadyMadeOrder, getOrder, listOrders, netPaid, recordPayment, updateReadyMadeDraft, voidPayment } from "@/server/orders";
import { createCustomer } from "@/server/customers";
import { createQuotation, decideQuotation, sendQuotation } from "@/server/quotations";
import { updateSalesSettings } from "@/server/settings";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";
import { makeLocations, makeTrackedProduct, makeUntrackedProduct } from "../helpers/stock";

const rm = (variantId: string, quantity = "1", unitPrice = "1000.00", discountAmount = "0.00") => ({ kind: "ready_made" as const, variantId, description: "Line", quantity, unitPrice, discountAmount }) as never;
const bal = async (t: { sql: ReturnType<typeof import("postgres")> }, itemId: string, locationId: string) => {
  const [r] = await t.sql`SELECT on_hand::text AS oh, reserved::text AS rv FROM inventory_balances WHERE item_id = ${itemId} AND location_id = ${locationId}`;
  return r ? { onHand: Number(r.oh), reserved: Number(r.rv) } : { onHand: 0, reserved: 0 };
};

describe.skipIf(!hasTestDb)("inventory, orders and payments (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, manager: Actor, sales: Actor, sales2: Actor, workshop: Actor, finance: Actor;
  let showroom: string, workshopLoc: string, customerId: string, seq = 0;

  const customer = async () => createCustomer(sales, customerSchema.parse({ name: `Cust ${++seq}`, phone: `07${String(10000000 + seq)}` }));
  /** product with `qty` units at the showroom */
  const stocked = async (qty: string, price = "1000.00") => {
    const p = await makeTrackedProduct(t, manager, `SKU-${++seq}`, price);
    if (Number(qty) > 0) await recordManualMovement(manager, { itemId: p.itemId, locationId: showroom, kind: "opening", quantity: qty, reason: "Opening balance" });
    return p;
  };
  const draftOrder = async (items: unknown[], actor: Actor = sales, cust?: string) =>
    createReadyMadeOrder(actor, { customerId: cust ?? customerId, locationId: showroom, deliveryCharge: "0.00", items: items as never });

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    manager = await makeActor(t, ["manager"], "Mia Manager");
    sales = await makeActor(t, ["sales"], "Sam Sales");
    sales2 = await makeActor(t, ["sales"], "Sue Sales");
    workshop = await makeActor(t, ["workshop"], "Wes Workshop");
    finance = await makeActor(t, ["finance"], "Fiona Finance");
    ({ showroom, workshop: workshopLoc } = await makeLocations(t));
    customerId = await customer();
    await updateSalesSettings(owner, { maxDiscountPercent: "10" });
  });
  afterAll(async () => {
    await t?.teardown();
  });

  describe("the ledger", () => {
    it("balances are always the sum of their movements; the ledger cannot be edited, deleted or emptied", async () => {
      const p = await stocked("10");
      await recordManualMovement(manager, { itemId: p.itemId, locationId: showroom, kind: "receipt", quantity: "5.5", reason: "Delivery from workshop" });
      await recordManualMovement(manager, { itemId: p.itemId, locationId: showroom, kind: "adjustment_down", quantity: "0.5", reason: "Counted short" });
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 15, reserved: 0 });
      expect(await reconcileInventory(t.db)).toEqual([]);
      await expect(t.sql`UPDATE inventory_movements SET on_hand_delta = 99 WHERE item_id = ${p.itemId}`).rejects.toThrow(/append-only/);
      await expect(t.sql`DELETE FROM inventory_movements WHERE item_id = ${p.itemId}`).rejects.toThrow(/append-only/);
      await expect(t.sql`TRUNCATE inventory_movements`).rejects.toThrow(/append-only|cannot truncate a table referenced/);
    });

    it("rejects impossible movements at the database level, even if the application is bypassed", async () => {
      const p = await stocked("2");
      await expect(t.sql`INSERT INTO inventory_movements (item_id, location_id, type, on_hand_delta) VALUES (${p.itemId}, ${showroom}, 'receipt', -1)`).rejects.toThrow(/inventory_movements_shape/);
      await expect(t.sql`INSERT INTO inventory_movements (item_id, location_id, type, on_hand_delta) VALUES (${p.itemId}, ${showroom}, 'waste', -3)`).rejects.toThrow(/inventory_balances_on_hand_nonneg/);
      await expect(t.sql`INSERT INTO inventory_movements (item_id, location_id, type, on_hand_delta, reserved_delta) VALUES (${p.itemId}, ${showroom}, 'reserve', 0, 3)`).rejects.toThrow(/inventory_balances_reserved_within_on_hand/);
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 2, reserved: 0 });
      expect(await reconcileInventory(t.db)).toEqual([]);
    });

    it("requires a reason and permission for manual changes, and never lets you take reserved stock", async () => {
      const p = await stocked("4");
      await expect(recordManualMovement(manager, { itemId: p.itemId, locationId: showroom, kind: "adjustment_down", quantity: "1", reason: "  " })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(recordManualMovement(sales, { itemId: p.itemId, locationId: showroom, kind: "adjustment_up", quantity: "1", reason: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(recordManualMovement(workshop, { itemId: p.itemId, locationId: showroom, kind: "waste", quantity: "1", reason: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const o = await draftOrder([rm(p.variantId, "3")]);
      await confirmOrder(sales, o); // 3 of 4 reserved → 1 available
      await expect(recordManualMovement(manager, { itemId: p.itemId, locationId: showroom, kind: "adjustment_down", quantity: "2", reason: "Damaged" })).rejects.toBeInstanceOf(InsufficientStockError);
      await recordManualMovement(manager, { itemId: p.itemId, locationId: showroom, kind: "waste", quantity: "1", reason: "Damaged" });
      const audits = await t.db.select().from(auditLogs).where(eq(auditLogs.action, "inventory.waste"));
      expect(audits[0]).toMatchObject({ reason: "Damaged", actorId: manager.id });
    });
  });

  describe("ready-made orders and stock", () => {
    it("ACCEPTANCE #4: ten simultaneous orders for 3 units — exactly 3 succeed, nothing oversells", async () => {
      const p = await stocked("3");
      const ids = [];
      for (let i = 0; i < 10; i++) ids.push(await draftOrder([rm(p.variantId, "1")], sales, await customer()));
      const results = await Promise.allSettled(ids.map((id) => confirmOrder(sales, id)));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(failures).toHaveLength(7);
      expect(failures.every((f) => f.reason instanceof InsufficientStockError)).toBe(true);
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 3, reserved: 3 });
      expect(await reconcileInventory(t.db)).toEqual([]);
      const statuses = (await t.sql`SELECT status::text, count(*)::int AS n FROM sales_orders WHERE id = ANY(${ids}) GROUP BY status`).map((r) => `${r.status}:${r.n}`).sort();
      expect(statuses).toEqual(["confirmed:3", "draft:7"]); // failed confirmations changed nothing
    });

    it("no deadlocks when many orders lock the same products in opposite orders", async () => {
      const a = await stocked("6");
      const b = await stocked("6");
      const ids = [];
      for (let i = 0; i < 20; i++) ids.push(await draftOrder(i % 2 ? [rm(a.variantId), rm(b.variantId)] : [rm(b.variantId), rm(a.variantId)], sales, await customer()));
      const results = await Promise.allSettled(ids.map((id) => confirmOrder(sales, id)));
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(rejected.every((r) => r.reason instanceof InsufficientStockError)).toBe(true); // never "deadlock detected"
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(6);
      expect(await bal(t, a.itemId, showroom)).toEqual({ onHand: 6, reserved: 6 });
      expect(await bal(t, b.itemId, showroom)).toEqual({ onHand: 6, reserved: 6 });
      expect(await reconcileInventory(t.db)).toEqual([]);
    });

    it("reserves at confirmation, deducts exactly once at delivery, with one ledger entry per line", async () => {
      const p = await stocked("5");
      const o = await draftOrder([rm(p.variantId, "2")]);
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 5, reserved: 0 }); // drafts hold nothing
      await confirmOrder(sales, o);
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 5, reserved: 2 });
      await advanceOrder(sales, o, "preparing");
      await advanceOrder(sales, o, "ready");
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 5, reserved: 2 }); // still not deducted
      await advanceOrder(sales, o, "delivered");
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 3, reserved: 0 });
      await expect(advanceOrder(sales, o, "delivered")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(t.db.transaction((tx) => fulfilReservations(tx, sales.id, o))).resolves.toBe(0); // nothing left to fulfil
      const sales_ = await t.db.select().from(inventoryMovements).where(eq(inventoryMovements.refId, o));
      expect(sales_.map((m) => m.type).sort()).toEqual(["reserve", "sale"]);
      expect(await reconcileInventory(t.db)).toEqual([]);
    });

    it("cancelling releases the reservation exactly once; a delivered order cannot be cancelled", async () => {
      const p = await stocked("2");
      const o = await draftOrder([rm(p.variantId, "2")]);
      await confirmOrder(sales, o);
      await expect(confirmOrder(sales, await draftOrder([rm(p.variantId, "1")]))).rejects.toBeInstanceOf(InsufficientStockError);
      await cancelOrder(sales, o, "Customer changed their mind");
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 2, reserved: 0 });
      await expect(cancelOrder(sales, o, "again")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(cancelOrder(sales, await draftOrder([rm(p.variantId)]), "   ")).rejects.toMatchObject({ code: "VALIDATION" });
      const o2 = await draftOrder([rm(p.variantId, "1")]);
      await confirmOrder(sales, o2);
      await advanceOrder(sales, o2, "delivered");
      await expect(cancelOrder(manager, o2, "too late")).rejects.toMatchObject({ code: "INVALID_STATE" });
      const dangling = await t.sql`SELECT r.id FROM stock_reservations r JOIN sales_order_items i ON i.id = r.order_item_id WHERE i.order_id = ANY(${[o, o2]}) AND r.status = 'active'`;
      expect(dangling).toHaveLength(0); // neither the cancelled nor the delivered order leaves stock held
      const byStatus = await t.sql`SELECT r.status::text AS s FROM stock_reservations r JOIN sales_order_items i ON i.id = r.order_item_id WHERE i.order_id = ${o}`;
      expect(byStatus.map((r) => r.s)).toEqual(["released"]);
      void stockReservations;
      expect(await reconcileInventory(t.db)).toEqual([]);
    });

    it("confirmation fails with the exact shortage and changes nothing (all-or-nothing across lines)", async () => {
      const a = await stocked("5");
      const b = await stocked("1");
      const o = await draftOrder([rm(a.variantId, "2"), rm(b.variantId, "3")]);
      await expect(confirmOrder(sales, o)).rejects.toThrow(/Product SKU-\d+ \(available 1\.000, needed 3\.000\)/);
      expect(await bal(t, a.itemId, showroom)).toEqual({ onHand: 5, reserved: 0 }); // the first line was NOT left reserved
      expect((await t.sql`SELECT status::text FROM sales_orders WHERE id = ${o}`)[0]!.status).toBe("draft");
    });

    it("stock is per location: a showroom order cannot use workshop stock", async () => {
      const p = await makeTrackedProduct(t, manager, `SKU-${++seq}`);
      await recordManualMovement(manager, { itemId: p.itemId, locationId: workshopLoc, kind: "opening", quantity: "5", reason: "Opening balance" });
      await expect(confirmOrder(sales, await draftOrder([rm(p.variantId)]))).rejects.toBeInstanceOf(InsufficientStockError);
    });

    it("refuses untracked products, lines that are not products, bad customers/locations, and over-limit discounts", async () => {
      const u = await makeUntrackedProduct(t, `SKU-${++seq}`);
      await expect(draftOrder([rm(u.variantId)])).rejects.toThrow(/stock tracking/i);
      const p = await stocked("5");
      await expect(draftOrder([{ kind: "custom", description: "x", quantity: "1", unitPrice: "1", discountAmount: "0" }])).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(createReadyMadeOrder(sales, { customerId: "00000000-0000-4000-8000-0000000000aa", locationId: showroom, deliveryCharge: "0", items: [rm(p.variantId)] as never })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(draftOrder([rm(p.variantId, "1", "1000.00", "150.00")])).rejects.toThrow(/above your limit/);
      await expect(draftOrder([rm(p.variantId, "1", "1000.00", "150.00")], manager)).resolves.toBeTruthy();
    });

    it("computes totals in exact decimals and lets a draft be edited but a confirmed order not", async () => {
      const p = await stocked("20", "333.33");
      const o = await createReadyMadeOrder(sales, { customerId, locationId: showroom, deliveryCharge: "1500.50", items: [rm(p.variantId, "3", "333.33", "10.00")] as never });
      let d = await getOrder(sales, o);
      expect(d.order).toMatchObject({ subtotal: "999.99", discountTotal: "10.00", deliveryCharge: "1500.50", total: "2490.49", status: "draft" });
      expect(d.availability![d.items[0]!.id]).toBe("20.000");
      await updateReadyMadeDraft(sales, o, { locationId: showroom, deliveryCharge: "0.00", items: [rm(p.variantId, "2", "333.33")] as never });
      d = await getOrder(sales, o);
      expect(d.order.total).toBe("666.66");
      await confirmOrder(sales, o);
      await expect(updateReadyMadeDraft(sales, o, { locationId: showroom, deliveryCharge: "0.00", items: [rm(p.variantId, "1")] as never })).rejects.toMatchObject({ code: "INVALID_STATE" });
      // …and the database itself refuses, even with raw SQL
      await expect(t.sql`UPDATE sales_order_items SET unit_price = 1 WHERE order_id = ${o}`).rejects.toThrow(/cannot be changed/);
      await expect(t.sql`DELETE FROM sales_order_items WHERE order_id = ${o}`).rejects.toThrow(/cannot be changed/);
      await expect(t.sql`UPDATE sales_orders SET total = 1 WHERE id = ${o}`).rejects.toThrow(/cannot be changed/);
    });

    it("delivered and cancelled orders are final, even with raw SQL", async () => {
      const p = await stocked("3");
      const o = await draftOrder([rm(p.variantId)]);
      await confirmOrder(sales, o);
      await advanceOrder(sales, o, "delivered");
      await expect(t.sql`UPDATE sales_orders SET status = 'confirmed' WHERE id = ${o}`).rejects.toThrow(/final/);
      await expect(advanceOrder(sales, o, "ready")).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  describe("transfers", () => {
    it("ACCEPTANCE #11: records both sides atomically with a transfer record and paired movements", async () => {
      const p = await stocked("5");
      const tr = await transferStock(sales, { fromLocationId: showroom, toLocationId: workshopLoc, items: [{ itemId: p.itemId, quantity: "3" }], note: "For finishing" });
      expect(tr.reference).toMatch(/^TRF-\d{6}$/);
      expect(await bal(t, p.itemId, showroom)).toEqual({ onHand: 2, reserved: 0 });
      expect(await bal(t, p.itemId, workshopLoc)).toEqual({ onHand: 3, reserved: 0 });
      const ms = await t.db.select().from(inventoryMovements).where(eq(inventoryMovements.refId, tr.id));
      expect(ms.map((m) => m.type).sort()).toEqual(["transfer_in", "transfer_out"]);
      expect(ms.map((m) => Number(m.onHandDelta)).sort((a, b) => a - b)).toEqual([-3, 3]);
      expect((await listTransfers(sales)).rows[0]).toMatchObject({ reference: tr.reference, fromName: "Showroom", toName: "Workshop" });
      expect(await reconcileInventory(t.db)).toEqual([]);
    });

    it("moves nothing at all when any line lacks stock, and cannot touch reserved stock", async () => {
      const a = await stocked("5");
      const b = await stocked("1");
      const before = await t.sql`SELECT (SELECT count(*)::int FROM stock_transfers) AS tr, (SELECT count(*)::int FROM inventory_movements) AS mv, (SELECT count(*)::int FROM stock_transfer_items) AS it`;
      await expect(transferStock(sales, { fromLocationId: showroom, toLocationId: workshopLoc, items: [{ itemId: a.itemId, quantity: "2" }, { itemId: b.itemId, quantity: "2" }], note: "atomic-test" })).rejects.toBeInstanceOf(InsufficientStockError);
      const after = await t.sql`SELECT (SELECT count(*)::int FROM stock_transfers) AS tr, (SELECT count(*)::int FROM inventory_movements) AS mv, (SELECT count(*)::int FROM stock_transfer_items) AS it`;
      expect(after[0]).toEqual(before[0]); // no transfer row, no lines, no movements: a failed transfer leaves no trace
      expect(await bal(t, a.itemId, showroom)).toEqual({ onHand: 5, reserved: 0 });
      expect(await bal(t, a.itemId, workshopLoc)).toEqual({ onHand: 0, reserved: 0 });
      await confirmOrder(sales, await draftOrder([rm(a.variantId, "4")]));
      await expect(transferStock(sales, { fromLocationId: showroom, toLocationId: workshopLoc, items: [{ itemId: a.itemId, quantity: "2" }] })).rejects.toBeInstanceOf(InsufficientStockError);
    });

    it("validates locations and permissions; sales may move finished goods but not raw materials", async () => {
      const p = await stocked("2");
      await expect(transferStock(sales, { fromLocationId: showroom, toLocationId: showroom, items: [{ itemId: p.itemId, quantity: "1" }] })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(transferStock(finance, { fromLocationId: showroom, toLocationId: workshopLoc, items: [{ itemId: p.itemId, quantity: "1" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const timber = await createInventoryItem(manager, { kind: "raw_material", sku: `TIM-${++seq}`, name: "Teak plank", unit: "m" });
      await recordManualMovement(manager, { itemId: timber, locationId: workshopLoc, kind: "opening", quantity: "50", reason: "Opening" });
      await expect(transferStock(sales, { fromLocationId: workshopLoc, toLocationId: showroom, items: [{ itemId: timber, quantity: "1" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(transferStock(workshop, { fromLocationId: workshopLoc, toLocationId: showroom, items: [{ itemId: timber, quantity: "1" }] })).resolves.toBeTruthy();
    });
  });

  describe("quotation → order", () => {
    const acceptedQuotation = async (items: unknown[], actor = sales) => {
      const cid = await customer();
      const q = await createQuotation(actor, { customerId: cid, validUntil: "2099-01-01", deliveryCharge: "500.00", items: items as never } as never);
      await sendQuotation(actor, q);
      await decideQuotation(actor, q, "accepted");
      return { q, cid };
    };

    it("ACCEPTANCE #3: converts an accepted quotation, preserving customer, lines, prices and totals", async () => {
      const p = await stocked("5", "1000.00");
      const { q, cid } = await acceptedQuotation([rm(p.variantId, "2", "1000.00", "100.00")]);
      const orderId = await convertQuotationToOrder(sales, q, { locationId: showroom, depositTerms: "Half now, half on delivery" });
      const d = await getOrder(sales, orderId);
      expect(d.order).toMatchObject({ type: "ready_made", status: "draft", customerId: cid, quotationId: q, total: "2400.00", subtotal: "2000.00", discountTotal: "100.00", deliveryCharge: "500.00", depositTerms: "Half now, half on delivery" });
      expect(d.items).toHaveLength(1);
      expect(d.items[0]).toMatchObject({ variantId: p.variantId, quantity: "2.000", unitPrice: "1000.00", discountAmount: "100.00", lineTotal: "1900.00", inventoryItemId: p.itemId });
      expect((await t.sql`SELECT status::text FROM quotations WHERE id = ${q}`)[0]!.status).toBe("converted");
      expect(d.order.quotationRevisionId).toBeTruthy();
      // the order keeps the agreed prices even if the catalogue price changes afterwards
      await t.sql`UPDATE product_variants SET list_price = 9999 WHERE id = ${p.variantId}`;
      expect((await getOrder(sales, orderId)).items[0]!.unitPrice).toBe("1000.00");
      await expect(convertQuotationToOrder(sales, q, { locationId: showroom })).rejects.toMatchObject({ code: "INVALID_STATE" });
    });

    it("only one order can come from a quotation, even when two people convert at the same moment", async () => {
      const p = await stocked("5");
      const { q } = await acceptedQuotation([rm(p.variantId)]);
      const results = await Promise.allSettled([convertQuotationToOrder(sales, q, { locationId: showroom }), convertQuotationToOrder(manager, q, { locationId: showroom })]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await t.sql`SELECT count(*)::int AS n FROM sales_orders WHERE quotation_id = ${q}`)[0]!.n).toBe(1);
    });

    it("rejects quotations that are not accepted, that mix ready-made and custom, or lack a location / stock tracking", async () => {
      const p = await stocked("5");
      const cid = await customer();
      const draft = await createQuotation(sales, { customerId: cid, validUntil: "2099-01-01", deliveryCharge: "0", items: [rm(p.variantId)] } as never);
      await expect(convertQuotationToOrder(sales, draft, { locationId: showroom })).rejects.toMatchObject({ code: "INVALID_STATE" });
      const mixed = await acceptedQuotation([rm(p.variantId), { kind: "custom", description: "Bespoke shelf", quantity: "1", unitPrice: "500", discountAmount: "0" }]);
      await expect(convertQuotationToOrder(sales, mixed.q, { locationId: showroom })).rejects.toThrow(/mixes ready-made and custom/);
      const ready = await acceptedQuotation([rm(p.variantId)]);
      await expect(convertQuotationToOrder(sales, ready.q, {})).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { locationId: expect.any(Array) } });
      const u = await makeUntrackedProduct(t, `SKU-${++seq}`);
      const untracked = await acceptedQuotation([rm(u.variantId)]);
      await expect(convertQuotationToOrder(sales, untracked.q, { locationId: showroom })).rejects.toThrow(/stock tracking/i);
      await expect(convertQuotationToOrder(workshop, ready.q, { locationId: showroom })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("custom quotations become custom orders: no location, no stock reservation, confirm works, and a custom order must come from a quotation", async () => {
      const { q, cid } = await acceptedQuotation([{ kind: "custom", description: "Walnut wardrobe", dimensions: "240x60x230", quantity: "1", unitPrice: "320000", discountAmount: "0" }]);
      const orderId = await convertQuotationToOrder(sales, q, { requestedCompletionDate: "2099-03-01", depositTerms: "30% deposit" });
      const d = await getOrder(sales, orderId);
      expect(d.order).toMatchObject({ type: "custom", locationId: null, customerId: cid, requestedCompletionDate: "2099-03-01" });
      expect(d.items[0]!.specification).toEqual({ dimensions: "240x60x230" });
      await confirmOrder(sales, orderId);
      const held = await t.sql`SELECT r.id FROM stock_reservations r JOIN sales_order_items i ON i.id = r.order_item_id WHERE i.order_id = ${orderId}`;
      expect(held).toHaveLength(0); // custom orders never touch finished-goods stock
      expect((await t.sql`SELECT status::text FROM sales_orders WHERE id = ${orderId}`)[0]!.status).toBe("confirmed");
      await expect(t.sql`INSERT INTO sales_orders (reference, customer_id, type, currency) VALUES ('SO-X', ${cid}, 'custom', 'LKR')`).rejects.toThrow(/sales_orders_custom_needs_quotation/);
    });
  });

  describe("payments", () => {
    const confirmedOrder = async (total: string, actor = sales) => {
      const p = await stocked("50", total);
      const o = await draftOrder([rm(p.variantId, "1", total)], actor, await customer());
      await confirmOrder(actor, o);
      return o;
    };

    it("ACCEPTANCE #10: deposits and instalments reduce the balance in exact decimals", async () => {
      const o = await confirmedOrder("1000.00");
      await recordPayment(sales, { orderId: o, amount: "333.33", method: "cash" });
      await recordPayment(sales, { orderId: o, amount: "333.33", method: "bank_transfer", reference: "TRX-1" });
      await recordPayment(finance, { orderId: o, amount: "333.33", method: "card" });
      const d = await getOrder(owner, o);
      expect(d.money).toMatchObject({ paid: "999.99", outstanding: "0.01" });
      await recordPayment(sales, { orderId: o, amount: "0.01", method: "cash" });
      expect((await getOrder(owner, o)).money).toMatchObject({ paid: "1000.00", outstanding: "0.00" });
      await expect(recordPayment(sales, { orderId: o, amount: "0.01", method: "cash" })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { amount: expect.any(Array) } });
    });

    it("refuses payments that exceed the balance, are zero, or are on draft/cancelled orders", async () => {
      const o = await confirmedOrder("500.00");
      await expect(recordPayment(sales, { orderId: o, amount: "500.01", method: "cash" })).rejects.toThrow(/outstanding balance/);
      await expect(recordPayment(sales, { orderId: o, amount: "0", method: "cash" })).rejects.toMatchObject({ code: "VALIDATION" });
      const p = await stocked("5");
      const draft = await draftOrder([rm(p.variantId)]);
      await expect(recordPayment(sales, { orderId: draft, amount: "10", method: "cash" })).rejects.toMatchObject({ code: "INVALID_STATE" });
      await cancelOrder(sales, o, "cancelled");
      await expect(recordPayment(sales, { orderId: o, amount: "10", method: "cash" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    });

    it("two payments racing on the same order can never exceed the total", async () => {
      const o = await confirmedOrder("1000.00");
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => recordPayment(sales, { orderId: o, amount: "400.00", method: "cash" })));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2); // 400 + 400, third would reach 1200
      expect(await netPaid(t.db, o)).toBe("800.00");
    });

    it("voids add a linked negative entry; nothing is deleted; a void cannot be voided or repeated", async () => {
      const o = await confirmedOrder("1000.00");
      const pid = await recordPayment(sales, { orderId: o, amount: "400.00", method: "cash" });
      await expect(voidPayment(sales, pid, "mistake")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(voidPayment(finance, pid, "  ")).rejects.toMatchObject({ code: "VALIDATION" });
      const vid = await voidPayment(finance, pid, "Entered on the wrong order");
      const d = await getOrder(owner, o);
      expect(d.money).toMatchObject({ paid: "0.00", outstanding: "1000.00" });
      expect(d.money!.entries).toHaveLength(2);
      expect(d.money!.entries.find((e) => e.id === pid)!.voided).toBe(true);
      expect(d.money!.entries.find((e) => e.id === vid)).toMatchObject({ amount: "-400.00", voidsPaymentId: pid });
      await expect(voidPayment(finance, pid, "again")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(voidPayment(finance, vid, "void the void")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(t.sql`DELETE FROM payments WHERE id = ${pid}`).rejects.toThrow(/append-only/);
      await expect(t.sql`UPDATE payments SET amount = 1 WHERE id = ${pid}`).rejects.toThrow(/append-only/);
      await expect(t.sql`INSERT INTO payments (order_id, amount, method) VALUES (${o}, -5, 'cash')`).rejects.toThrow(/payments_sign/);
      const audit = (await t.db.select().from(auditLogs).where(eq(auditLogs.action, "payment.voided")))[0]!;
      expect(audit).toMatchObject({ reason: "Entered on the wrong order", actorId: finance.id });
      void payments;
    });

    it("cancelling an order that has received money needs a manager; refunds are recorded as voids", async () => {
      const o = await confirmedOrder("1000.00");
      const pid = await recordPayment(sales, { orderId: o, amount: "250.00", method: "cash" });
      await expect(cancelOrder(sales, o, "Customer left")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await cancelOrder(manager, o, "Customer left");
      await voidPayment(finance, pid, "Refunded in cash");
      expect((await getOrder(owner, o)).money).toMatchObject({ paid: "0.00" });
    });

    it("sales see payment figures only for orders they created; finance and managers see all; workshop none", async () => {
      const mine = await confirmedOrder("700.00", sales);
      await recordPayment(sales, { orderId: mine, amount: "100.00", method: "cash" });
      expect((await getOrder(sales, mine)).money).toMatchObject({ paid: "100.00" });
      expect((await getOrder(sales2, mine)).money).toBeNull();
      expect((await getOrder(finance, mine)).money).toMatchObject({ paid: "100.00" });
      expect((await getOrder(manager, mine)).money).toMatchObject({ paid: "100.00" });
      const row = (await listOrders(sales2, { page: 1, pageSize: 100 })).rows.find((r) => r.id === mine)!;
      expect(row.paid).toBeNull();
      expect((await listOrders(sales, { page: 1, pageSize: 100 })).rows.find((r) => r.id === mine)!.paid).toBe("100.00");
      await expect(getOrder(workshop, mine)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listOrders(workshop, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("finance can read orders and record payments but cannot create or confirm orders", async () => {
      const p = await stocked("3");
      await expect(createReadyMadeOrder(finance, { customerId, locationId: showroom, deliveryCharge: "0", items: [rm(p.variantId)] as never })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const o = await draftOrder([rm(p.variantId)]);
      await expect(confirmOrder(finance, o)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listOrders(finance, { page: 1, pageSize: 5 })).resolves.toBeTruthy();
    });

    it("lists orders that still owe money", async () => {
      const o = await confirmedOrder("900.00");
      await recordPayment(sales, { orderId: o, amount: "100.00", method: "cash" });
      const owing = await listOrders(owner, { withBalanceOnly: true, page: 1, pageSize: 200 });
      expect(owing.rows.find((r) => r.id === o)).toMatchObject({ outstanding: "800.00" });
      await recordPayment(sales, { orderId: o, amount: "800.00", method: "cash" });
      expect((await listOrders(owner, { withBalanceOnly: true, page: 1, pageSize: 200 })).rows.find((r) => r.id === o)).toBeUndefined();
    });
  });

  describe("stock reporting", () => {
    it("shows on-hand, reserved and available separately, flags low stock, and hides materials from sales", async () => {
      const p = await stocked("10");
      await confirmOrder(sales, await draftOrder([rm(p.variantId, "4")]));
      await setLowStockThreshold(manager, { itemId: p.itemId, locationId: showroom, threshold: "7" });
      const row = (await listStock(sales, { q: p.variantId ? "Product SKU-" : undefined, page: 1, pageSize: 500 })).rows.find((r) => r.id === p.itemId)!;
      expect(row.byLocation[showroom]).toMatchObject({ onHand: "10.000", reserved: "4.000", available: "6.000", low: true });
      expect((await lowStockAlerts(manager)).some((a) => a.id === p.itemId)).toBe(true);

      const timber = await createInventoryItem(manager, { kind: "raw_material", sku: `TIM-${++seq}`, name: "Oak board", unit: "m" });
      await recordManualMovement(manager, { itemId: timber, locationId: workshopLoc, kind: "opening", quantity: "3", reason: "Opening" });
      await setLowStockThreshold(manager, { itemId: timber, locationId: workshopLoc, threshold: "5" });
      expect((await listStock(sales, { page: 1, pageSize: 500 })).rows.some((r) => r.id === timber)).toBe(false);
      expect((await listStock(workshop, { page: 1, pageSize: 500 })).rows.some((r) => r.id === timber)).toBe(true);
      expect((await lowStockAlerts(sales)).some((a) => a.id === timber)).toBe(false);
      expect((await lowStockAlerts(workshop)).some((a) => a.id === timber)).toBe(true);
      await expect(getItemWithLedger(sales, timber)).rejects.toMatchObject({ code: "FORBIDDEN" });
      const led = await getItemWithLedger(workshop, timber);
      expect(led.movements[0]).toMatchObject({ type: "opening", reason: "Opening", byName: "Mia Manager" });
      await expect(setLowStockThreshold(sales, { itemId: timber, locationId: workshopLoc, threshold: "1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("locations are editable by managers only, with unique names", async () => {
      await expect(saveLocation(sales, { name: "Pop-up", kind: "showroom", isActive: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const id = await saveLocation(manager, { name: "Pop-up store", kind: "showroom", isActive: true });
      await expect(saveLocation(manager, { name: "Pop-up store", kind: "warehouse", isActive: true })).rejects.toMatchObject({ code: "CONFLICT" });
      await saveLocation(manager, { id, name: "Pop-up store", kind: "warehouse", isActive: false });
      expect((await t.sql`SELECT kind::text FROM locations WHERE id = ${id}`)[0]!.kind).toBe("warehouse");
    });

    it("the ledger still reconciles after everything above", async () => {
      expect(await reconcileInventory(t.db)).toEqual([]);
      const neg = await t.sql`SELECT 1 FROM inventory_balances WHERE on_hand < 0 OR reserved < 0 OR reserved > on_hand`;
      expect(neg).toHaveLength(0);
    });
  });
});
