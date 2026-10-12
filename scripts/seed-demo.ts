/* eslint-disable no-console */
/**
 * SAMPLE data for development and demos. Everything is labelled "[Sample]" and none of it is real business data.
 * Refuses to run unless: NODE_ENV is not production, DEMO_MODE=true, and DATABASE_URL is a localhost database.
 *   DEMO_MODE=true pnpm db:seed
 * Re-running is safe: it skips if sample data already exists.
 */
import { config } from "dotenv";
import { isLocalDatabaseUrl, DEMO_STAFF, DEMO_STAFF_NAMES, ensureDemoStaff } from "../src/lib/auth/demo";
import type { Actor } from "../src/lib/auth/permissions";
import { samplePng } from "./lib/sample-images";

config({ path: ".env.local" });
config();

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE !== "true" || !isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    console.error("Refusing to seed: needs DEMO_MODE=true, NODE_ENV!=production and a localhost DATABASE_URL.");
    process.exit(1);
  }
  process.env.STORAGE_DRIVER ??= "local";
  process.env.IP_HASH_SALT ??= "seed-salt-seed-salt-seed-salt-1234";

  const { getDb } = await import("../src/lib/db/client");
  const { sql } = await import("drizzle-orm");
  const db = getDb();
  await ensureDemoStaff(db);

  const [{ n }] = (await db.execute(sql`SELECT count(*)::int AS n FROM product_categories WHERE name LIKE '[Sample]%'`)) as unknown as [{ n: number }];
  if (n > 0) {
    console.log("Sample data already present; nothing to do.");
    process.exit(0);
  }

  const manager: Actor = { id: DEMO_STAFF.manager, fullName: DEMO_STAFF_NAMES.manager, roles: ["manager"], isActive: true };
  const owner: Actor = { id: DEMO_STAFF.owner, fullName: DEMO_STAFF_NAMES.owner, roles: ["owner"], isActive: true };
  const sales: Actor = { id: DEMO_STAFF.sales, fullName: DEMO_STAFF_NAMES.sales, roles: ["sales"], isActive: true };

  const { createCategory, createProduct, attachProductImages, createGalleryProject, attachGalleryImages, addVariant } = await import("../src/server/catalogue");
  const { requestUpload } = await import("../src/server/files");
  const { writeLocalObject } = await import("../src/lib/storage/local");
  const { submitEnquiry } = await import("../src/server/enquiries");
  const { enquirySchema } = await import("../src/lib/schemas/enquiry");
  const { changeLeadStatus, assignLead } = await import("../src/server/leads");
  const { updateCrmSettings, updateSalesSettings } = await import("../src/server/settings");
  const { createCustomerFromLead } = await import("../src/server/customers");
  const { createFollowUp, addActivity } = await import("../src/server/crm");
  const { createQuotation, sendQuotation, decideQuotation } = await import("../src/server/quotations");
  const { addDaysLocal } = await import("../src/lib/time");

  const upload = async (purpose: "catalogue" | "gallery", actor: Actor, top: [number, number, number], bottom: [number, number, number], w = 640, h = 800) => {
    const bytes = samplePng(w, h, top, bottom);
    const { fileId, signed } = await requestUpload({ purpose, fileName: "sample.png", contentType: "image/png", size: bytes.byteLength }, { actor, ip: null });
    await writeLocalObject(signed.bucket, signed.key, bytes);
    return fileId;
  };

  const tables = await createCategory(manager, { name: "[Sample] Dining Tables", slug: "sample-dining-tables", description: undefined, sortOrder: 0, isActive: true });
  const chairs = await createCategory(manager, { name: "[Sample] Chairs", slug: "sample-chairs", description: undefined, sortOrder: 1, isActive: true });
  const storage = await createCategory(manager, { name: "[Sample] Storage", slug: "sample-storage", description: undefined, sortOrder: 2, isActive: true });

  const products = [
    { name: "[Sample] Dining Table 180", cat: tables, sku: "SMP-DT-180", price: "185000", material: "Sample timber", dims: "W 180 × D 90 × H 75 cm", tones: [[150, 110, 78], [118, 84, 58]] as const, featured: true },
    { name: "[Sample] Dining Table 220", cat: tables, sku: "SMP-DT-220", price: "225000", material: "Sample timber", dims: "W 220 × D 95 × H 75 cm", tones: [[140, 100, 70], [108, 76, 52]] as const, featured: true },
    { name: "[Sample] Spindle Chair", cat: chairs, sku: "SMP-CH-01", price: "32000", material: "Sample timber", dims: "W 45 × D 50 × H 88 cm", tones: [[170, 130, 96], [130, 96, 68]] as const, featured: true },
    { name: "[Sample] Low Stool", cat: chairs, sku: "SMP-ST-01", price: "14500", material: "Sample timber", dims: "Ø 35 × H 45 cm", tones: [[160, 122, 88], [122, 90, 62]] as const, featured: false },
    { name: "[Sample] Sideboard", cat: storage, sku: "SMP-SB-01", price: "148000", material: "Sample timber", dims: "W 160 × D 45 × H 80 cm", tones: [[135, 98, 70], [100, 72, 50]] as const, featured: false },
  ];
  for (const p of products) {
    const id = await createProduct(manager, {
      name: p.name, slug: undefined, categoryId: p.cat, kind: "stocked", description: "Sample data for development and demos only. Not a real product.",
      material: p.material, finish: "Sample finish", dimensions: p.dims, sku: p.sku, listPrice: p.price,
      isPublished: true, isFeatured: p.featured, showAvailability: false, availability: undefined, showPrice: false, seoTitle: undefined, seoDescription: undefined,
    });
    const f = await upload("catalogue", manager, [...p.tones[0]] as [number, number, number], [...p.tones[1]] as [number, number, number]);
    await attachProductImages(manager, id, [f], `${p.name} (sample image)`);
    if (p.sku === "SMP-DT-180") await addVariant(manager, id, { sku: "SMP-DT-180-DK", label: "Dark finish", listPrice: "192000", isActive: true });
  }

  const g = await createGalleryProject(manager, { title: "[Sample] Completed project", description: "Sample project for development and demos only.", completedOn: "2026-05-01", isPublished: true, sortOrder: 0 });
  const gi = [await upload("gallery", manager, [170, 140, 110], [120, 92, 68], 800, 600), await upload("gallery", manager, [150, 120, 92], [104, 80, 60], 800, 600)];
  await attachGalleryImages(manager, g, gi, "Sample project photograph");

  await updateCrmSettings(owner, { defaultAssigneeId: sales.id });
  const enquiries = [
    { kind: "custom", name: "[Sample] Nimal Perera", phone: "0771110001", furnitureType: "Dining table", dimensions: "200 × 100 cm", material: "Teak", budgetRange: "150k–200k", message: "Sample enquiry for demos." },
    { kind: "general", name: "[Sample] Kumari Silva", phone: "0771110002", message: "Sample question about showroom opening hours." },
    { kind: "custom", name: "[Sample] Ruwan Fernando", phone: "0771110003", furnitureType: "Wardrobe", dimensions: "240 × 60 × 230 cm", message: "Sample custom wardrobe request." },
    { kind: "general", name: "[Sample] Ayesha Rahim", phone: "0771110004", message: "Sample enquiry about delivery to another city." },
    { kind: "general", name: "[Sample] Dilshan Jayasinghe", phone: "0771110005", message: "Sample enquiry that was lost to another supplier." },
  ];
  const ids: string[] = [];
  for (const [i, e] of enquiries.entries()) {
    const input = enquirySchema.parse({ ...e, consent: "on" });
    ids.push((await submitEnquiry(input, { ip: `198.51.100.${i + 1}` })).leadId);
  }
  await changeLeadStatus(sales, ids[1]!, "contacted");
  await changeLeadStatus(sales, ids[2]!, "quotation_sent");
  await changeLeadStatus(sales, ids[4]!, "lost", "Chose another supplier (sample)");
  await assignLead(manager, ids[3]!, null);

  // CRM + quotations (sample)
  await updateSalesSettings(owner, { maxDiscountPercent: "10" });
  const c1 = await createCustomerFromLead(sales, ids[0]!);
  const c3 = await createCustomerFromLead(sales, ids[2]!);
  await addActivity(sales, { leadId: ids[0]!, customerId: undefined, type: "call", body: "Sample call: discussed dimensions and wood choice." });
  await createFollowUp(sales, { leadId: ids[0]!, customerId: undefined, assignedTo: sales.id, title: "Sample: confirm table dimensions", dueOn: addDaysLocal(-2, "Asia/Colombo"), notes: undefined });
  await createFollowUp(sales, { leadId: ids[2]!, customerId: undefined, assignedTo: sales.id, title: "Sample: chase wardrobe quotation", dueOn: addDaysLocal(3, "Asia/Colombo"), notes: undefined });
  const q = (leadId: string | undefined, customerId: string, desc: string, price: string) =>
    createQuotation(sales, {
      customerId, leadId, validUntil: addDaysLocal(30, "Asia/Colombo"), deliveryCharge: "5000.00", terms: "Sample terms: 50% deposit, balance on delivery.", customerNotes: undefined, internalNotes: undefined,
      items: [{ kind: "custom", variantId: undefined, description: desc, dimensions: "200 × 100 × 75 cm", material: "Sample timber", finish: "Sample finish", notes: undefined, quantity: "1.000", unitPrice: price, discountAmount: "0.00" }],
    } as never);
  await q(ids[0]!, c1, "[Sample] Custom dining table", "210000.00"); // stays a draft
  const sent = await q(ids[2]!, c3, "[Sample] Custom wardrobe", "320000.00");
  await sendQuotation(sales, sent);
  const won = await q(undefined, c1, "[Sample] Console table", "98000.00");
  await sendQuotation(sales, won);
  await decideQuotation(sales, won, "accepted");
  console.log("Sample data created: categories, products, a gallery project, enquiries, customers, follow-ups and quotations. All labelled [Sample].");
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
