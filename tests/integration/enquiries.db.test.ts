import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { auditLogs, customers, leads, uploadedFiles } from "@/lib/db/schema";
import { enquirySchema } from "@/lib/schemas/enquiry";
import { hitRateLimit } from "@/lib/rate-limit";
import { submitEnquiry } from "@/server/enquiries";
import { getLead, listLeads } from "@/server/leads";
import { updateCrmSettings } from "@/server/settings";
import { hasTestDb } from "../helpers/db";
import { JPEG, NOT_AN_IMAGE, PNG, makeActor, setupApp, uploadTestFile } from "../helpers/app";

let phoneSeq = 0;
// Each call gets its own phone number unless one is given, so the per-phone rate limit does not leak between tests.
const base = { kind: "custom", name: "Nimal Perera", consent: "on", furnitureType: "Dining table" };
const parse = (o: Record<string, unknown>) => {
  const r = enquirySchema.safeParse({ phone: `0710${String(100000 + ++phoneSeq)}`, ...o });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe.skipIf(!hasTestDb)("public enquiry pipeline (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, sales: Actor, workshop: Actor, finance: Actor;
  let ipCounter = 0;
  const nextIp = () => `198.51.100.${++ipCounter}`;

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    sales = await makeActor(t, ["sales"], "Sam Sales");
    workshop = await makeActor(t, ["workshop"], "Wes Workshop");
    finance = await makeActor(t, ["finance"], "Fiona Finance");
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("ACCEPTANCE #1: a visitor's custom enquiry with an image appears in the CRM for staff, with files linked", async () => {
    await updateCrmSettings(owner, { defaultAssigneeId: sales.id });
    const fileId = await uploadTestFile("enquiry", JPEG, "image/jpeg", { fileName: "my sketch.jpg" });
    const input = parse({ ...base, email: "Nimal@Example.com", dimensions: "180 x 90 x 75 cm", material: "Teak", budgetRange: "100k-150k", targetDate: "2027-03-01", message: "Please quote", preferredContact: "whatsapp", fileIds: [fileId] });

    const res = await submitEnquiry(input, { ip: nextIp() });
    expect(res.reference).toMatch(/^ENQ-\d{6}$/);

    // assigned staff can list and open it
    const list = await listLeads(sales, { page: 1, pageSize: 20, assignedTo: "me" });
    expect(list.rows.map((r) => r.id)).toContain(res.leadId);
    const detail = await getLead(sales, res.leadId);
    expect(detail.lead).toMatchObject({ kind: "custom", source: "website", status: "new", contactName: "Nimal Perera", contactEmailLower: "nimal@example.com", preferredContact: "whatsapp", assignedTo: sales.id });
    expect(detail.lead.payload).toMatchObject({ furnitureType: "Dining table", dimensions: "180 x 90 x 75 cm", material: "Teak", targetDate: "2027-03-01" });
    expect(detail.files).toHaveLength(1);
    expect(detail.files[0]).toMatchObject({ name: "my sketch.jpg", contentType: "image/jpeg" });

    const [f] = await t.db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId));
    expect(f).toMatchObject({ status: "linked", entityType: "lead", entityId: res.leadId, visibility: "private", bucket: "private-files" });
    const audits = await t.db.select().from(auditLogs).where(eq(auditLogs.entityId, res.leadId));
    expect(audits.map((a) => a.action)).toContain("lead.created_from_website");
  });

  it("does NOT create a customer, but flags a matching one for review (never merges silently)", async () => {
    const [existing] = await t.db.insert(customers).values({ name: "Nimal P.", phone: "0771234567", phoneKey: "771234567" }).returning();
    const res = await submitEnquiry(parse({ ...base, phone: "+94 77 123 4567" }), { ip: nextIp() });
    const [lead] = await t.db.select().from(leads).where(eq(leads.id, res.leadId));
    expect(lead!.possibleDuplicateCustomerId).toBe(existing!.id);
    expect(lead!.customerId).toBeNull();
    const n = await t.db.select().from(customers);
    expect(n).toHaveLength(1);
    const detail = await getLead(sales, res.leadId);
    expect(detail.possibleDuplicate?.name).toBe("Nimal P.");
  });

  it("rate limits per IP and per phone number", async () => {
    const ip = "192.0.2.77";
    for (let i = 0; i < 5; i++) await submitEnquiry(parse({ ...base, phone: `0712000${100 + i}` }), { ip });
    await expect(submitEnquiry(parse({ ...base, phone: "0712000999" }), { ip })).rejects.toMatchObject({ code: "RATE_LIMITED" });

    const phone = "0759999999";
    for (let i = 0; i < 3; i++) await submitEnquiry(parse({ ...base, phone }), { ip: nextIp() });
    await expect(submitEnquiry(parse({ ...base, phone }), { ip: nextIp() })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("counts exactly under concurrency (no lost updates)", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => hitRateLimit(t.db, { scope: "t", value: "same", limit: 10, windowSeconds: 600 })));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(Math.max(...results.map((r) => r.count))).toBe(40);
  });

  it("rejects a file whose bytes are not an image even if it claims to be one, and purges it", async () => {
    const id = await uploadTestFile("enquiry", NOT_AN_IMAGE, "image/jpeg");
    await expect(submitEnquiry(parse({ ...base, fileIds: [id] }), { ip: nextIp() })).rejects.toMatchObject({ code: "VALIDATION" });
    const [f] = await t.db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id));
    expect(f!.status).toBe("purged");
  });

  it("rejects a PNG declared as JPEG (declared type must match the real type)", async () => {
    const id = await uploadTestFile("enquiry", PNG, "image/jpeg");
    await expect(submitEnquiry(parse({ ...base, fileIds: [id] }), { ip: nextIp() })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses disallowed types and oversize files before any upload starts", async () => {
    const { requestUpload } = await import("@/server/files");
    await expect(requestUpload({ purpose: "enquiry", fileName: "x.pdf", contentType: "application/pdf", size: 100 }, { actor: null, ip: nextIp() })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(requestUpload({ purpose: "enquiry", fileName: "x.exe", contentType: "application/x-msdownload", size: 100 }, { actor: null, ip: nextIp() })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(requestUpload({ purpose: "enquiry", fileName: "big.jpg", contentType: "image/jpeg", size: 9 * 1024 * 1024 }, { actor: null, ip: nextIp() })).rejects.toThrow(/too large/i);
    await expect(requestUpload({ purpose: "enquiry", fileName: "e.jpg", contentType: "image/jpeg", size: 0 }, { actor: null, ip: nextIp() })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("does not let a file be attached twice, or a staff upload be used by someone else", async () => {
    const id = await uploadTestFile("enquiry", JPEG, "image/jpeg");
    await submitEnquiry(parse({ ...base, fileIds: [id] }), { ip: nextIp() });
    await expect(submitEnquiry(parse({ ...base, fileIds: [id] }), { ip: nextIp() })).rejects.toMatchObject({ code: "VALIDATION" });

    const staffFile = await uploadTestFile("lead_attachment", JPEG, "image/jpeg", { actor: sales });
    const { verifyUploads } = await import("@/server/files");
    await expect(verifyUploads([staffFile], "lead_attachment", owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(verifyUploads([staffFile], "lead_attachment", sales)).resolves.toHaveLength(1);
  });

  it("staff uploads are permission-gated; the public cannot use staff purposes", async () => {
    const { requestUpload } = await import("@/server/files");
    await expect(requestUpload({ purpose: "catalogue", fileName: "a.jpg", contentType: "image/jpeg", size: 100 }, { actor: null, ip: "1.1.1.1" })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(requestUpload({ purpose: "catalogue", fileName: "a.jpg", contentType: "image/jpeg", size: 100 }, { actor: workshop, ip: "1.1.1.1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requestUpload({ purpose: "expense", fileName: "r.pdf", contentType: "application/pdf", size: 100 }, { actor: finance, ip: "1.1.1.1" })).resolves.toBeTruthy();
  });

  it("only attaches enquiries to products that are public", async () => {
    const [cat] = await t.sql`INSERT INTO product_categories (name, slug) VALUES ('Tables','tables') RETURNING id`;
    const [hidden] = await t.sql`INSERT INTO products (slug, name, category_id, is_published) VALUES ('hidden-one','Hidden', ${cat!.id}, false) RETURNING id`;
    await expect(submitEnquiry(parse({ ...base, kind: "product_enquiry", productId: hidden!.id }), { ip: nextIp() })).rejects.toMatchObject({ code: "VALIDATION" });
    const [shown] = await t.sql`INSERT INTO products (slug, name, category_id, is_published) VALUES ('shown-one','Shown', ${cat!.id}, true) RETURNING id`;
    const ok = await submitEnquiry(parse({ ...base, kind: "product_enquiry", productId: shown!.id }), { ip: nextIp() });
    expect((await getLead(owner, ok.leadId)).productName).toBe("Shown");
  });

  it("limits who can see enquiries and their private files", async () => {
    await expect(listLeads(workshop, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listLeads(finance, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const [l] = await t.db.select().from(leads).limit(1);
    await expect(getLead(workshop, l!.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("enquiry validation messages", () => {
  const withPhone = { ...base, phone: "0771234567" };
  const msgs = (o: Record<string, unknown>) => {
    const r = enquirySchema.safeParse(o);
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
  };
  it("explains what is missing in plain language", () => {
    const m = msgs({ kind: "general", name: "", phone: "abc", email: "nope", message: "hi" });
    expect(m).toMatchObject({
      name: expect.stringMatching(/required/i),
      phone: expect.stringMatching(/valid phone/i),
      email: expect.stringMatching(/valid email/i),
      message: expect.stringMatching(/at least 10/i),
      consent: expect.stringMatching(/agree/i),
    });
  });
  it("requires the furniture type for custom enquiries and email when email is the preferred contact", () => {
    expect(msgs({ ...withPhone, furnitureType: "" })).toHaveProperty("furnitureType");
    expect(msgs({ ...withPhone, preferredContact: "email" })).toHaveProperty("email");
  });
  it("treats empty optional fields as absent", () => {
    const r = enquirySchema.parse({ ...withPhone, email: "", targetDate: "", message: "" });
    expect(r.email).toBeUndefined();
    expect(r.targetDate).toBeUndefined();
  });
});
