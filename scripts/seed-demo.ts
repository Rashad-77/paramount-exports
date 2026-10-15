/* eslint-disable no-console */
/**
 * SAMPLE data for development and demos. Everything is labelled "[Sample]" and none of it is real business data.
 * Refuses to run unless EITHER: NODE_ENV is not production, DEMO_MODE=true and DATABASE_URL is a localhost database;
 * OR this is a public demo deployment (DEMO_DEPLOYMENT=true, no Supabase configured — see docs/DEMO_DEPLOYMENT.md), where it
 * runs from the Vercel build and skips the sample photos (there is no file storage).
 *   DEMO_MODE=true pnpm db:seed
 * Re-running is safe: it skips if sample data already exists.
 */
import { config } from "dotenv";
import { isLocalDatabaseUrl, DEMO_STAFF, DEMO_STAFF_NAMES, ensureDemoStaff } from "../src/lib/auth/demo";
import { demoDeploymentEnabled } from "../src/lib/auth/demo-deployment";
import type { Actor } from "../src/lib/auth/permissions";
import { samplePng } from "./lib/sample-images";

config({ path: ".env.local" });
config();

async function main() {
  const deployment = demoDeploymentEnabled();
  const local = process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true" && isLocalDatabaseUrl(process.env.DATABASE_URL);
  if (!deployment && !local) {
    console.error("Refusing to seed: needs DEMO_MODE=true, NODE_ENV!=production and a localhost DATABASE_URL (or a demo deployment).");
    process.exit(1);
  }
  const withImages = !deployment;
  process.env.STORAGE_DRIVER ??= "local";
  process.env.IP_HASH_SALT ??= "seed-salt-seed-salt-seed-salt-1234";

  const { getDb } = await import("../src/lib/db/client");
  const { sql } = await import("drizzle-orm");
  const db = getDb();
  await ensureDemoStaff(db);

  // Already seeded with the current sample data (orders exist): nothing to do.
  const [{ done }] = (await db.execute(sql`SELECT count(*)::int AS done FROM online_orders WHERE customer_name LIKE '[Sample]%'`)) as unknown as [{ done: number }];
  if (done > 0) {
    console.log("Sample data already present; nothing to do.");
    process.exit(0);
  }
  // An older sample set (from before online orders: products with no public price, no orders) would leave nothing to order. Replace it.
  // Only rows labelled "[Sample]" are touched.
  await db.execute(sql`DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE name LIKE '[Sample]%')`);
  await db.execute(sql`DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE name LIKE '[Sample]%')`);
  await db.execute(sql`DELETE FROM products WHERE name LIKE '[Sample]%'`);
  await db.execute(sql`DELETE FROM product_categories WHERE name LIKE '[Sample]%'`);
  await db.execute(sql`DELETE FROM gallery_images WHERE project_id IN (SELECT id FROM gallery_projects WHERE title LIKE '[Sample]%')`);
  await db.execute(sql`DELETE FROM gallery_projects WHERE title LIKE '[Sample]%'`);
  await db.execute(sql`DELETE FROM messages WHERE name LIKE '[Sample]%'`);

  const owner: Actor = { id: DEMO_STAFF.owner, fullName: DEMO_STAFF_NAMES.owner, roles: ["owner"], isActive: true };

  const { createCategory, createProduct, attachProductImages, createGalleryProject, attachGalleryImages, addVariant } = await import("../src/server/catalogue");
  const { requestUpload } = await import("../src/server/files");
  const { writeLocalObject } = await import("../src/lib/storage/local");
  const { submitEnquiry } = await import("../src/server/messages");
  const { enquirySchema } = await import("../src/lib/schemas/enquiry");
  const { placeOrder, setOrderStatus, setOrderPaid, updateOrderDetails } = await import("../src/server/orders");
  const { checkoutSchema } = await import("../src/lib/schemas/orders");

  const upload = async (purpose: "catalogue" | "gallery", w = 640, h = 800) => {
    const bytes = samplePng(w, h);
    const { fileId, signed } = await requestUpload({ purpose, fileName: "sample.png", contentType: "image/png", size: bytes.byteLength }, { actor: owner, ip: null });
    await writeLocalObject(signed.bucket, signed.key, bytes);
    return fileId;
  };

  const tables = await createCategory(owner, { name: "[Sample] Dining Tables", slug: "sample-dining-tables", description: undefined, sortOrder: 900, isActive: true });
  const chairs = await createCategory(owner, { name: "[Sample] Chairs", slug: "sample-chairs", description: undefined, sortOrder: 901, isActive: true });
  const storage = await createCategory(owner, { name: "[Sample] Storage", slug: "sample-storage", description: undefined, sortOrder: 902, isActive: true });

  const products = [
    { name: "[Sample] Dining Table 180", cat: tables, sku: "SMP-DT-180", price: "185000", dims: "W 180 × D 90 × H 75 cm", featured: true },
    { name: "[Sample] Dining Table 220", cat: tables, sku: "SMP-DT-220", price: "225000", dims: "W 220 × D 95 × H 75 cm", featured: true },
    { name: "[Sample] Spindle Chair", cat: chairs, sku: "SMP-CH-01", price: "32000", dims: "W 45 × D 50 × H 88 cm", featured: true },
    { name: "[Sample] Low Stool", cat: chairs, sku: "SMP-ST-01", price: "14500", dims: "Ø 35 × H 45 cm", featured: true },
    { name: "[Sample] Sideboard", cat: storage, sku: "SMP-SB-01", price: "148000", dims: "W 160 × D 45 × H 80 cm", featured: true },
    { name: "[Sample] Bookcase", cat: storage, sku: "SMP-BK-01", price: "96000", dims: "W 90 × D 35 × H 200 cm", featured: false },
  ];
  for (const p of products) {
    const id = await createProduct(owner, {
      name: p.name, slug: undefined, categoryId: p.cat, kind: "stocked", description: "Sample data for development and demos only. Not a real product.",
      material: "Sample timber", finish: "Sample finish", dimensions: p.dims, sku: p.sku, listPrice: p.price,
      isPublished: true, isFeatured: p.featured, showAvailability: false, availability: undefined, showPrice: true, seoTitle: undefined, seoDescription: undefined,
    });
    if (withImages) await attachProductImages(owner, id, [await upload("catalogue")], `${p.name} (sample image)`);
    if (p.sku === "SMP-DT-180") await addVariant(owner, id, { sku: "SMP-DT-180-DK", label: "Dark finish", listPrice: "192000", isActive: true });
  }

  const g = await createGalleryProject(owner, { title: "[Sample] Completed project", description: "Sample project for development and demos only.", completedOn: "2026-05-01", isPublished: true, sortOrder: 0 });
  if (withImages) await attachGalleryImages(owner, g, [await upload("gallery", 800, 600), await upload("gallery", 800, 600)], "Sample project photograph");

  // Messages from the website
  const message = (m: Record<string, string>) => submitEnquiry(enquirySchema.parse({ consent: "on", fileIds: [], ...m }), { ip: null });
  await message({ kind: "general", name: "[Sample] Kamal Silva", phone: "0771110010", email: "kamal@example.test", preferredContact: "email", message: "Sample message: do you export to Singapore, and what are the lead times?" });
  await message({ kind: "custom", name: "[Sample] Nimal Perera", phone: "0771110001", furnitureType: "Dining table", dimensions: "200 × 100 cm", material: "Teak", budgetRange: "150k–200k", message: "Sample custom request for demos." });

  // Orders placed on the website, then handled by staff
  const variants = (await db.execute(sql`SELECT id, sku FROM product_variants ORDER BY sku`)) as unknown as { id: string; sku: string }[];
  const v = (sku: string) => variants.find((x) => x.sku === sku)!.id;
  const order = (o: Record<string, unknown>, lines: [string, number][]) =>
    placeOrder(checkoutSchema.parse({ consent: "on", fulfilment: "delivery", paymentMethod: "on_delivery", ...o, cart: JSON.stringify(lines.map(([sku, quantity]) => ({ variantId: v(sku), quantity }))) }), { ip: null });

  await order({ name: "[Sample] Nimal Perera", phone: "0771110001", email: "nimal@example.test", address: "12 Example Road\nColombo 03", note: "Sample: please call after 5 pm." }, [["SMP-DT-180", 1], ["SMP-CH-01", 6]]);
  const confirmed = await order({ name: "[Sample] Dilani Fernando", phone: "0771110002", fulfilment: "pickup", paymentMethod: "at_showroom" }, [["SMP-SB-01", 1]]);
  const inProgress = await order({ name: "[Sample] Ruwan Jayasuriya", phone: "0771110003", address: "5 Sample Lane\nKandy", paymentMethod: "bank_transfer" }, [["SMP-DT-220", 1]]);
  const delivered = await order({ name: "[Sample] Kamal Silva", phone: "0771110010", address: "8 Sample Avenue\nGalle" }, [["SMP-ST-01", 4], ["SMP-BK-01", 1]]);
  const cancelled = await order({ name: "[Sample] Anoma Wijesinghe", phone: "0771110004", address: "3 Sample Street\nNegombo" }, [["SMP-CH-01", 2]]);

  await setOrderStatus(owner, confirmed.id, "confirmed");
  await setOrderStatus(owner, inProgress.id, "confirmed");
  await updateOrderDetails(owner, inProgress.id, { deliveryCharge: "8500", staffNote: "Sample: delivery booked for Friday." });
  await setOrderStatus(owner, inProgress.id, "in_progress");
  await setOrderPaid(owner, inProgress.id, true);
  await setOrderStatus(owner, delivered.id, "confirmed");
  await updateOrderDetails(owner, delivered.id, { deliveryCharge: "4500" });
  await setOrderStatus(owner, delivered.id, "delivered");
  await setOrderPaid(owner, delivered.id, true);
  await setOrderStatus(owner, cancelled.id, "cancelled", "Sample: customer changed their mind.");

  console.log("Sample data created: categories, products, a gallery project, messages and orders. All labelled [Sample].");
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
