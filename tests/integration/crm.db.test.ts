import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { auditLogs, customers, followUpTasks, leadActivities, leads, quotationItems, quotationRevisions } from "@/lib/db/schema";
import { activitySchema, customerSchema, followUpSchema, manualLeadSchema } from "@/lib/schemas/crm";
import { addActivity, completeFollowUp, createFollowUp, createLeadManual, listActivities, listFollowUps } from "@/server/crm";
import { getSalesDashboard } from "@/server/crm-dashboard";
import { createCustomer, createCustomerFromLead, findCustomerMatches, linkLeadToCustomer, listCustomers, updateCustomer } from "@/server/customers";
import { submitEnquiry } from "@/server/enquiries";
import { enquirySchema } from "@/lib/schemas/enquiry";
import { changeLeadStatus, getLead } from "@/server/leads";
import { createQuotation, decideQuotation, expireStaleQuotations, getQuotation, listQuotations, reviseQuotation, sendQuotation, updateQuotationDraft } from "@/server/quotations";
import { updateSalesSettings } from "@/server/settings";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";

const cust = (o: Record<string, unknown> = {}) => customerSchema.parse({ name: "Nimal Perera", phone: "0771234567", ...o });
const item = (o: Record<string, unknown> = {}) => ({ kind: "custom" as const, description: "Walnut dining table", quantity: "1.000", unitPrice: "150000.00", discountAmount: "0.00", ...o }) as never;
const draft = (o: Record<string, unknown> = {}) => ({ validUntil: "2099-01-01", deliveryCharge: "2500.00", items: [item()], ...o }) as never;

