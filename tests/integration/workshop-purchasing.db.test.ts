import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { auditLogs, productionJobs } from "@/lib/db/schema";
import { customerSchema } from "@/lib/schemas/crm";
import { createCustomer } from "@/server/customers";
import { canViewFile } from "@/server/files";
import { createInventoryItem, reconcileInventory, recordManualMovement } from "@/server/inventory";
import { advanceOrder, cancelOrder, confirmOrder, convertQuotationToOrder, getOrder } from "@/server/orders";
import {
  addIssue,
  changeStage,
  getJob,
  getJobCosting,
  getJobStatusForOrder,
  listBoard,
  listJobs,
  planMaterial,
  recordConsumption,
  recordLabour,
  setAssignees,
} from "@/server/production";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  markPurchaseOrderSent,
  receiveGoods,
  recordSupplierInvoice,
  recordSupplierPayment,
  saveSupplier,
  updateDraftPurchaseOrder,
} from "@/server/purchasing";
import { createQuotation, decideQuotation, sendQuotation } from "@/server/quotations";
import { updateProductionSettings } from "@/server/settings";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";
import { listProductsAdmin } from "@/server/catalogue";
import { listCustomers } from "@/server/customers";
import { makeLocations, makeTrackedProduct } from "../helpers/stock";

const K1 = "11111111-1111-4111-8111-111111111111";
const KB = "22222222-2222-4222-8222-222222222222";
const KS = "33333333-3333-4333-8333-333333333333";
const custom = (description = "Walnut dining table, 8 seats", unitPrice = "250000.00") => ({ kind: "custom" as const, description, quantity: "1", unitPrice, discountAmount: "0.00" });

