import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { productSchema, productUpdateSchema, variantSchema } from "@/lib/schemas/catalogue";
import {
  addVariant,
  attachGalleryImages,
  attachProductImages,
  createCategory,
  createGalleryProject,
  createProduct,
  listProductsAdmin,
  makeMainImage,
  removeProductImage,
  setCategoryArchived,
  setProductArchived,
  updateProduct,
  updateVariant,
} from "@/server/catalogue";
import { getPublicProduct, listGalleryProjects, listPublicCategories, listPublicProducts } from "@/server/catalogue-public";
import { hasTestDb } from "../helpers/db";
import { JPEG, makeActor, setupApp, uploadTestFile } from "../helpers/app";

const cat = (name: string, extra = {}) => ({ name, slug: undefined, description: undefined, sortOrder: 0, isActive: true, ...extra });
const upd = (o: Record<string, unknown>) => {
  const r = productUpdateSchema.safeParse({ kind: "stocked", ...o });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};
const prod = (o: Record<string, unknown>) => {
  const r = productSchema.safeParse({ kind: "stocked", sku: "SKU-1", ...o });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe.skipIf(!hasTestDb)("catalogue (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let manager: Actor, outsider: Actor, inactive: Actor;
  let tablesId: string, chairsId: string;

  beforeAll(async () => {
    t = await setupApp();
    manager = await makeActor(t, ["staff"]);
    outsider = await makeActor(t, []);
    inactive = await makeActor(t, ["staff"], "Gone Person", { active: false });
    tablesId = await createCategory(manager, cat("Dining Tables"));
    chairsId = await createCategory(manager, cat("Chairs", { sortOrder: 1 }));
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("derives a web address from the name and rejects duplicates", async () => {
    await expect(createCategory(manager, cat("Dining Tables"))).rejects.toMatchObject({ code: "CONFLICT" });
    const [c] = await t.sql`SELECT slug FROM product_categories WHERE id = ${tablesId}`;
    expect(c!.slug).toBe("dining-tables");
    await expect(createCategory(manager, cat("!!!"))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("only active staff and owners use the catalogue; people with no role or a switched-off account are refused", async () => {
    for (const nobody of [outsider, inactive]) {
      await expect(createCategory(nobody, cat("Nope"))).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(createProduct(nobody, prod({ name: "X", categoryId: tablesId, sku: "X-1" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(listProductsAdmin(nobody, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(listProductsAdmin(manager, { page: 1, pageSize: 10 })).resolves.toBeTruthy();
  });

  it("keeps products hidden until published, and hides price/availability unless approved", async () => {
    const id = await createProduct(manager, prod({ name: "Teak Dining Table", categoryId: tablesId, sku: "TDT-180", listPrice: "125000", material: "Teak", dimensions: "W180 x D90 x H75 cm", description: "A table." }));
    expect((await listPublicProducts({})).items.map((i) => i.slug)).not.toContain("teak-dining-table");
    expect(await getPublicProduct("teak-dining-table")).toBeNull();

    await updateProduct(manager, id, upd({ name: "Teak Dining Table", categoryId: tablesId, isPublished: "on", material: "Teak" }));
    const pub = await getPublicProduct("teak-dining-table");
    expect(pub).toMatchObject({ name: "Teak Dining Table", availability: null });
    expect(pub!.variants[0]).toMatchObject({ sku: "TDT-180", price: null }); // price not approved for display
    const [card] = (await listPublicProducts({})).items;
    expect(card).toMatchObject({ fromPrice: null, availability: null });

    await updateProduct(manager, id, upd({ name: "Teak Dining Table", categoryId: tablesId, isPublished: "on", material: "Teak", showPrice: "on", showAvailability: "on", availability: "made_to_order" }));
    const pub2 = await getPublicProduct("teak-dining-table");
    expect(pub2!.variants[0]!.price).toBe("125000.00"); // variant price unchanged by product edit
    expect(pub2!.availability).toBe("Made to order");
  });

  it("refuses to show a price publicly when no option has one", async () => {
    const id = await createProduct(manager, prod({ name: "Unpriced Stool", categoryId: tablesId, sku: "US-1" }));
    await expect(updateProduct(manager, id, upd({ name: "Unpriced Stool", categoryId: tablesId, showPrice: "on" }))).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { showPrice: expect.any(Array) } });
    expect(productSchema.safeParse({ kind: "stocked", sku: "S", name: "S", categoryId: tablesId, showPrice: "on" }).success).toBe(false);
  });

  it("never exposes archived products or those in archived categories", async () => {
    const id = await createProduct(manager, prod({ name: "Oak Chair", categoryId: chairsId, sku: "OC-1", isPublished: "on" }));
    expect((await listPublicProducts({ category: "chairs" })).items).toHaveLength(1);
    await expect(setCategoryArchived(manager, chairsId, true)).rejects.toMatchObject({ code: "CONFLICT" }); // still has a product
    await setProductArchived(manager, id, true);
    expect((await listPublicProducts({ category: "chairs" })).items).toHaveLength(0);
    expect(await getPublicProduct("oak-chair")).toBeNull();
    await setProductArchived(manager, id, false);
    const [row] = await t.sql`SELECT is_published FROM products WHERE id = ${id}`;
    expect(row!.is_published).toBe(false); // restoring does not silently re-publish
    await setProductArchived(manager, id, true);
    await setCategoryArchived(manager, chairsId, true);
    expect((await listPublicCategories()).map((c) => c.slug)).not.toContain("chairs");
  });

  it("enforces unique SKUs across products and options", async () => {
    await expect(createProduct(manager, prod({ name: "Another", categoryId: tablesId, sku: "TDT-180" }))).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { sku: expect.any(Array) } });
    const id = await createProduct(manager, prod({ name: "Coffee Table", categoryId: tablesId, sku: "CT-1", isPublished: "on" }));
    await addVariant(manager, id, { sku: "CT-1-DK", label: "Dark finish", listPrice: undefined, isActive: true });
    await expect(addVariant(manager, id, { sku: "CT-1-DK", label: "Dup", listPrice: undefined, isActive: true })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getPublicProduct("coffee-table"))!.variants.map((v) => v.label)).toEqual(["Standard", "Dark finish"]);
  });

  it("shows a sale price only below the normal price, and only when prices are public", async () => {
    const id = await createProduct(manager, prod({ name: "Sale Stool", categoryId: tablesId, sku: "SS-1", listPrice: "1000", isPublished: "on", showPrice: "on" }));
    const [v] = await t.sql`SELECT id FROM product_variants WHERE product_id = ${id}`;
    const base = { sku: "SS-1", label: "Standard", listPrice: "1000", isActive: "on" };
    expect(variantSchema.safeParse({ ...base, salePrice: "1000" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...base, listPrice: "", salePrice: "500" }).success).toBe(false);
    const ok = variantSchema.parse({ ...base, salePrice: "750" });
    await updateVariant(manager, v!.id, ok);
    const card = (await listPublicProducts({ q: "Sale Stool" })).items[0]!;
    expect([card.fromPrice, card.salePrice]).toEqual(["1000.00", "750.00"]);
    expect((await getPublicProduct("sale-stool"))!.variants[0]!.salePrice).toBe("750.00");
    // The database refuses a sale price that is not below the list price, whatever the caller sends.
    await expect(updateVariant(manager, v!.id, { ...ok, salePrice: "1200.00" })).rejects.toThrow();
  });

  it("searches by name, material and SKU, treating % and _ literally", async () => {
    expect((await listPublicProducts({ q: "teak" })).items.map((i) => i.slug)).toContain("teak-dining-table");
    expect((await listPublicProducts({ q: "CT-1-DK" })).items.map((i) => i.slug)).toEqual(["coffee-table"]);
    expect((await listPublicProducts({ q: "%" })).items).toHaveLength(0);
    expect((await listPublicProducts({ q: "_" })).items).toHaveLength(0);
    expect((await listPublicProducts({ material: "Teak" })).items).toHaveLength(1);
  });

  it("attaches, reorders and removes product images; public gets public URLs only", async () => {
    const [p] = await t.sql`SELECT id FROM products WHERE slug = 'teak-dining-table'`;
    const f1 = await uploadTestFile("catalogue", JPEG, "image/jpeg", { actor: manager });
    const f2 = await uploadTestFile("catalogue", JPEG, "image/jpeg", { actor: manager });
    await attachProductImages(manager, p!.id, [f1, f2], "Teak dining table, three-quarter view");
    let pub = await getPublicProduct("teak-dining-table");
    expect(pub!.images).toHaveLength(2);
    expect(pub!.images[0]!.url).toMatch(/^\/api\/files\/public\/catalogue\/\d{4}\/\d{2}\/[0-9a-f]{32}\.jpg\?b=public-media$/);
    expect(pub!.images[0]!.alt).toContain("Teak");

    await makeMainImage(manager, pub!.images[1]!.id);
    const after = await getPublicProduct("teak-dining-table");
    expect(after!.images[0]!.id).toBe(pub!.images[1]!.id);

    await removeProductImage(manager, after!.images[0]!.id);
    pub = await getPublicProduct("teak-dining-table");
    expect(pub!.images).toHaveLength(1);
    const [purged] = await t.sql`SELECT count(*)::int AS n FROM uploaded_files WHERE status = 'purged' AND purpose = 'catalogue'`;
    expect(purged!.n).toBe(1);

    // a catalogue upload by someone without the permission cannot even be requested
    await expect(uploadTestFile("catalogue", JPEG, "image/jpeg", { actor: outsider })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows only published gallery projects", async () => {
    const draft = await createGalleryProject(manager, { title: "Draft project", description: undefined, completedOn: undefined, isPublished: false, sortOrder: 0 });
    const live = await createGalleryProject(manager, { title: "Live project", description: "Built for a client", completedOn: "2026-05-01", isPublished: true, sortOrder: 0 });
    const f = await uploadTestFile("gallery", JPEG, "image/jpeg", { actor: manager });
    await attachGalleryImages(manager, live, [f], "Finished sideboard");
    await attachGalleryImages(manager, draft, [], "x").catch((e) => expect(e.code).toBe("VALIDATION"));
    const list = await listGalleryProjects();
    expect(list.map((p) => p.title)).toEqual(["Live project"]);
    expect(list[0]!.images[0]!.alt).toBe("Finished sideboard");
  });

  it("paginates the public list", async () => {
    for (let i = 0; i < 14; i++) await createProduct(manager, prod({ name: `Bench ${i}`, categoryId: tablesId, sku: `BN-${i}`, isPublished: "on" }));
    const p1 = await listPublicProducts({ page: 1 });
    const p2 = await listPublicProducts({ page: 2 });
    expect(p1.items).toHaveLength(12);
    expect(p1.pageCount).toBeGreaterThanOrEqual(2);
    expect(p2.items.length).toBeGreaterThan(0);
    expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(p1.items.length + p2.items.length);
  });
});