describe.skipIf(!hasTestDb)("CRM and quotations (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, manager: Actor, sales: Actor, sales2: Actor, workshop: Actor, finance: Actor;
  let ip = 0;

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    manager = await makeActor(t, ["manager"], "Mia Manager");
    sales = await makeActor(t, ["sales"], "Sam Sales");
    sales2 = await makeActor(t, ["sales"], "Sue Sales");
    workshop = await makeActor(t, ["workshop"], "Wes Workshop");
    finance = await makeActor(t, ["finance"], "Fiona Finance");
  });
  afterAll(async () => {
    await t?.teardown();
  });

  describe("customers", () => {
    it("warns about a likely duplicate (phone typed differently, or same email) instead of silently merging or blocking", async () => {
      const id = await createCustomer(sales, cust({ phone: "0771234567", email: "Nimal@Example.com" }));
      await expect(createCustomer(sales, cust({ name: "N. Perera", phone: "+94 77 123 4567" }))).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { confirmDuplicate: expect.any(Array) } });
      await expect(createCustomer(sales, cust({ name: "Other", phone: "0719999999", email: "nimal@example.com" }))).rejects.toMatchObject({ code: "CONFLICT" });
      const second = await createCustomer(sales, cust({ name: "Different Nimal", phone: "+94 77 123 4567", confirmDuplicate: "on" }));
      expect(second).not.toBe(id);
      expect((await t.db.select().from(customers)).length).toBe(2);
      const matches = await findCustomerMatches(t.db, "077-123-4567", "x@y.test");
      expect(matches.map((m) => m.matchedOn)).toEqual(["phone", "phone"]);
    });

    it("also warns when editing a customer's phone to one that already exists", async () => {
      const a = await createCustomer(sales, cust({ name: "Edit Me", phone: "0765550001" }));
      await createCustomer(sales, cust({ name: "Existing", phone: "0765550002" }));
      await expect(updateCustomer(sales, a, cust({ name: "Edit Me", phone: "0765550002" }))).rejects.toMatchObject({ code: "CONFLICT" });
      await updateCustomer(sales, a, cust({ name: "Edit Me Renamed", phone: "0765550001" })); // unchanged contact: no warning
    });

    it("is restricted: workshop cannot see customers, finance can read but not write", async () => {
      await expect(listCustomers(workshop, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listCustomers(finance, { page: 1, pageSize: 10 })).resolves.toBeTruthy();
      await expect(createCustomer(finance, cust({ phone: "0700000001" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("searches by name, company, phone and email, treating wildcards literally", async () => {
      expect((await listCustomers(sales, { q: "perera", page: 1, pageSize: 10 })).total).toBeGreaterThanOrEqual(1);
      expect((await listCustomers(sales, { q: "%", page: 1, pageSize: 10 })).total).toBe(0);
    });
  });

  describe("enquiry → customer", () => {
    it("creates a customer from an enquiry and links it; refuses when one exists unless confirmed; link-existing never copies", async () => {
      const input = enquirySchema.parse({ kind: "general", name: "Kumari Silva", phone: "0712223334", message: "Please call me back.", consent: "on" });
      const { leadId } = await submitEnquiry(input, { ip: `203.0.113.${++ip}` });
      const customerId = await createCustomerFromLead(sales, leadId);
      const detail = await getLead(sales, leadId);
      expect(detail.lead.customerId).toBe(customerId);
      await expect(createCustomerFromLead(sales, leadId)).rejects.toMatchObject({ code: "VALIDATION" }); // already linked

      const again = await submitEnquiry(enquirySchema.parse({ kind: "general", name: "Kumari S.", phone: "+94 71 222 3334", message: "A second enquiry from her.", consent: "on" }), { ip: `203.0.113.${++ip}` });
      expect((await getLead(sales, again.leadId)).possibleDuplicate?.id).toBe(customerId);
      await expect(createCustomerFromLead(sales, again.leadId)).rejects.toMatchObject({ code: "CONFLICT" });
      await linkLeadToCustomer(sales, again.leadId, customerId);
      const linked = await getLead(sales, again.leadId);
      expect(linked.lead.customerId).toBe(customerId);
      expect(linked.lead.possibleDuplicateCustomerId).toBeNull();
      expect((await t.db.select().from(customers).where(eq(customers.phoneKey, "712223334"))).length).toBe(1);
    });
  });

  describe("activities, follow-ups and the pipeline", () => {
    let leadId: string;
    beforeAll(async () => {
      leadId = (await createLeadManual(sales, manualLeadSchema.parse({ kind: "custom", source: "phone", name: "Walk-in Wanda", phone: "0723334445", message: "Wants a bookcase." }))).id;
    });

    it("staff-recorded leads keep their source and are assigned to the creator by default", async () => {
      const d = await getLead(sales, leadId);
      expect(d.lead).toMatchObject({ source: "phone", assignedTo: sales.id, status: "new" });
    });

    it("records calls/notes in an activity history and logs status changes automatically", async () => {
      await addActivity(sales, activitySchema.parse({ leadId, type: "call", body: "Spoke to Wanda; wants oak." }));
      await changeLeadStatus(sales, leadId, "contacted");
      await changeLeadStatus(sales, leadId, "contacted"); // no-op change: no duplicate entry
      const acts = await listActivities(sales, { leadId });
      expect(acts.map((a) => a.type)).toEqual(expect.arrayContaining(["call", "status_change", "note"]));
      expect(acts.filter((a) => a.type === "status_change")).toHaveLength(1);
      expect(acts.find((a) => a.type === "call")!.byName).toBe("Sam Sales");
      await expect(addActivity(workshop, activitySchema.parse({ leadId, type: "note", body: "x" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("requires a reason to mark an enquiry lost", async () => {
      const l = (await createLeadManual(sales, manualLeadSchema.parse({ kind: "general", source: "showroom", name: "Lost Larry", phone: "0734445556" }))).id;
      await expect(changeLeadStatus(sales, l, "lost")).rejects.toMatchObject({ code: "VALIDATION" });
      await changeLeadStatus(sales, l, "lost", "Chose a competitor");
      expect((await getLead(sales, l)).lead).toMatchObject({ status: "lost", lostReason: "Chose a competitor" });
      expect((await t.db.select().from(leads).where(eq(leads.id, l)))[0]!.closedAt).not.toBeNull();
    });

    it("follow-ups: overdue is computed in the business timezone, completion is idempotent, next follow-up date follows the earliest open task", async () => {
      const now = new Date("2026-03-10T20:00:00Z"); // 11 March in Asia/Colombo
      const overdue = await createFollowUp(sales, followUpSchema.parse({ leadId, assignedTo: sales.id, title: "Call back about oak", dueOn: "2026-03-10" }));
      const later = await createFollowUp(sales, followUpSchema.parse({ leadId, assignedTo: sales.id, title: "Send photos", dueOn: "2026-03-20" }));
      expect((await t.db.select().from(leads).where(eq(leads.id, leadId)))[0]!.nextFollowUpOn).toBe("2026-03-10");

      const open = await listFollowUps(sales, { assignee: "me", status: "open", page: 1, pageSize: 20 }, now);
      expect(open.rows.find((r) => r.id === overdue)!.overdue).toBe(true);
      expect(open.rows.find((r) => r.id === later)!.overdue).toBe(false);
      expect((await listFollowUps(sales, { assignee: "me", status: "overdue", page: 1, pageSize: 20 }, now)).rows.map((r) => r.id)).toEqual([overdue]);

      await completeFollowUp(sales, overdue);
      await completeFollowUp(sales, overdue); // idempotent
      expect((await t.db.select().from(leads).where(eq(leads.id, leadId)))[0]!.nextFollowUpOn).toBe("2026-03-20");
      expect((await listFollowUps(sales, { assignee: "all", status: "done", page: 1, pageSize: 20 }, now)).rows.map((r) => r.id)).toContain(overdue);
      await completeFollowUp(sales, later);
      expect((await t.db.select().from(leads).where(eq(leads.id, leadId)))[0]!.nextFollowUpOn).toBeNull();
      await expect(createFollowUp(workshop, followUpSchema.parse({ leadId, assignedTo: sales.id, title: "x", dueOn: "2026-03-10" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(createFollowUp(sales, followUpSchema.parse({ leadId, assignedTo: workshop.id, title: "x", dueOn: "2026-03-10" }))).rejects.toMatchObject({ code: "VALIDATION" });
      void followUpTasks; void leadActivities;
    });
  });

  describe("quotations", () => {
    let customerId: string;
    beforeAll(async () => {
      customerId = await createCustomer(sales, cust({ name: "Quote Customer", phone: "0781112223" }));
      await updateSalesSettings(owner, { maxDiscountPercent: "10" });
    });

    it("ACCEPTANCE #2: staff create a customer, enquiry, follow-up and quotation; totals are exact decimals computed on the server", async () => {
      const lead = (await createLeadManual(sales, manualLeadSchema.parse({ kind: "custom", source: "referral", name: "Quote Customer", phone: "0781112223", customerId }))).id;
      await createFollowUp(sales, followUpSchema.parse({ leadId: lead, assignedTo: sales.id, title: "Chase quotation", dueOn: "2099-01-05" }));
      const id = await createQuotation(sales, draft({
        customerId, leadId: lead, deliveryCharge: "1500.50",
        items: [
          item({ description: "Teak table", quantity: "2", unitPrice: "1999.99", discountAmount: "100.00" }),
          item({ description: "Bench", quantity: "1.5", unitPrice: "333.33", dimensions: "150 x 40 cm", material: "Oak", finish: "Oiled", notes: "Match the table" }),
        ],
      }));
      const q = await getQuotation(sales, id);
      expect(q.quotation).toMatchObject({ status: "draft", currentRevisionNo: 1, currency: "LKR" });
      expect(q.quotation.reference).toMatch(/^QUO-\d{6}$/);
      // 2×1999.99−100 = 3899.98 ; 1.5×333.33 = 499.995 → rounded once, half-up, to 500.00
      expect(q.items.map((i) => i.lineTotal)).toEqual(["3899.98", "500.00"]);
      expect(q.revision).toMatchObject({ subtotal: "4499.98", discountTotal: "100.00", deliveryCharge: "1500.50", total: "5900.48" });
      expect(q.items[1]!.specification).toEqual({ dimensions: "150 x 40 cm", material: "Oak", finish: "Oiled", notes: "Match the table" });
      expect((await getLead(sales, lead)).lead.customerId).toBe(customerId);
    });

    it("holds Sales to the discount limit, lets a Manager override, and rejects a discount larger than the line", async () => {
      const mk = (discountAmount: string) => draft({ customerId, items: [item({ unitPrice: "1000.00", discountAmount })] });
      await expect(createQuotation(sales, mk("150.00"))).rejects.toThrow(/15%.*limit of 10%/);
      await expect(createQuotation(sales, mk("100.00"))).resolves.toBeTruthy(); // exactly 10%
      await expect(createQuotation(manager, mk("150.00"))).resolves.toBeTruthy(); // override
      await expect(createQuotation(manager, mk("1000.01"))).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(createQuotation(sales, draft({ customerId, items: [] }))).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("checks products on ready-made lines and the customer/enquiry relationship", async () => {
      const [cat] = await t.sql`INSERT INTO product_categories (name, slug) VALUES ('Q Cat','q-cat') RETURNING id`;
      const [p] = await t.sql`INSERT INTO products (slug, name, category_id) VALUES ('q-prod','Q Prod', ${cat!.id}) RETURNING id`;
      const [v] = await t.sql`INSERT INTO product_variants (product_id, sku, list_price) VALUES (${p!.id}, 'Q-1', 500) RETURNING id`;
      const [bad] = await t.sql`INSERT INTO product_variants (product_id, sku, is_active) VALUES (${p!.id}, 'Q-2', false) RETURNING id`;
      await expect(createQuotation(sales, draft({ customerId, items: [item({ kind: "ready_made", variantId: bad!.id })] }))).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(createQuotation(sales, draft({ customerId, items: [item({ kind: "ready_made", variantId: v!.id, unitPrice: "500.00" })] }))).resolves.toBeTruthy();

      const other = await createCustomer(sales, cust({ name: "Someone Else", phone: "0790001112" }));
      const lead = (await createLeadManual(sales, manualLeadSchema.parse({ kind: "general", source: "phone", name: "X", phone: "0790009999", customerId: other }))).id;
      await expect(createQuotation(sales, draft({ customerId, leadId: lead }))).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("edits a draft in place, recalculating totals; ignores nothing a client could forge", async () => {
      const id = await createQuotation(sales, draft({ customerId }));
      await updateQuotationDraft(sales, id, draft({ items: [item({ quantity: "3", unitPrice: "100.10" })], deliveryCharge: "0" }));
      const q = await getQuotation(sales, id);
      expect(q.items).toHaveLength(1);
      expect(q.revision.total).toBe("300.30");
      await expect(updateQuotationDraft(workshop, id, draft())).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("sending freezes the revision: the app AND the database refuse later edits", async () => {
      const lead = (await createLeadManual(sales, manualLeadSchema.parse({ kind: "custom", source: "whatsapp", name: "Freeze", phone: "0794445556", customerId }))).id;
      const id = await createQuotation(sales, draft({ customerId, leadId: lead }));
      await sendQuotation(sales, id);
      const q = await getQuotation(sales, id);
      expect(q.quotation.status).toBe("sent");
      expect(q.revision.frozenAt).not.toBeNull();
      expect((await getLead(sales, lead)).lead.status).toBe("quotation_sent"); // pipeline advanced

      await expect(updateQuotationDraft(sales, id, draft())).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(sendQuotation(sales, id)).rejects.toMatchObject({ code: "INVALID_STATE" });
      // Bypass the app entirely: raw SQL must still fail.
      await expect(t.sql`UPDATE quotation_revisions SET total = 1 WHERE id = ${q.revision.id}`).rejects.toThrow(/frozen/i);
      await expect(t.sql`DELETE FROM quotation_revisions WHERE id = ${q.revision.id}`).rejects.toThrow(/frozen/i);
      await expect(t.sql`UPDATE quotation_items SET unit_price = 1 WHERE revision_id = ${q.revision.id}`).rejects.toThrow(/cannot be changed/i);
      await expect(t.sql`DELETE FROM quotation_items WHERE revision_id = ${q.revision.id}`).rejects.toThrow(/cannot be changed/i);
      await expect(t.sql`INSERT INTO quotation_items (revision_id, position, kind, description, quantity, unit_price, line_total) VALUES (${q.revision.id}, 9, 'custom', 'sneaky', 1, 1, 1)`).rejects.toThrow(/cannot be changed/i);
    });

    it("refuses to send a quotation whose valid-until date has passed", async () => {
      const id = await createQuotation(sales, draft({ customerId, validUntil: "2020-01-01" }));
      await expect(sendQuotation(sales, id)).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { validUntil: expect.any(Array) } });
    });

    it("two staff sending the same draft at once: exactly one succeeds", async () => {
      const id = await createQuotation(sales, draft({ customerId }));
      const results = await Promise.allSettled([sendQuotation(sales, id), sendQuotation(manager, id), sendQuotation(sales2, id)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "INVALID_STATE")).toBe(true);
    });

    it("accepting marks the enquiry won; rejecting is recorded; only a sent quotation can be decided", async () => {
      const lead = (await createLeadManual(sales, manualLeadSchema.parse({ kind: "custom", source: "phone", name: "Winner", phone: "0795556667", customerId }))).id;
      const id = await createQuotation(sales, draft({ customerId, leadId: lead }));
      await expect(decideQuotation(sales, id, "accepted")).rejects.toMatchObject({ code: "INVALID_STATE" }); // still a draft
      await sendQuotation(sales, id);
      await decideQuotation(sales, id, "accepted");
      expect((await getQuotation(sales, id)).quotation.status).toBe("accepted");
      expect((await getLead(sales, lead)).lead.status).toBe("won");
      await expect(decideQuotation(sales, id, "rejected")).rejects.toMatchObject({ code: "INVALID_STATE" });

      const id2 = await createQuotation(sales, draft({ customerId }));
      await sendQuotation(sales, id2);
      await decideQuotation(sales, id2, "rejected");
      expect((await getQuotation(sales, id2)).quotation.status).toBe("rejected");
    });

    it("an accepted quotation can never be changed or revised; others get a NEW revision and keep history", async () => {
      const id = await createQuotation(sales, draft({ customerId, items: [item({ description: "Original item", unitPrice: "1000.00" })] }));
      await sendQuotation(sales, id);
      await decideQuotation(sales, id, "accepted");
      await expect(reviseQuotation(sales, id)).rejects.toMatchObject({ code: "INVALID_STATE" });
      await expect(updateQuotationDraft(sales, id, draft())).rejects.toMatchObject({ code: "INVALID_STATE" });

      const id2 = await createQuotation(sales, draft({ customerId, items: [item({ description: "Original item", unitPrice: "1000.00" })] }));
      await sendQuotation(sales, id2);
      expect(await reviseQuotation(sales, id2)).toBe(2);
      expect((await getQuotation(sales, id2)).quotation).toMatchObject({ status: "draft", currentRevisionNo: 2 });
      await updateQuotationDraft(sales, id2, draft({ items: [item({ description: "Revised item", unitPrice: "900.00" })] }));
      await sendQuotation(sales, id2);

      const v1 = await getQuotation(sales, id2, 1);
      const v2 = await getQuotation(sales, id2, 2);
      expect(v1.items[0]).toMatchObject({ description: "Original item", unitPrice: "1000.00" }); // history untouched
      expect(v2.items[0]).toMatchObject({ description: "Revised item", unitPrice: "900.00" });
      expect(v2.revisions.map((r) => r.revisionNo)).toEqual([2, 1]);
      expect(v1.isCurrent).toBe(false);
      await expect(getQuotation(sales, id2, 7)).rejects.toMatchObject({ code: "NOT_FOUND" });
      const rows = await t.db.select().from(quotationRevisions).where(eq(quotationRevisions.quotationId, id2));
      expect(rows).toHaveLength(2);
      expect((await t.db.select().from(quotationItems)).length).toBeGreaterThan(0);
    });

    it("expires sent quotations past their valid-until date (cron), and blocks accepting a lapsed one", async () => {
      const soon = await createQuotation(sales, draft({ customerId, validUntil: "2026-06-30" }));
      await sendQuotation(sales, soon, new Date("2026-06-01T05:00:00Z"));
      expect(await expireStaleQuotations(t.db, "2026-06-30")).toBe(0); // last valid day
      await expect(decideQuotation(sales, soon, "accepted", new Date("2026-07-01T05:00:00Z"))).rejects.toMatchObject({ code: "INVALID_STATE" });
      expect((await getQuotation(sales, soon)).quotation.status).toBe("expired");
      expect(await reviseQuotation(sales, soon)).toBe(2); // can be revived as a new revision

      const other = await createQuotation(sales, draft({ customerId, validUntil: "2026-06-30" }));
      await sendQuotation(sales, other, new Date("2026-06-01T05:00:00Z"));
      expect(await expireStaleQuotations(t.db, "2026-07-01")).toBe(1);
      expect((await listQuotations(sales, { status: "expired", page: 1, pageSize: 50 })).rows.map((r) => r.id)).toContain(other);
    });

    it("limits who can see or change quotations", async () => {
      await expect(listQuotations(workshop, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listQuotations(finance, { page: 1, pageSize: 10 })).resolves.toBeTruthy(); // read-only
      await expect(createQuotation(finance, draft({ customerId }))).rejects.toMatchObject({ code: "FORBIDDEN" });
      const id = await createQuotation(sales, draft({ customerId }));
      await expect(sendQuotation(finance, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getQuotation(workshop, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("audits the lifecycle", async () => {
      const actions = (await t.db.select().from(auditLogs)).map((a) => a.action);
      for (const a of ["quotation.created", "quotation.sent", "quotation.accepted", "quotation.rejected", "quotation.revised", "customer.created", "settings.sales_updated"]) expect(actions).toContain(a);
    });
  });

  describe("sales dashboard", () => {
    it("reports counts with explicit definitions; conversion uses won ÷ (won + lost); quotation value is exposure, not revenue", async () => {
      const d = await getSalesDashboard(sales, { from: "2000-01-01", to: "2099-12-31" });
      expect(d.conversion.won).toBeGreaterThan(0);
      expect(d.conversion.lost).toBeGreaterThan(0);
      expect(d.conversion.rate).toBeCloseTo(d.conversion.won / (d.conversion.won + d.conversion.lost), 5);
      expect(d.quotations.awaitingCount).toBeGreaterThan(0);
      expect(Number(d.quotations.awaitingValue)).toBeGreaterThan(0);
      expect(d.leads.open).toBeGreaterThan(0);
      const empty = await getSalesDashboard(sales, { from: "1999-01-01", to: "1999-01-02" });
      expect(empty.conversion).toEqual({ created: 0, won: 0, lost: 0, rate: null });
      await expect(getSalesDashboard(workshop, { from: "2000-01-01", to: "2099-12-31" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getSalesDashboard(finance, { from: "2000-01-01", to: "2099-12-31" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