describe.skipIf(!hasTestDb)("workshop and purchasing (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, manager: Actor, sales: Actor, workshop: Actor, workshop2: Actor, finance: Actor;
  let workshopLoc: string, seq = 0;

  const onHand = async (itemId: string, locationId: string) => {
    const [r] = await t.sql`SELECT on_hand::text AS oh FROM inventory_balances WHERE item_id = ${itemId} AND location_id = ${locationId}`;
    return r ? Number(r.oh) : 0;
  };
  const material = async (cost?: string) => {
    const id = await createInventoryItem(manager, { kind: "raw_material", sku: `MAT-${++seq}`, name: `Material ${seq}`, unit: "m", costPrice: cost });
    return id;
  };
  /** accepted custom quotation → draft order → confirmed order. Returns order and job ids. */
  const confirmedCustomOrder = async (description?: string) => {
    const cid = await createCustomer(sales, customerSchema.parse({ name: `Cust ${++seq}`, phone: `07${String(20000000 + seq)}` }));
    const q = await createQuotation(sales, { customerId: cid, validUntil: "2099-01-01", deliveryCharge: "0", items: [custom(description)] } as never);
    await sendQuotation(sales, q);
    await decideQuotation(sales, q, "accepted");
    const orderId = await convertQuotationToOrder(sales, q, { requestedCompletionDate: "2099-03-01" } as never);
    await confirmOrder(sales, orderId);
    const [job] = await t.db.select().from(productionJobs).where(eq(productionJobs.orderId, orderId));
    return { orderId, jobId: job!.id, job: job!, cid };
  };

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    manager = await makeActor(t, ["manager"], "Mia Manager");
    sales = await makeActor(t, ["sales"], "Sam Sales");
    workshop = await makeActor(t, ["workshop"], "Wes Workshop");
    workshop2 = await makeActor(t, ["workshop"], "Wanda Workshop");
    finance = await makeActor(t, ["finance"], "Fiona Finance");
    ({ workshop: workshopLoc } = await makeLocations(t));
  });
  afterAll(async () => {
    await t?.teardown();
  });

  describe("list counts bind to the right row (regression: unqualified correlated sub-selects)", () => {
    it("customer quotation counts and product SKU lists are per-row", async () => {
      const { cid } = await confirmedCustomOrder("Counting");
      const c = (await listCustomers(manager, { q: undefined, page: 1, pageSize: 200 })).rows.find((r) => r.id === cid)!;
      expect(c.quotationCount).toBe(1);
      const p = await makeTrackedProduct(t, manager, `CNT-${++seq}`);
      const row = (await listProductsAdmin(manager, { page: 1, pageSize: 200 } as never)).rows.find((r) => r.id === p.productId)!;
      expect(row.skus).toContain("CNT-");
    });
  });

  describe("ACCEPTANCE #5: confirming a custom order creates a job with its specification and reference files", () => {
    it("creates exactly one job, copies the specification, and records the first stage", async () => {
      const { orderId, job } = await confirmedCustomOrder("Oak bookshelf, 2.4m wide");
      expect(job).toMatchObject({ orderId, stage: "awaiting_materials", priority: "normal", targetDate: "2099-03-01", description: "Oak bookshelf, 2.4m wide" });
      expect(job.reference).toMatch(/^JOB-\d{6}$/);
      expect(job.specification).toEqual([expect.objectContaining({ description: "Oak bookshelf, 2.4m wide" })]);
      expect(job.outputItemId).toBeNull(); // finished-goods workflow is OFF by default
      const d = await getJob(manager, job.id);
      expect(d.history).toHaveLength(1);
      expect((await t.sql`SELECT count(*)::int AS n FROM production_jobs WHERE order_id = ${orderId}`)[0]!.n).toBe(1);
      // a second job for the same order is impossible
      await expect(t.sql`INSERT INTO production_jobs (reference, order_id, customer_id, description, specification) VALUES ('JOB-X', ${orderId}, ${job.customerId}, 'dup', '[]')`).rejects.toThrow();
      // confirming twice does not create a second job
      await expect(confirmOrder(sales, orderId)).rejects.toMatchObject({ code: "INVALID_STATE" });
    });

    it("copies reference files attached to the quotation", async () => {
      const cid = await createCustomer(sales, customerSchema.parse({ name: `Cust ${++seq}`, phone: `07${String(20000000 + seq)}` }));
      const q = await createQuotation(sales, { customerId: cid, validUntil: "2099-01-01", deliveryCharge: "0", items: [custom()] } as never);
      const [f] = await t.sql`INSERT INTO uploaded_files (bucket, object_key, original_name, content_type, size_bytes, status, entity_type, entity_id, uploaded_by, visibility)
        VALUES ('private', ${`k-${seq}.png`}, 'sketch.png', 'image/png', 10, 'linked', 'quotation', ${q}, ${sales.id}, 'private') RETURNING id`;
      await sendQuotation(sales, q);
      await decideQuotation(sales, q, "accepted");
      const orderId = await convertQuotationToOrder(sales, q, {} as never);
      await confirmOrder(sales, orderId);
      const [job] = await t.db.select().from(productionJobs).where(eq(productionJobs.orderId, orderId));
      const d = await getJob(manager, job!.id);
      expect(d.files.map((x) => x.id)).toEqual([f!.id]);
    });
  });

  describe("ACCEPTANCE #6: workshop staff update only their own jobs and cannot see finance", () => {
    it("scopes the list, the board and the detail page to assigned jobs", async () => {
      const a = await confirmedCustomOrder("Job A");
      const b = await confirmedCustomOrder("Job B");
      await setAssignees(manager, a.jobId, [workshop.id]);
      await setAssignees(manager, b.jobId, [workshop2.id]);

      const mine = await listJobs(workshop, { page: 1, pageSize: 100 });
      expect(mine.rows.map((r) => r.id)).toContain(a.jobId);
      await addIssue(workshop, a.jobId, "issue", "Blade is blunt");
      const row = (await listJobs(manager, { page: 1, pageSize: 100 })).rows.find((r) => r.id === a.jobId)!;
      expect(row).toMatchObject({ assignees: "Wes Workshop", openIssues: 1 }); // correlated sub-selects bind to the right job
      expect((await listBoard(manager)).rows.find((r) => r.id === a.jobId)).toMatchObject({ assignees: "Wes Workshop", openIssues: 1 });
      expect(mine.rows.map((r) => r.id)).not.toContain(b.jobId);
      expect((await listBoard(workshop)).rows.map((r) => r.id)).not.toContain(b.jobId);

      await expect(getJob(workshop, b.jobId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(changeStage(workshop, b.jobId, "ready_to_start")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(addIssue(workshop, b.jobId, "delay", "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await changeStage(workshop, a.jobId, "ready_to_start");
      expect((await getJob(manager, a.jobId)).job.stage).toBe("ready_to_start");
    });

    it("hides customer, price and cost information from the workshop", async () => {
      const a = await confirmedCustomOrder("Hidden prices");
      await setAssignees(manager, a.jobId, [workshop.id]);
      const m = await material("120.00");
      await planMaterial(manager, a.jobId, { itemId: m, plannedQuantity: "5" });
      const asWorkshop = await getJob(workshop, a.jobId);
      expect(asWorkshop.customerName).toBeNull();
      expect(asWorkshop.orderTotal).toBeNull();
      expect(asWorkshop.plan[0]!.unitCost).toBeNull();
      expect(JSON.stringify(asWorkshop)).not.toContain("250000");
      const asManager = await getJob(manager, a.jobId);
      expect(asManager.orderTotal).toMatchObject({ amount: "250000.00" });
      expect(asManager.plan[0]!.unitCost).toBe("120.00");
      await expect(getJobCosting(workshop, a.jobId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getJobCosting(sales, a.jobId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      // the workshop cannot see the order either
      await expect(getOrder(workshop, a.orderId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("sales may see only the stage of a job; finance may not open jobs", async () => {
      const a = await confirmedCustomOrder("Status only");
      expect(await getJobStatusForOrder(sales, a.orderId)).toMatchObject({ stage: "awaiting_materials", linkable: false });
      await expect(getJob(sales, a.jobId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getJob(finance, a.jobId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(changeStage(sales, a.jobId, "ready_to_start")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await getJobStatusForOrder(finance, a.orderId)).toBeNull();
    });

    it("customer files are viewable by the workshop only on assigned jobs", async () => {
      const a = await confirmedCustomOrder("Files");
      const other = await confirmedCustomOrder("Other files");
      await setAssignees(manager, a.jobId, [workshop.id]);
      const mk = async (jobId: string, key: string) => {
        const [f] = await t.sql`INSERT INTO uploaded_files (bucket, object_key, original_name, content_type, size_bytes, status, entity_type, entity_id, visibility)
          VALUES ('private', ${key}, 'ref.png', 'image/png', 5, 'linked', 'lead', gen_random_uuid(), 'private') RETURNING id`;
        await t.sql`INSERT INTO production_job_files (job_id, file_id) VALUES (${jobId}, ${f!.id})`;
        return { id: f!.id as string, entityType: "lead", uploadedBy: null };
      };
      const mine = await mk(a.jobId, `k-a-${seq}`);
      const theirs = await mk(other.jobId, `k-b-${seq}`);
      expect(await canViewFile(workshop, mine, t.db)).toBe(true);
      expect(await canViewFile(workshop, theirs, t.db)).toBe(false);
      expect(await canViewFile(workshop2, mine, t.db)).toBe(false);
      expect(await canViewFile(sales, theirs, t.db)).toBe(true);
      expect(await canViewFile(finance, mine, t.db)).toBe(false);
    });

    it("stage rules: rework needs a note, quality check comes before ready, hold needs a reason", async () => {
      const a = await confirmedCustomOrder("Stages");
      await setAssignees(manager, a.jobId, [workshop.id]);
      await changeStage(workshop, a.jobId, "assembly");
      await expect(changeStage(workshop, a.jobId, "cutting_preparation")).rejects.toMatchObject({ code: "VALIDATION" });
      await changeStage(workshop, a.jobId, "cutting_preparation", "Joint failed");
      await expect(changeStage(workshop, a.jobId, "ready_for_delivery")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(changeStage(workshop, a.jobId, "on_hold")).rejects.toMatchObject({ code: "VALIDATION" });
      await changeStage(workshop, a.jobId, "on_hold", "Waiting for varnish");
      await changeStage(workshop, a.jobId, "cutting_preparation"); // resumes where it was
      await changeStage(workshop, a.jobId, "quality_check");
      await changeStage(workshop, a.jobId, "ready_for_delivery");
      expect((await getJob(manager, a.jobId)).job.completedAt).not.toBeNull();
      // a finished job is only reopened by a manager
      await expect(changeStage(workshop, a.jobId, "assembly", "Customer asked for a change")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await changeStage(manager, a.jobId, "assembly", "Customer asked for a change");
      const history = (await getJob(manager, a.jobId)).history.map((h) => h.to);
      expect(history).toContain("on_hold");
      expect(history.at(0)).toBe("assembly");
    });
  });

  describe("ACCEPTANCE #7: partial goods receipts increase stock only by the quantity received", () => {
    let supplier: string;
    beforeAll(async () => {
      supplier = await saveSupplier(manager, { name: "Timber Traders (test)", suppliedMaterials: "Hardwood" });
    });

    it("receives in two parts; stock follows the received quantity and the status follows the totals", async () => {
      const m1 = await material();
      const m2 = await material();
      const po = await createPurchaseOrder(manager, { supplierId: supplier, locationId: workshopLoc, items: [{ itemId: m1, quantity: "100", expectedUnitCost: "50.00" }, { itemId: m2, quantity: "20", expectedUnitCost: "10.00" }] });
      await expect(receiveGoods(manager, po, { lines: [] })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(receiveGoods(manager, po, { lines: [{ purchaseOrderItemId: "00000000-0000-4000-8000-000000000001", quantity: "1" }] })).rejects.toMatchObject({ code: "INVALID_STATE" }); // still a draft
      await markPurchaseOrderSent(manager, po);

      const lines = (await getPurchaseOrder(manager, po)).lines;
      const l1 = lines.find((l) => l.itemId === m1)!;
      const l2 = lines.find((l) => l.itemId === m2)!;

      await receiveGoods(workshop, po, { lines: [{ purchaseOrderItemId: l1.id, quantity: "60" }] });
      expect(await onHand(m1, workshopLoc)).toBe(60); // not the 100 ordered
      expect(await onHand(m2, workshopLoc)).toBe(0);
      expect((await getPurchaseOrder(manager, po)).status).toBe("partially_received");

      await expect(receiveGoods(workshop, po, { lines: [{ purchaseOrderItemId: l1.id, quantity: "41" }] })).rejects.toMatchObject({ code: "VALIDATION" }); // 40 remain
      expect(await onHand(m1, workshopLoc)).toBe(60);

      await receiveGoods(workshop, po, { lines: [{ purchaseOrderItemId: l1.id, quantity: "40" }, { purchaseOrderItemId: l2.id, quantity: "20" }] });
      expect(await onHand(m1, workshopLoc)).toBe(100);
      expect(await onHand(m2, workshopLoc)).toBe(20);
      const done = await getPurchaseOrder(manager, po);
      expect(done.status).toBe("received");
      expect(done.receipts).toHaveLength(2);
      await expect(receiveGoods(workshop, po, { lines: [{ purchaseOrderItemId: l1.id, quantity: "1" }] })).rejects.toMatchObject({ code: "INVALID_STATE" });
      expect(await reconcileInventory(t.db)).toEqual([]);
    });

    it("simultaneous receipts can never exceed the ordered quantity", async () => {
      const m = await material();
      const po = await createPurchaseOrder(manager, { supplierId: supplier, locationId: workshopLoc, items: [{ itemId: m, quantity: "10", expectedUnitCost: "1.00" }] });
      await markPurchaseOrderSent(manager, po);
      const lineId = (await getPurchaseOrder(manager, po)).lines[0]!.id;
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => receiveGoods(workshop, po, { lines: [{ purchaseOrderItemId: lineId, quantity: "4" }] })));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2); // 4 + 4 = 8; a third 4 would exceed 10
      expect(await onHand(m, workshopLoc)).toBe(8);
    });

    it("lines are fixed once sent; cancel needs a reason and is refused after receipt", async () => {
      const m = await material();
      const items = [{ itemId: m, quantity: "5", expectedUnitCost: "2.00" }];
      const po = await createPurchaseOrder(manager, { supplierId: supplier, locationId: workshopLoc, items });
      await updateDraftPurchaseOrder(manager, po, { supplierId: supplier, locationId: workshopLoc, items: [{ itemId: m, quantity: "6", expectedUnitCost: "2.00" }] });
      await markPurchaseOrderSent(manager, po);
      await expect(updateDraftPurchaseOrder(manager, po, { supplierId: supplier, locationId: workshopLoc, items })).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(t.sql`UPDATE purchase_order_items SET quantity_ordered = 99 WHERE purchase_order_id = ${po}`).rejects.toThrow(/cannot be changed/);
      await expect(cancelPurchaseOrder(manager, po, "  ")).rejects.toMatchObject({ code: "VALIDATION" });
      const lineId = (await getPurchaseOrder(manager, po)).lines[0]!.id;
      await receiveGoods(manager, po, { lines: [{ purchaseOrderItemId: lineId, quantity: "1" }] });
      await expect(cancelPurchaseOrder(manager, po, "changed mind")).rejects.toMatchObject({ code: "INVALID_STATE" });
      const po2 = await createPurchaseOrder(manager, { supplierId: supplier, locationId: workshopLoc, items });
      await cancelPurchaseOrder(manager, po2, "Supplier closed");
      expect((await getPurchaseOrder(manager, po2)).status).toBe("cancelled");
    });

    it("permissions: sales cannot touch purchasing; the workshop can receive but not order, pay or see costs", async () => {
      const m = await material();
      const input = { supplierId: supplier, locationId: workshopLoc, items: [{ itemId: m, quantity: "5", expectedUnitCost: "2.00" }] };
      await expect(createPurchaseOrder(sales, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(createPurchaseOrder(workshop, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listPurchaseOrders(sales)).rejects.toMatchObject({ code: "FORBIDDEN" });
      const po = await createPurchaseOrder(manager, input);
      await markPurchaseOrderSent(manager, po);
      await expect(recordSupplierPayment(workshop, po, { amount: "1", method: "cash" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(receiveGoods(sales, po, { lines: [{ purchaseOrderItemId: (await getPurchaseOrder(manager, po)).lines[0]!.id, quantity: "1" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const seen = await getPurchaseOrder(workshop, po);
      expect(seen.orderValue).toBeNull();
      expect(seen.lines[0]!.expectedUnitCost).toBeNull();
      expect((await listPurchaseOrders(workshop)).rows.every((r) => r.orderValue === null)).toBe(true);
      expect((await getPurchaseOrder(finance, po)).orderValue).toBe("10.00");
    });

    it("supplier invoice and payments: capped, append-only, status derived", async () => {
      const m = await material();
      const po = await createPurchaseOrder(manager, { supplierId: supplier, locationId: workshopLoc, items: [{ itemId: m, quantity: "10", expectedUnitCost: "100.00" }] });
      await expect(recordSupplierPayment(finance, po, { amount: "10", method: "bank_transfer" })).rejects.toMatchObject({ code: "INVALID_STATE" }); // draft
      await markPurchaseOrderSent(manager, po);
      await expect(recordSupplierPayment(finance, po, { amount: "1000.01", method: "bank_transfer" })).rejects.toMatchObject({ code: "VALIDATION" }); // order value 1000
      await recordSupplierInvoice(finance, po, { ref: "INV-77", amount: "900.00" });
      await recordSupplierPayment(finance, po, { amount: "400.00", method: "bank_transfer", reference: "TT1" });
      expect((await getPurchaseOrder(finance, po)).paymentStatus).toBe("part_paid");
      await expect(recordSupplierPayment(finance, po, { amount: "500.01", method: "cash" })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(recordSupplierInvoice(finance, po, { amount: "300.00" })).rejects.toMatchObject({ code: "VALIDATION" }); // below what is paid
      await recordSupplierPayment(finance, po, { amount: "500.00", method: "cash" });
      const d = await getPurchaseOrder(finance, po);
      expect(d).toMatchObject({ paid: "900.00", paymentStatus: "paid", supplierInvoiceRef: "INV-77" });
      await expect(t.sql`UPDATE supplier_payments SET amount = 1 WHERE purchase_order_id = ${po}`).rejects.toThrow(/append-only/);
      await expect(t.sql`DELETE FROM supplier_payments WHERE purchase_order_id = ${po}`).rejects.toThrow(/append-only/);
      const audits = await t.db.select().from(auditLogs).where(eq(auditLogs.action, "supplier_payment.recorded"));
      expect(audits.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("ACCEPTANCE #8: material consumption decreases stock once, linked to the job", () => {
    it("deducts used and wasted quantities, links them to the job, and is idempotent per request", async () => {
      const { jobId, job } = await confirmedCustomOrder("Consumption");
      await setAssignees(manager, jobId, [workshop.id]);
      const m = await material("200.00");
      await recordManualMovement(manager, { itemId: m, locationId: workshopLoc, kind: "opening", quantity: "30", reason: "Opening" });

      const first = await recordConsumption(workshop, { jobId, itemId: m, locationId: workshopLoc, quantity: "8", wasteQuantity: "1", requestKey: K1 });
      expect(first.duplicate).toBe(false);
      expect(await onHand(m, workshopLoc)).toBe(21);

      const again = await recordConsumption(workshop, { jobId, itemId: m, locationId: workshopLoc, quantity: "8", wasteQuantity: "1", requestKey: K1 });
      expect(again).toEqual({ id: first.id, duplicate: true });
      expect(await onHand(m, workshopLoc)).toBe(21);

      // double-click: five identical submissions at once still deduct once
      const burst = await Promise.all(Array.from({ length: 5 }, () => recordConsumption(workshop, { jobId, itemId: m, locationId: workshopLoc, quantity: "2", requestKey: KB })));
      expect(new Set(burst.map((b) => b.id)).size).toBe(1);
      expect(burst.filter((b) => !b.duplicate)).toHaveLength(1);
      expect(await onHand(m, workshopLoc)).toBe(19);

      const moves = await t.sql`SELECT type::text AS type, on_hand_delta::text AS d, ref_type, ref_id FROM inventory_movements WHERE item_id = ${m} AND ref_id = ${job.id} ORDER BY created_at`;
      expect(moves.map((x) => `${x.type}:${Number(x.d)}`).sort()).toEqual(["production_consume:-2", "production_consume:-8", "waste:-1"]);
      expect(moves.every((x) => x.ref_type === "production_job")).toBe(true);
      expect(await reconcileInventory(t.db)).toEqual([]);
      expect((await getJob(manager, jobId)).consumption).toHaveLength(2);
    });

    it("refuses more than is in stock (nothing is recorded), unassigned workers, sales and finished goods", async () => {
      const a = await confirmedCustomOrder("Short");
      const b = await confirmedCustomOrder("Not mine");
      await setAssignees(manager, a.jobId, [workshop.id]);
      const m = await material("10.00");
      await recordManualMovement(manager, { itemId: m, locationId: workshopLoc, kind: "opening", quantity: "3", reason: "Opening" });
      await expect(recordConsumption(workshop, { jobId: a.jobId, itemId: m, locationId: workshopLoc, quantity: "4", requestKey: KS })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
      expect(await onHand(m, workshopLoc)).toBe(3);
      expect((await getJob(manager, a.jobId)).consumption).toHaveLength(0);
      // the failed attempt can be retried with the same key once stock exists
      await recordManualMovement(manager, { itemId: m, locationId: workshopLoc, kind: "receipt", quantity: "5", reason: "Delivery" });
      await expect(recordConsumption(workshop, { jobId: a.jobId, itemId: m, locationId: workshopLoc, quantity: "4", requestKey: KS })).resolves.toMatchObject({ duplicate: false });
      await expect(recordConsumption(workshop, { jobId: b.jobId, itemId: m, locationId: workshopLoc, quantity: "1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(recordConsumption(sales, { jobId: a.jobId, itemId: m, locationId: workshopLoc, quantity: "1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(recordConsumption(workshop, { jobId: a.jobId, itemId: m, locationId: workshopLoc, quantity: "0" })).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("costing is an estimate and lists materials with no cost", async () => {
      const { jobId } = await confirmedCustomOrder("Costing");
      const priced = await material("100.00");
      const unpriced = await material();
      for (const id of [priced, unpriced]) await recordManualMovement(manager, { itemId: id, locationId: workshopLoc, kind: "opening", quantity: "50", reason: "Opening" });
      await planMaterial(manager, jobId, { itemId: priced, plannedQuantity: "10" });
      let c = await getJobCosting(finance, jobId);
      expect(c).toMatchObject({ estimatedMaterials: "1000.00", estimatedMargin: "249000.00", actualMargin: null, complete: false });
      await recordConsumption(manager, { jobId, itemId: priced, locationId: workshopLoc, quantity: "12" });
      await recordConsumption(manager, { jobId, itemId: unpriced, locationId: workshopLoc, quantity: "5" });
      c = await getJobCosting(finance, jobId);
      expect(c.actualMaterials).toBe("1200.00");
      expect(c.missingCosts).toEqual([expect.stringContaining("Material")]);
      expect(c.complete).toBe(false);
    });

    it("labour is tracked only when switched on", async () => {
      const { jobId } = await confirmedCustomOrder("Labour");
      await expect(recordLabour(manager, jobId, { description: "Joinery", hours: "4", hourlyRate: "500" })).rejects.toMatchObject({ code: "INVALID_STATE" });
      await updateProductionSettings(owner, { createsFinishedStock: false, trackLabour: true });
      await recordLabour(manager, jobId, { description: "Joinery", hours: "4", hourlyRate: "500" });
      expect((await getJobCosting(finance, jobId)).actualLabour).toBe("2000.00");
      await updateProductionSettings(owner, { createsFinishedStock: false, trackLabour: false });
    });
  });

  describe("ACCEPTANCE #9: completion, rework and delivery of custom orders", () => {
    it("without the finished-goods workflow, completion records status only and delivery moves no stock", async () => {
      const { orderId, jobId } = await confirmedCustomOrder("Plain");
      await setAssignees(manager, jobId, [workshop.id]);
      for (const s of ["cutting_preparation", "assembly", "sanding_finishing", "quality_check", "ready_for_delivery"] as const) await changeStage(workshop, jobId, s);
      const before = (await t.sql`SELECT count(*)::int AS n FROM inventory_movements`)[0]!.n;
      await advanceOrder(sales, orderId, "delivered");
      expect((await t.sql`SELECT count(*)::int AS n FROM inventory_movements`)[0]!.n).toBe(before);
      expect((await getOrder(sales, orderId)).order.status).toBe("delivered");
    });

    it("with the finished-goods workflow: output is added once (even after rework) and removed once on delivery", async () => {
      await updateProductionSettings(owner, { createsFinishedStock: true, trackLabour: false });
      try {
        const { orderId, jobId, job } = await confirmedCustomOrder("Finished piece");
        const fresh = (await getJob(manager, jobId)).job;
        expect(fresh.outputItemId).not.toBeNull();
        const item = fresh.outputItemId!;
        const loc = fresh.outputLocationId!;
        await setAssignees(manager, jobId, [workshop.id]);
        for (const s of ["cutting_preparation", "assembly", "quality_check", "ready_for_delivery"] as const) await changeStage(workshop, jobId, s);
        expect(await onHand(item, loc)).toBe(1);

        // rework and complete again: no second output
        await changeStage(manager, jobId, "sanding_finishing", "Scratch on top");
        await changeStage(manager, jobId, "quality_check");
        await changeStage(manager, jobId, "ready_for_delivery");
        expect(await onHand(item, loc)).toBe(1);
        expect((await t.sql`SELECT count(*)::int AS n FROM inventory_movements WHERE ref_id = ${job.id} AND type = 'production_output'`)[0]!.n).toBe(1);

        await advanceOrder(sales, orderId, "delivered");
        expect(await onHand(item, loc)).toBe(0);
        expect((await t.sql`SELECT count(*)::int AS n FROM inventory_movements WHERE ref_id = ${job.id} AND type = 'sale'`)[0]!.n).toBe(1);
        expect((await t.db.select().from(productionJobs).where(eq(productionJobs.id, jobId)))[0]!.outputSoldAt).not.toBeNull();
        expect(await reconcileInventory(t.db)).toEqual([]);
        // the one-way flags cannot be reset
        await expect(t.sql`UPDATE production_jobs SET output_sold_at = NULL WHERE id = ${jobId}`).rejects.toThrow();
      } finally {
        await updateProductionSettings(owner, { createsFinishedStock: false, trackLabour: false });
      }
    });

    it("cancelling the order cancels the job; the job can no longer be changed", async () => {
      const { orderId, jobId } = await confirmedCustomOrder("To cancel");
      await cancelOrder(sales, orderId, "Customer changed their mind");
      const d = await getJob(manager, jobId);
      expect(d.job.stage).toBe("cancelled");
      expect(d.history.at(0)).toMatchObject({ to: "cancelled" });
      await expect(changeStage(manager, jobId, "assembly")).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(recordConsumption(manager, { jobId, itemId: await material(), locationId: workshopLoc, quantity: "1" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    });

    it("production never delivers the order or touches payments by itself", async () => {
      const { orderId, jobId } = await confirmedCustomOrder("Independent");
      for (const s of ["cutting_preparation", "assembly", "quality_check", "ready_for_delivery"] as const) await changeStage(manager, jobId, s);
      expect((await getOrder(sales, orderId)).order.status).toBe("confirmed");
    });
  });
});
