import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/csv";
import { customerSchema } from "@/lib/schemas/crm";
import { addCaseNote, changeCaseStatus, createCase, getCase, listCases, updateCase } from "@/server/aftersales";
import { createCustomer } from "@/server/customers";
import { createDelivery, deliveryDefaults, getDelivery, listDeliveries, rescheduleDelivery, setDeliveryStatus, updateDelivery } from "@/server/deliveries";
import { createExpense, listExpenseCategories, listExpenses, saveExpenseCategory, voidExpense } from "@/server/expenses";
import { reconcileInventory, recordManualMovement } from "@/server/inventory";
import { cancelOrder, confirmOrder, createReadyMadeOrder, getOrder, recordPayment, voidPayment } from "@/server/orders";
import { createQuotation, decideQuotation, sendQuotation } from "@/server/quotations";
import { createPurchaseOrder, markPurchaseOrderSent, recordSupplierInvoice, recordSupplierPayment, saveSupplier } from "@/server/purchasing";
import { EXPORTS, exportCsv, getFinancialReport, getOperationsReport, getOwnerDashboard, getSalesReport, resolveRange } from "@/server/reports";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";
import { makeLocations, makeTrackedProduct } from "../helpers/stock";

const rm = (variantId: string, quantity = "1", unitPrice = "1000.00") => ({ kind: "ready_made" as const, variantId, description: "Line", quantity, unitPrice, discountAmount: "0.00" }) as never;
const TODAY = new Date().toISOString().slice(0, 10);

describe.skipIf(!hasTestDb)("deliveries, expenses, after-sales and reports (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, manager: Actor, sales: Actor, sales2: Actor, workshop: Actor, workshop2: Actor, finance: Actor;
  let showroom: string, workshopLoc: string, seq = 0;

  const customer = () => createCustomer(sales, customerSchema.parse({ name: `Cust ${++seq}`, phone: `07${String(30000000 + seq)}`, address: "12 Sample Road" }));
  const onHand = async (itemId: string, loc: string) => Number((await t.sql`SELECT on_hand::text AS oh FROM inventory_balances WHERE item_id = ${itemId} AND location_id = ${loc}`)[0]?.oh ?? 0);
  /** a confirmed ready-made order for `qty` units (stock 10 at the showroom) */
  const confirmed = async (qty = "2", actor: Actor = sales) => {
    const p = await makeTrackedProduct(t, manager, `D-${++seq}`, "1000.00");
    await recordManualMovement(manager, { itemId: p.itemId, locationId: showroom, kind: "opening", quantity: "10", reason: "Opening" });
    const cid = await customer();
    const orderId = await createReadyMadeOrder(actor, { customerId: cid, locationId: showroom, deliveryCharge: "500.00", items: [rm(p.variantId, qty)] });
    await confirmOrder(actor, orderId);
    return { orderId, ...p, cid };
  };
  const sched = async (orderId: string, extra: Partial<Parameters<typeof createDelivery>[1]> = {}) => {
    const d = await deliveryDefaults(manager, orderId);
    return createDelivery(manager, { orderId, scheduledOn: TODAY, addressLine: d.addressLine, contactName: d.contactName, contactPhone: d.contactPhone, ...extra });
  };

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    manager = await makeActor(t, ["manager"], "Mia Manager");
    sales = await makeActor(t, ["sales"], "Sam Sales");
    sales2 = await makeActor(t, ["sales"], "Sue Sales");
    workshop = await makeActor(t, ["workshop"], "Wes Workshop");
    workshop2 = await makeActor(t, ["workshop"], "Wanda Workshop");
    finance = await makeActor(t, ["finance"], "Fiona Finance");
    ({ showroom, workshop: workshopLoc } = await makeLocations(t));
  });
  afterAll(async () => {
    await t?.teardown();
  });

  describe("deliveries", () => {
    it("schedules only confirmed orders, one open delivery per order, with defaults from the customer", async () => {
      const draft = await createReadyMadeOrder(sales, { customerId: await customer(), locationId: showroom, deliveryCharge: "0", items: [rm((await makeTrackedProduct(t, manager, `D-${++seq}`)).variantId)] });
      await expect(createDelivery(manager, { orderId: draft, scheduledOn: TODAY, addressLine: "x", contactName: "x", contactPhone: "1" })).rejects.toMatchObject({ code: "INVALID_STATE" });
      const { orderId } = await confirmed();
      const defaults = await deliveryDefaults(sales, orderId);
      expect(defaults).toMatchObject({ addressLine: "12 Sample Road", fee: "500.00" });
      const id = await sched(orderId, { windowStart: "10:00", windowEnd: "12:00", assigneeId: workshop.id });
      await expect(sched(orderId)).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(sched(orderId, { windowStart: "12:00", windowEnd: "10:00" })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(createDelivery(workshop, { orderId, scheduledOn: TODAY, addressLine: "x", contactName: "x", contactPhone: "1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const d = await getDelivery(manager, id);
      expect(d.delivery).toMatchObject({ status: "planned", windowStart: "10:00:00", assigneeId: workshop.id });
      await updateDelivery(manager, id, { scheduledOn: TODAY, addressLine: "99 New Road", contactName: "A", contactPhone: "0771234567", assigneeId: workshop.id });
      expect((await getDelivery(manager, id)).delivery.addressLine).toBe("99 New Road");
    });

    it("assigned delivery staff update status; others cannot; delivered needs proof and delivers the order once", async () => {
      const { orderId, itemId } = await confirmed("3");
      const id = await sched(orderId, { assigneeId: workshop.id });
      await expect(setDeliveryStatus(workshop2, id, "out_for_delivery")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getDelivery(workshop2, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(setDeliveryStatus(finance, id, "out_for_delivery")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await listDeliveries(workshop2, { page: 1, pageSize: 50 })).rows.map((r) => r.id)).not.toContain(id);
      expect((await listDeliveries(workshop, { page: 1, pageSize: 50 })).rows.map((r) => r.id)).toContain(id);

      await setDeliveryStatus(workshop, id, "out_for_delivery");
      await expect(setDeliveryStatus(workshop, id, "delivered")).rejects.toMatchObject({ code: "VALIDATION" }); // no proof
      expect(await onHand(itemId, showroom)).toBe(10);

      await setDeliveryStatus(workshop, id, "delivered", { note: "Received by Mrs Perera" });
      expect(await onHand(itemId, showroom)).toBe(7); // reserved stock left exactly once
      expect((await getOrder(manager, orderId)).order).toMatchObject({ status: "delivered" });
      expect((await getDelivery(manager, id)).delivery).toMatchObject({ status: "delivered", proofNote: "Received by Mrs Perera" });
      await expect(setDeliveryStatus(workshop, id, "delivered", { note: "again" })).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(t.sql`UPDATE deliveries SET status = 'planned' WHERE id = ${id}`).rejects.toThrow(/cannot change status/);
      expect(await onHand(itemId, showroom)).toBe(7);
      expect(await reconcileInventory(t.db)).toEqual([]);
      const events = (await getDelivery(manager, id)).events.map((e) => e.to);
      expect(events).toEqual(["delivered", "out_for_delivery", "planned"]);
    });

    it("a failed attempt needs a reason, leaves the order undelivered, and is rescheduled as a new delivery", async () => {
      const { orderId } = await confirmed();
      const id = await sched(orderId, { assigneeId: workshop.id });
      await expect(setDeliveryStatus(workshop, id, "failed")).rejects.toMatchObject({ code: "VALIDATION" });
      await setDeliveryStatus(workshop, id, "failed", { note: "Nobody home" });
      expect((await getOrder(manager, orderId)).order.status).toBe("confirmed");
      await expect(rescheduleDelivery(manager, "00000000-0000-4000-8000-000000000001", { scheduledOn: TODAY })).rejects.toMatchObject({ code: "NOT_FOUND" });
      const next = await rescheduleDelivery(manager, id, { scheduledOn: TODAY, assigneeId: workshop.id });
      expect(next).not.toBe(id);
      expect((await getDelivery(manager, next)).delivery).toMatchObject({ status: "planned", rescheduledFromId: id });
      expect((await getDelivery(manager, id)).delivery.status).toBe("failed");
      await expect(rescheduleDelivery(manager, next, { scheduledOn: TODAY })).rejects.toMatchObject({ code: "INVALID_STATE" });
    });

    it("double-submitting 'delivered' deducts stock once; cancelled orders cannot be delivered", async () => {
      const { orderId, itemId } = await confirmed("2");
      const id = await sched(orderId, { assigneeId: workshop.id });
      const results = await Promise.allSettled([1, 2, 3].map(() => setDeliveryStatus(workshop, id, "delivered", { note: "ok" })));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await onHand(itemId, showroom)).toBe(8);
      const other = await confirmed();
      const did = await sched(other.orderId, { assigneeId: workshop.id });
      await cancelOrder(sales, other.orderId, "Customer cancelled");
      await expect(setDeliveryStatus(workshop, did, "delivered", { note: "x" })).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(sched(other.orderId)).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  describe("expenses", () => {
    it("records expenses with categories; sales and workshop cannot see them; finance can", async () => {
      const cats = await listExpenseCategories(finance);
      expect(cats.map((c) => c.name)).toContain("Transport and fuel");
      const cat = cats[0]!.id;
      const id = await createExpense(finance, { spentOn: TODAY, categoryId: cat, amount: "2500.50", description: "Fuel for delivery van", method: "cash" });
      await expect(createExpense(sales, { spentOn: TODAY, categoryId: cat, amount: "1", description: "x", method: "cash" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listExpenses(workshop, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listExpenses(sales, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(createExpense(finance, { spentOn: TODAY, categoryId: cat, amount: "0", description: "x", method: "cash" })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(createExpense(finance, { spentOn: TODAY, categoryId: "00000000-0000-4000-8000-000000000001", amount: "5", description: "x", method: "cash" })).rejects.toMatchObject({ code: "VALIDATION" });
      const list = await listExpenses(finance, { page: 1, pageSize: 50 });
      expect(list.rows.find((r) => r.id === id)).toMatchObject({ amount: "2500.50", description: "Fuel for delivery van" });
    });

    it("are never edited or deleted; voiding keeps the row, needs a reason and leaves totals", async () => {
      const cat = (await listExpenseCategories(finance))[0]!.id;
      const before = (await listExpenses(finance, { page: 1, pageSize: 50 })).totalAmount;
      const id = await createExpense(finance, { spentOn: TODAY, categoryId: cat, amount: "100.00", description: "Mistake", method: "cash" });
      expect(dec2((await listExpenses(finance, { page: 1, pageSize: 50 })).totalAmount) - dec2(before)).toBe(100);
      await expect(t.sql`UPDATE expenses SET amount = 1 WHERE id = ${id}`).rejects.toThrow(/only be voided/);
      await expect(t.sql`DELETE FROM expenses WHERE id = ${id}`).rejects.toThrow(/cannot be deleted/);
      await expect(voidExpense(finance, id, "  ")).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(voidExpense(workshop, id, "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await voidExpense(finance, id, "Entered twice");
      await expect(voidExpense(finance, id, "again")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(t.sql`UPDATE expenses SET voided_at = NULL WHERE id = ${id}`).rejects.toThrow(/voided expense cannot be changed/);
      expect((await listExpenses(finance, { page: 1, pageSize: 50 })).totalAmount).toBe(before);
      expect((await listExpenses(finance, { page: 1, pageSize: 50, includeVoided: true })).rows.find((r) => r.id === id)).toMatchObject({ voidReason: "Entered twice" });
    });

    it("only managers manage categories; duplicates are refused", async () => {
      await expect(saveExpenseCategory(finance, { name: "Sneaky", isActive: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await saveExpenseCategory(manager, { name: "Packaging", isActive: true });
      await expect(saveExpenseCategory(manager, { name: "Packaging", isActive: true })).rejects.toMatchObject({ code: "CONFLICT" });
    });
  });

  describe("after-sales", () => {
    it("moves through its states; resolving needs a resolution; closed is final", async () => {
      const cid = await customer();
      const orderOther = (await confirmed()).orderId; // belongs to a different customer
      await expect(createCase(sales, { customerId: cid, orderId: orderOther, type: "repair", subject: "Scratch" })).rejects.toMatchObject({ code: "VALIDATION" });
      const id = await createCase(sales, { customerId: cid, type: "warranty", subject: "Loose leg", description: "Reported by phone", assigneeId: workshop.id });
      expect((await getCase(workshop, id)).case.reference).toMatch(/^CASE-\d{6}$/);
      await expect(addCaseNote(workshop, id, "x")).rejects.toMatchObject({ code: "FORBIDDEN" }); // view only
      await expect(changeCaseStatus(finance, id, "in_progress")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await changeCaseStatus(sales, id, "in_progress", { note: "Booked for collection" });
      await expect(changeCaseStatus(sales, id, "closed")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(changeCaseStatus(sales, id, "resolved")).rejects.toMatchObject({ code: "VALIDATION" });
      await changeCaseStatus(sales, id, "resolved", { resolution: "Leg re-glued and returned" });
      await changeCaseStatus(sales, id, "closed");
      await expect(changeCaseStatus(sales, id, "open")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(addCaseNote(sales, id, "late note")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(updateCase(sales, id, { subject: "x" })).rejects.toMatchObject({ code: "INVALID_STATE" });
      const d = await getCase(manager, id);
      expect(d.case).toMatchObject({ status: "closed", resolution: "Leg re-glued and returned" });
      expect(d.notes.map((n) => n.to)).toEqual(["closed", "resolved", "in_progress", "open"]);
      await expect(t.sql`UPDATE after_sales_notes SET body = 'x'`).rejects.toThrow(/append-only/);
      expect((await listCases(manager, { status: "active", page: 1, pageSize: 50 })).rows.map((r) => r.id)).not.toContain(id);
    });
  });

  describe("reports", () => {
    it("sales report: counts what it defines, nets reversals, never counts unaccepted quotations", async () => {
      const range = await resolveRange(TODAY, TODAY);
      const before = await getSalesReport(manager, range);
      const a = await confirmed("1"); // 1000 + 500 delivery = 1500
      const b = await confirmed("2"); // 2000 + 500 = 2500
      const cancelled = await confirmed("1");
      await cancelOrder(sales, cancelled.orderId, "Changed mind");
      const pay = await recordPayment(sales, { orderId: a.orderId, amount: "1500.00", method: "cash" });
      await recordPayment(sales, { orderId: b.orderId, amount: "1000.00", method: "bank_transfer" });
      await voidPayment(finance, pay, "Entered on wrong order");

      // quotations: one accepted, one only sent
      const mkQuote = async () => {
        const cid = await customer();
        const q = await createQuotation(sales, { customerId: cid, validUntil: "2099-01-01", deliveryCharge: "0", items: [{ kind: "custom", description: "Table", quantity: "1", unitPrice: "70000.00", discountAmount: "0.00" }] } as never);
        await sendQuotation(sales, q);
        return q;
      };
      const accepted = await mkQuote();
      await decideQuotation(sales, accepted, "accepted");
      await mkQuote(); // sent, not accepted

      const r = await getSalesReport(manager, range);
      expect(r.confirmed.count - before.confirmed.count).toBe(2);
      expect(Number(r.confirmed.value) - Number(before.confirmed.value)).toBe(4000);
      expect(Number(r.cashReceived) - Number(before.cashReceived)).toBe(1000); // 1500 − 1500 void + 1000
      expect(r.quotations.accepted - before.quotations.accepted).toBe(1);
      expect(Number(r.quotations.acceptedValue) - Number(before.quotations.acceptedValue)).toBe(70000);
      expect(r.quotations.sent - before.quotations.sent).toBe(2);
      expect(Number(r.outstanding!.value) - Number(before.outstanding!.value)).toBe(1500 + 1500); // a: 1500 owing again; b: 1500 owing
      expect(r.definitions.join(" ")).toMatch(/not accepted are never counted/);
    });

    it("sales staff see only their own orders; workshop gets no sales or financial report", async () => {
      const range = await resolveRange(TODAY, TODAY);
      const mine = await confirmed("1", sales2);
      await recordPayment(sales2, { orderId: mine.orderId, amount: "700.00", method: "cash" });
      const r2 = await getSalesReport(sales2, range);
      expect(r2.confirmed.count).toBe(1);
      expect(r2.cashReceived).toBe("700.00");
      await expect(getSalesReport(workshop, range)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getFinancialReport(workshop, range)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getFinancialReport(sales, range)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getOwnerDashboard(finance, range)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("financial report: operational net cash = received − expenses − supplier payments, with owed amounts", async () => {
      const range = await resolveRange(TODAY, TODAY);
      const before = await getFinancialReport(finance, range);
      const o = await confirmed("1");
      await recordPayment(finance, { orderId: o.orderId, amount: "1500.00", method: "cash" });
      const cat = (await listExpenseCategories(finance))[0]!.id;
      await createExpense(finance, { spentOn: TODAY, categoryId: cat, amount: "300.00", description: "Report test", method: "cash" });
      const voided = await createExpense(finance, { spentOn: TODAY, categoryId: cat, amount: "9999.00", description: "Voided, not counted", method: "cash" });
      await voidExpense(finance, voided, "Duplicate");
      const supplier = await saveSupplier(manager, { name: `Sup ${++seq}` });
      const item = (await makeTrackedProduct(t, manager, `D-${++seq}`)).itemId;
      const po = await createPurchaseOrder(manager, { supplierId: supplier, locationId: workshopLoc, items: [{ itemId: item, quantity: "10", expectedUnitCost: "100.00" }] });
      await markPurchaseOrderSent(manager, po);
      await recordSupplierInvoice(finance, po, { amount: "1000.00", ref: "S-1" });
      await recordSupplierPayment(finance, po, { amount: "400.00", method: "bank_transfer" });
      const r = await getFinancialReport(finance, range);
      expect(Number(r.cashReceived) - Number(before.cashReceived)).toBe(1500);
      expect(Number(r.expenses) - Number(before.expenses)).toBe(300);
      expect(Number(r.supplierPayments) - Number(before.supplierPayments)).toBe(400);
      expect(Number(r.netCashMovement) - Number(before.netCashMovement)).toBe(1500 - 300 - 400);
      expect(Number(r.owedToSuppliers.value) - Number(before.owedToSuppliers.value)).toBe(600);
      expect(r.definitions.join(" ")).toMatch(/not profit/);
    });

    it("operations report: jobs, deliveries, stock value at cost leaves out uncosted items", async () => {
      const range = await resolveRange(TODAY, TODAY);
      const r = await getOperationsReport(manager, range);
      expect(r.stock).not.toBeNull();
      expect(r.stock!.valueAtCost).not.toBeNull();
      expect(r.deliveries.delivered).toBeGreaterThanOrEqual(2);
      const w = await getOperationsReport(workshop, range);
      expect(w.stock!.valueAtCost).toBeNull(); // no cost visibility for the workshop
      expect(w.afterSales).not.toBeNull();
      await expect(getOperationsReport(sales, range)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("owner dashboard brings the sections together for owner and manager only", async () => {
      const range = await resolveRange(TODAY, TODAY);
      const d = await getOwnerDashboard(owner, range);
      expect(d.sales.confirmed.count).toBeGreaterThan(0);
      expect(typeof d.fin.netCashMovement).toBe("string");
      await expect(getOwnerDashboard(sales, range)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("range handling: swapped dates are ordered, junk falls back, huge ranges refused", async () => {
      const r = await resolveRange("2026-03-31", "2026-03-01");
      expect([r.from, r.to]).toEqual(["2026-03-01", "2026-03-31"]);
      expect((await resolveRange("junk", "also junk")).from <= (await resolveRange()).to).toBe(true);
      await expect(resolveRange("1990-01-01", "2026-01-01")).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  describe("CSV exports", () => {
    it("neutralises spreadsheet formulas and quotes properly", () => {
      const csv = toCsv(["a", "b"], [['=HYPERLINK("http://evil")', "plain, with comma"], ["+1+1", 'say "hi"'], ["@SUM(A1)", "-5"]]);
      expect(csv).toContain(`'=HYPERLINK(""http://evil"")`);
      expect(csv).toContain(`"plain, with comma"`);
      expect(csv).toContain(`'+1+1`);
      expect(csv).toContain(`'@SUM(A1)`);
      expect(csv).toContain(`"say ""hi"""`);
      expect(csv.startsWith("﻿")).toBe(true);
    });

    it("exports respect permissions and exclude what the person may not see", async () => {
      const range = await resolveRange(TODAY, TODAY);
      for (const kind of EXPORTS) {
        const allowed = kind === "payments" ? finance : kind === "expenses" ? finance : manager;
        const out = await exportCsv(allowed, kind, range);
        expect(out.filename).toContain(kind);
        expect(out.csv.split("\r\n")[0]).toBeTruthy();
      }
      await expect(exportCsv(sales, "payments", range)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(exportCsv(sales, "expenses", range)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(exportCsv(workshop, "orders", range)).rejects.toMatchObject({ code: "FORBIDDEN" });
      const stockForWorkshop = await exportCsv(workshop, "stock", range);
      expect(stockForWorkshop.csv.split("\r\n")[0]).not.toContain("Standard cost");
      const stockForManager = await exportCsv(manager, "stock", range);
      expect(stockForManager.csv.split("\r\n")[0]).toContain("Standard cost");
      const orders = await exportCsv(sales2, "orders", range);
      expect(orders.csv.split("\r\n").filter(Boolean).length).toBe(2); // header + own single order
    });
  });
});

const dec2 = (s: string) => Number(s);
