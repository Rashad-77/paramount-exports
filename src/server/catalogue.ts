import "server-only";
import { randomBytes } from "node:crypto";
import Decimal from "decimal.js";
import { priceAfterDiscount } from "@/lib/sale";
import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { alias } from "drizzle-orm/pg-core";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { galleryPhotos, productCategories, productImages, productVariants, products, uploadedFiles } from "@/lib/db/schema";
import { AppError, conflict, notFound, validation } from "@/lib/errors";
import {
  MAX_PHOTOS,
  resolveSlug,
  type CategoryInput,
  GALLERY_AREAS,
  MAX_GALLERY_PHOTOS,
  type GalleryArea,
  type ProductInput,
  type ProductUpdateInput,
} from "@/lib/schemas/catalogue";
import { slugify } from "@/lib/contact";
import { legacyColumns, normalizeSpecs, type SpecEntry } from "@/lib/specifications";
import { persistSpecs } from "./specs";
import { recordAudit } from "./audit";
import { linkUploads, publicFileUrl, verifyUploads, type VerifiedFile } from "./files";
import type { BucketName } from "@/lib/storage";
import { getStorage } from "@/lib/storage";

/* ───────────────────────────── categories ───────────────────────────── */

/** Escape % and _ so user text matches literally inside LIKE patterns. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listCategories(actor: Actor) {
  requirePermission(actor, "products:view");
  return getDb()
    .select({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug,
      description: productCategories.description,
      parentId: productCategories.parentId,
      sortOrder: productCategories.sortOrder,
      isActive: productCategories.isActive,
      archivedAt: productCategories.archivedAt,
      bannerX: productCategories.bannerX,
      bannerY: productCategories.bannerY,
      bannerZoom: productCategories.bannerZoom,
      bannerBucket: uploadedFiles.bucket,
      bannerKey: uploadedFiles.objectKey,
      productCount: sql<number>`count(${products.id}) FILTER (WHERE ${products.archivedAt} IS NULL)::int`,
    })
    .from(productCategories)
    .leftJoin(products, eq(products.categoryId, productCategories.id))
    .leftJoin(uploadedFiles, eq(uploadedFiles.id, productCategories.bannerFileId))
    .groupBy(productCategories.id, uploadedFiles.id)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
}

/** A subcategory sits under a main category, never under another subcategory and never under itself. */
async function assertParentUsable(tx: DbOrTx, parentId: string | undefined, selfId?: string) {
  if (!parentId) return;
  const bad = validation("Choose a main category, or leave this as a main category.", { parentId: ["Choose a main category, or leave this as a main category."] });
  if (parentId === selfId) throw bad;
  const [g] = await tx.select({ parentId: productCategories.parentId, archivedAt: productCategories.archivedAt }).from(productCategories).where(eq(productCategories.id, parentId)).limit(1);
  if (!g || g.parentId || g.archivedAt) throw bad;
  if (selfId) {
    const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(productCategories).where(eq(productCategories.parentId, selfId));
    if (n > 0) throw validation("This category has subcategories under it, so it cannot become a subcategory.", { parentId: ["This category has subcategories under it, so it cannot become a subcategory."] });
  }
}

/** A category's web address name: the one typed in, or else made from its name (a second one with the same name gets -2, -3…). */
async function categorySlugFor(tx: DbOrTx, input: { slug?: string; name: string }): Promise<string> {
  if (input.slug) return resolveSlug(input.slug, input.name);
  const base = resolveSlug(undefined, input.name);
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 74)}-${n}`;
    const [hit] = await tx.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  return `${base.slice(0, 60)}-${randomBytes(3).toString("hex")}`;
}

async function insertCategory(tx: DbOrTx, actor: Actor, input: CategoryInput, banner?: VerifiedFile): Promise<string> {
  const slugValue = await categorySlugFor(tx, input);
  await assertParentUsable(tx, input.parentId);
  // Without a position it goes to the end of its list (main categories together, or the subcategories under one main category).
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [{ top } = { top: -1 }] = await tx
      .select({ top: sql<number>`coalesce(max(${productCategories.sortOrder}), -1)::int` })
      .from(productCategories)
      .where(input.parentId ? eq(productCategories.parentId, input.parentId) : isNull(productCategories.parentId));
    sortOrder = top + 1;
  }
  const [c] = await tx
    .insert(productCategories)
    .values({ name: input.name, slug: slugValue, description: input.description ?? null, parentId: input.parentId ?? null, sortOrder, isActive: input.isActive, bannerFileId: banner?.id ?? null, bannerX: input.bannerX ?? 50, bannerY: input.bannerY ?? 50, bannerZoom: input.bannerZoom ?? 100 })
    .returning({ id: productCategories.id });
  if (banner) await linkUploads(tx, [banner], { type: "category", id: c!.id });
  await recordAudit(tx, actor, { action: "category.created", entityType: "product_category", entityId: c!.id, after: { name: input.name, slug: slugValue } });
  return c!.id;
}

export async function createCategory(actor: Actor, input: CategoryInput): Promise<string> {
  requirePermission(actor, "products:write");
  try {
    return await withTx((tx) => insertCategory(tx, actor, input));
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A category with that web address name already exists.");
    throw e;
  }
}

/** A main category with subcategories made in the same step, or a single subcategory. All of it is saved, or none of it. */
export async function createCategoryWithSubs(actor: Actor, input: CategoryInput, subs: string[]): Promise<{ id: string; parentName: string | null }> {
  requirePermission(actor, "products:write");
  // Only a main category has a banner picture.
  const [banner] = input.bannerFileId && !input.parentId ? await verifyUploads([input.bannerFileId], "catalogue", actor) : [];
  try {
    return await withTx(async (tx) => {
      const id = await insertCategory(tx, actor, input, banner);
      let order = 0;
      for (const name of subs) {
        await insertCategory(tx, actor, { name, slug: undefined, description: undefined, parentId: id, sortOrder: order++, isActive: input.isActive });
      }
      let parentName: string | null = null;
      if (input.parentId) {
        const [p] = await tx.select({ name: productCategories.name }).from(productCategories).where(eq(productCategories.id, input.parentId)).limit(1);
        parentName = p?.name ?? null;
      }
      return { id, parentName };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A category with that web address name already exists.");
    throw e;
  }
}

export async function updateCategory(actor: Actor, id: string, input: CategoryInput): Promise<void> {
  requirePermission(actor, "products:write");
  const [banner] = input.bannerFileId && !input.parentId ? await verifyUploads([input.bannerFileId], "catalogue", actor) : [];
  let oldBanner: string | null = null;
  try {
    await withTx(async (tx) => {
      const [before] = await tx.select().from(productCategories).where(eq(productCategories.id, id)).for("update");
      if (!before) throw notFound("That category could not be found.");
      // The web address keeps its first value (links already shared must not break) unless one is typed in.
      const slugValue = input.slug ? resolveSlug(input.slug, input.name) : before.slug;
      await assertParentUsable(tx, input.parentId, id);
      // A subcategory has no banner; a main category keeps its picture unless a new one is added or it is taken away.
      const isMain = !input.parentId;
      const bannerFileId = !isMain ? null : banner ? banner.id : input.removeBanner ? null : before.bannerFileId;
      if (banner) await linkUploads(tx, [banner], { type: "category", id });
      if (before.bannerFileId && before.bannerFileId !== bannerFileId) oldBanner = before.bannerFileId;
      await tx
        .update(productCategories)
        .set({ name: input.name, slug: slugValue, description: input.description === undefined ? before.description : input.description, parentId: input.parentId ?? null, sortOrder: input.sortOrder ?? before.sortOrder, isActive: before.archivedAt === null, bannerFileId, bannerX: bannerFileId ? (input.bannerX ?? 50) : 50, bannerY: bannerFileId ? (input.bannerY ?? 50) : 50, bannerZoom: bannerFileId ? (input.bannerZoom ?? 100) : 100 })
        .where(eq(productCategories.id, id));
      await recordAudit(tx, actor, { action: "category.updated", entityType: "product_category", entityId: id, before: { name: before.name, slug: before.slug }, after: { name: input.name, slug: slugValue } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A category with that web address name already exists.");
    throw e;
  }
  if (oldBanner) await removeFileObject(oldBanner);
}

export async function setCategoryArchived(actor: Actor, id: string, archived: boolean): Promise<void> {
  requirePermission(actor, "products:write");
  await withTx(async (tx) => {
    const [c] = await tx.select().from(productCategories).where(eq(productCategories.id, id)).for("update");
    if (!c) throw notFound("That category could not be found.");
    if (archived) {
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(products)
        .where(and(eq(products.categoryId, id), isNull(products.archivedAt)));
      if (n > 0) throw conflict("Move or archive the products in this category first.");
    }
    await tx.update(productCategories).set({ archivedAt: archived ? new Date() : null, isActive: !archived }).where(eq(productCategories.id, id));
    await recordAudit(tx, actor, { action: archived ? "category.archived" : "category.restored", entityType: "product_category", entityId: id });
  });
}

/* ───────────────────────────── products ───────────────────────────── */

/** Every status a product can be filtered by on the staff list. Statuses of one kind add up (published or draft); kinds narrow each other. */
export const PRODUCT_STATUSES = ["published", "draft", "archived", "featured", "premium", "in_stock", "made_to_order", "sold"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface ProductListFilters {
  q?: string;
  statuses: ProductStatus[];
  categoryIds?: string[];
  page: number;
  pageSize: number;
}

export async function listProductsAdmin(actor: Actor, f: ProductListFilters) {
  requirePermission(actor, "products:view");
  const where: SQL[] = [];
  const has = (s: ProductStatus) => f.statuses.includes(s);

  // Published / draft / archived: any of those picked. Nothing picked: everything, archived included.
  const visibility: SQL[] = [];
  if (has("published")) visibility.push(and(isNull(products.archivedAt), eq(products.isPublished, true))!);
  if (has("draft")) visibility.push(and(isNull(products.archivedAt), eq(products.isPublished, false))!);
  if (has("archived")) visibility.push(isNotNull(products.archivedAt));
  if (visibility.length) where.push(or(...visibility)!);

  const flags: SQL[] = [];
  if (has("featured")) flags.push(eq(products.isFeatured, true));
  if (has("premium")) flags.push(eq(products.isPremium, true));
  if (flags.length) where.push(or(...flags)!);

  const availability = (["in_stock", "made_to_order", "sold"] as const).filter(has);
  if (availability.length) where.push(inArray(products.availability, has("made_to_order") ? [...availability, "on_request" as const] : availability));

  if (f.categoryIds?.length) {
    // A main category stands for every subcategory under it.
    const ids = sql.join(f.categoryIds.map((c) => sql`${c}::uuid`), sql`, `);
    where.push(or(inArray(products.categoryId, f.categoryIds), sql`${products.categoryId} IN (SELECT c.id FROM product_categories c WHERE c.parent_id IN (${ids}))`)!);
  }
  if (f.q) where.push(ilike(products.name, `%${escapeLike(f.q)}%`));
  const cond = and(...where);
  const db = getDb();
  const parent = alias(productCategories, "parent_category");
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        isPublished: products.isPublished,
        isFeatured: products.isFeatured,
        isPremium: products.isPremium,
        kind: products.kind,
        availability: products.availability,
        categoryName: productCategories.name,
        /** The main category above a subcategory; null when the product sits in a main category itself. */
        mainCategoryName: parent.name,
        archivedAt: products.archivedAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .leftJoin(parent, eq(parent.id, productCategories.parentId))
      .where(cond)
      .orderBy(sql`lower(${products.name})`, asc(products.name))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(products).where(cond),
  ]);
  const total = countRows[0]?.n ?? 0;
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export async function getProductAdmin(actor: Actor, id: string) {
  requirePermission(actor, "products:view");
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) throw notFound("That product could not be found.");
  const [variants, images] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt)),
    db
      .select({ id: productImages.id, alt: productImages.altText, position: productImages.position, x: productImages.focusX, y: productImages.focusY, z: productImages.focusZoom, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
      .from(productImages)
      .innerJoin(uploadedFiles, eq(uploadedFiles.id, productImages.fileId))
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.position)),
  ]);
  return { product, variants, images: images.map((i) => ({ id: i.id, alt: i.alt, position: i.position, x: i.x, y: i.y, z: i.z, url: publicFileUrl({ bucket: i.bucket, objectKey: i.key }) })) };
}

async function assertCategoryUsable(tx: DbOrTx, categoryId: string) {
  const [c] = await tx.select({ id: productCategories.id, archivedAt: productCategories.archivedAt }).from(productCategories).where(eq(productCategories.id, categoryId)).limit(1);
  if (!c || c.archivedAt) throw validation("Choose an active category.", { categoryId: ["Choose an active category."] });
}

/** The web address name is always made from the product name; a second product with the same name gets -2, -3… */
async function uniqueProductSlug(tx: DbOrTx, name: string): Promise<string> {
  const base = slugify(name) || "product";
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 74)}-${n}`;
    const [hit] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  return `${base.slice(0, 60)}-${randomBytes(3).toString("hex")}`;
}

/** The option codes are no longer typed in: one is made from the web address name. */
async function newSku(tx: DbOrTx, slugValue: string): Promise<string> {
  const base = slugValue.toUpperCase().slice(0, 40);
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const [hit] = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, candidate)).limit(1);
    if (!hit) return candidate;
  }
  return `${base}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** The older single-value fields, as specification rows, for a product saved without a specification list. */
function specsFromLegacy(input: { material?: string; finish?: string; dimensions?: string }): SpecEntry[] {
  const out: SpecEntry[] = [];
  if (input.material) out.push({ key: "material", label: "Material", type: "list", values: input.material.split(/,\s*/).filter(Boolean) });
  if (input.finish) out.push({ key: "finish", label: "Finish", type: "list", values: input.finish.split(/,\s*/).filter(Boolean) });
  if (input.dimensions) out.push({ key: "dimensions", label: "Dimensions", type: "dims", values: [input.dimensions] });
  return out;
}

type ProductFormInput = ProductInput | ProductUpdateInput;

/** What the form's fields mean for the product row. The staff form's visibility, availability and price decide what shows publicly. */
/** The price line from what the form sent: the regular price, or that price less the discount, with the regular price kept as the "original price". */
function priceLine(input: { listPrice?: string; discountKind?: string; discountValue?: string }) {
  const regular = input.listPrice ?? null;
  if (!regular || !input.discountKind || !input.discountValue) return { list: regular, compare: null as string | null, kind: null as string | null, value: null as string | null };
  const after = priceAfterDiscount(regular, input.discountKind, input.discountValue);
  if (!after) return { list: regular, compare: null as string | null, kind: null as string | null, value: null as string | null };
  return { list: after, compare: new Decimal(regular).toFixed(2), kind: input.discountKind, value: new Decimal(input.discountValue).toFixed(2) };
}

function resolveFields(input: ProductFormInput) {
  const staff = input.visibility !== undefined;
  const specs = input.specifications ? normalizeSpecs(input.specifications as SpecEntry[]) : null;
  const legacy = specs ? legacyColumns(specs) : { material: input.material ?? null, finish: input.finish ?? null, dimensions: input.dimensions ?? null, colour: null };
  return {
    staff,
    specs,
    legacy,
    isPublished: staff ? input.visibility === "published" : input.isPublished,
    archived: staff ? input.visibility === "archived" : null,
    showPrice: staff ? Boolean(input.listPrice) : input.showPrice,
    showAvailability: staff ? Boolean(input.availability) : input.showAvailability,
    /** In stock counts the stock; sold is nothing left; the other two are not counted. */
    stock: input.availability === "in_stock" ? (input.stockQuantity ?? null) : input.availability === "sold" ? 0 : null,
  };
}

/**
 * Makes the product's photos match the list the form sent: removes the ones left out, adds the new uploads, saves the order and
 * the thumbnail. Returns the files of removed photos, to delete from storage once the transaction has committed.
 */
/** One entry of the form's photo list: "id:<photo>" or "file:<upload>", then "@x,y" for where it sits in its frame. */
function parsePhotoItem(item: string): { kind: string; ref: string; x: number; y: number; z: number } {
  const colon = item.indexOf(":");
  const at = item.indexOf("@");
  const ref = item.slice(colon + 1, at < 0 ? undefined : at);
  const [rx, ry, rz] = at < 0 ? [] : item.slice(at + 1).split(",");
  const pct = (v: string | undefined) => Math.min(100, Math.max(0, Math.round(Number(v ?? 50)) || 0));
  const zoom = (v: string | undefined) => Math.min(300, Math.max(100, Math.round(Number(v ?? 100)) || 100));
  return { kind: item.slice(0, colon), ref, x: rx === undefined ? 50 : pct(rx), y: ry === undefined ? 50 : pct(ry), z: zoom(rz) };
}

async function syncPhotos(tx: DbOrTx, productId: string, name: string, items: string[], verified: VerifiedFile[]): Promise<string[]> {
  const existing = await tx.select().from(productImages).where(eq(productImages.productId, productId));
  const byId = new Map(existing.map((i) => [i.id, i]));
  const keep = new Set(items.map(parsePhotoItem).filter((i) => i.kind === "id").map((i) => i.ref));
  for (const id of keep) if (!byId.has(id)) throw validation("A photo on this page has changed. Reload the page and try again.", { photos: ["Reload the page and try again."] });
  const removed = existing.filter((i) => !keep.has(i.id));
  if (removed.length) await tx.delete(productImages).where(inArray(productImages.id, removed.map((r) => r.id)));
  await linkUploads(tx, verified, { type: "product", id: productId });
  const verifiedIds = new Set(verified.map((v) => v.id));
  const ids: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const { kind, ref, x, y, z } = parsePhotoItem(items[i]!);
    const alt = `${name}, photo ${i + 1}`;
    if (kind === "id") {
      await tx.update(productImages).set({ position: i, altText: alt, focusX: x, focusY: y, focusZoom: z }).where(eq(productImages.id, ref));
      ids.push(ref);
    } else {
      if (!verifiedIds.has(ref)) throw validation("A photo could not be attached. Upload it again.", { photos: ["Upload the photo again."] });
      const [row] = await tx.insert(productImages).values({ productId, fileId: ref, altText: alt, position: i, focusX: x, focusY: y, focusZoom: z }).returning({ id: productImages.id });
      ids.push(row!.id);
    }
  }
  // The first photo is always the thumbnail.
  const thumb = ids[0] ?? null;
  await tx.update(products).set({ thumbnailImageId: thumb }).where(eq(products.id, productId));
  return removed.map((r) => r.fileId);
}

const photoFileIds = (items: string[]) => items.map(parsePhotoItem).filter((i) => i.kind === "file").map((i) => i.ref);

export async function createProduct(actor: Actor, input: ProductInput): Promise<string> {
  requirePermission(actor, "products:write");
  const f = resolveFields(input);
  const line = priceLine(input);
  const verified = f.staff ? await verifyUploads(photoFileIds(input.photos), "catalogue", actor) : [];
  try {
    return await withTx(async (tx) => {
      await assertCategoryUsable(tx, input.categoryId);
      const slugValue = input.slug ? resolveSlug(input.slug, input.name) : await uniqueProductSlug(tx, input.name);
      const specs = await persistSpecs(tx, f.specs ?? specsFromLegacy({ material: input.material, finish: input.finish, dimensions: input.dimensions }));
      const [p] = await tx
        .insert(products)
        .values({
          slug: slugValue,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId,
          kind: input.kind,
          material: f.legacy.material,
          finish: f.legacy.finish,
          dimensions: f.legacy.dimensions,
          colour: f.legacy.colour,
          specifications: specs,
          shortDescription: input.shortDescription ?? null,
          discountKind: line.kind,
          discountValue: line.value,
          isPublished: f.isPublished && !f.archived,
          isFeatured: input.isFeatured,
          isPremium: input.isPremium,
          showAvailability: f.showAvailability,
          availability: input.availability ?? null,
          showPrice: f.showPrice,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          archivedAt: f.archived ? new Date() : null,
          createdBy: actor.id,
        })
        .returning({ id: products.id });
      const sku = input.sku ?? (await newSku(tx, slugValue));
      await tx.insert(productVariants).values({ productId: p!.id, sku, label: "Standard", listPrice: line.list, comparePrice: line.compare, stockQuantity: f.staff ? f.stock : (input.stockQuantity ?? null) });
      if (f.staff) await syncPhotos(tx, p!.id, input.name, input.photos, verified);
      await recordAudit(tx, actor, { action: "product.created", entityType: "product", entityId: p!.id, after: { name: input.name, slug: slugValue, sku, isPublished: f.isPublished } });
      return p!.id;
    });
  } catch (e) {
    if (isUniqueViolation(e, "product_variants_sku_unique")) throw new AppError("CONFLICT", "That SKU is already used by another product option.", { sku: ["That SKU is already in use."] });
    if (isUniqueViolation(e)) throw conflict("A product with that web address name already exists. Change the web address name.");
    throw e;
  }
}

export async function updateProduct(actor: Actor, id: string, input: ProductUpdateInput): Promise<void> {
  requirePermission(actor, "products:write");
  const f = resolveFields(input);
  const verified = f.staff ? await verifyUploads(photoFileIds(input.photos), "catalogue", actor) : [];
  const line = priceLine(input);
  let removedFiles: string[] = [];
  try {
    await withTx(async (tx) => {
      const [before] = await tx.select().from(products).where(eq(products.id, id)).for("update");
      if (!before) throw notFound("That product could not be found.");
      await assertCategoryUsable(tx, input.categoryId);
      if (!f.staff && input.showPrice) {
        const [{ n } = { n: 0 }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(productVariants)
          .where(and(eq(productVariants.productId, id), eq(productVariants.isActive, true), isNotNull(productVariants.listPrice)));
        if (n === 0) throw validation("Add a price to at least one option, or untick “Show price publicly”.", { showPrice: ["No option has a price yet."] });
      }
      // Without a specification list (the older form) only the fields that were sent change.
      const savedSpecs = f.specs ? await persistSpecs(tx, f.specs) : null;
      const specColumns = savedSpecs
        ? { specifications: savedSpecs, material: f.legacy.material, finish: f.legacy.finish, dimensions: f.legacy.dimensions, colour: f.legacy.colour }
        : { material: f.legacy.material, finish: f.legacy.finish, dimensions: f.legacy.dimensions };
      const wasArchived = before.archivedAt !== null;
      const nowPublished = f.archived ? false : f.isPublished;
      await tx
        .update(products)
        .set({
          // The web address name keeps its first value so links already shared do not break; an older form may still set it.
          ...(input.slug ? { slug: resolveSlug(input.slug, input.name) } : {}),
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId,
          kind: input.kind,
          ...specColumns,
          shortDescription: input.shortDescription ?? null,
          ...(f.staff ? { discountKind: line.kind, discountValue: line.value } : {}),
          isPublished: nowPublished,
          isFeatured: input.isFeatured,
          isPremium: input.isPremium,
          showAvailability: f.showAvailability,
          availability: input.availability ?? null,
          showPrice: f.showPrice,
          ...(f.staff ? { archivedAt: f.archived ? (before.archivedAt ?? new Date()) : null } : {}),
          ...(f.staff ? {} : { seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null }),
        })
        .where(eq(products.id, id));
      if (f.staff) {
        // The product's one price line: the first option. Further options made earlier are left as they are.
        const [first] = await tx.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt)).limit(1);
        if (first) {
          await tx.update(productVariants).set({ listPrice: line.list, comparePrice: line.compare, stockQuantity: f.stock }).where(eq(productVariants.id, first.id));
        } else {
          await tx.insert(productVariants).values({ productId: id, sku: await newSku(tx, before.slug), label: "Standard", listPrice: line.list, comparePrice: line.compare, stockQuantity: f.stock });
        }
        removedFiles = await syncPhotos(tx, id, input.name, input.photos, verified);
      }
      const archiveChanged = f.staff && wasArchived !== Boolean(f.archived);
      await recordAudit(tx, actor, {
        action: archiveChanged ? (f.archived ? "product.archived" : "product.restored") : before.isPublished !== nowPublished ? (nowPublished ? "product.published" : "product.unpublished") : "product.updated",
        entityType: "product",
        entityId: id,
        before: { name: before.name, slug: before.slug, isPublished: before.isPublished, showPrice: before.showPrice },
        after: { name: input.name, isPublished: nowPublished, showPrice: f.showPrice },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A product with that web address name already exists. Change the web address name.");
    throw e;
  }
  for (const fileId of removedFiles) await removeFileObject(fileId);
}

/** Archive or restore several products at once (the staff list's edit mode). Returns how many changed. */
export async function setProductsArchived(actor: Actor, ids: string[], archived: boolean): Promise<number> {
  requirePermission(actor, "products:write");
  if (ids.length === 0) return 0;
  return withTx(async (tx) => {
    const rows = await tx.select().from(products).where(inArray(products.id, ids)).for("update");
    let changed = 0;
    for (const p of rows) {
      if (archived === (p.archivedAt !== null)) continue;
      await tx.update(products).set({ archivedAt: archived ? new Date() : null, isPublished: archived ? false : p.isPublished }).where(eq(products.id, p.id));
      await recordAudit(tx, actor, { action: archived ? "product.archived" : "product.restored", entityType: "product", entityId: p.id });
      changed++;
    }
    return changed;
  });
}

/** Puts draft products on the website. Archived products are skipped (restore them first); already published ones are left as they are. */
export async function setProductsPublished(actor: Actor, ids: string[]): Promise<number> {
  requirePermission(actor, "products:write");
  if (ids.length === 0) return 0;
  return withTx(async (tx) => {
    const rows = await tx.select().from(products).where(inArray(products.id, ids)).for("update");
    // Nothing is published if any of these has no picture: customers must never see a product without one.
    const toPublish = rows.filter((p) => !p.isPublished && !p.archivedAt);
    if (toPublish.length > 0) {
      const withPhoto = new Set((await tx.select({ id: productImages.productId }).from(productImages).where(inArray(productImages.productId, toPublish.map((p) => p.id)))).map((r) => r.id));
      const without = toPublish.filter((p) => !withPhoto.has(p.id)).map((p) => p.name);
      if (without.length > 0) throw validation(`Nothing was published. Add at least one photo first to: ${without.slice(0, 5).join(", ")}${without.length > 5 ? ` and ${without.length - 5} more` : ""}.`);
    }
    let changed = 0;
    for (const p of rows) {
      if (p.isPublished || p.archivedAt) continue;
      await tx.update(products).set({ isPublished: true }).where(eq(products.id, p.id));
      await recordAudit(tx, actor, { action: "product.published", entityType: "product", entityId: p.id });
      changed++;
    }
    return changed;
  });
}

/** Takes published products off the website without archiving them; they go back to draft. */
export async function setProductsUnpublished(actor: Actor, ids: string[]): Promise<number> {
  requirePermission(actor, "products:write");
  if (ids.length === 0) return 0;
  return withTx(async (tx) => {
    const rows = await tx.select().from(products).where(inArray(products.id, ids)).for("update");
    let changed = 0;
    for (const p of rows) {
      if (!p.isPublished || p.archivedAt) continue;
      await tx.update(products).set({ isPublished: false }).where(eq(products.id, p.id));
      await recordAudit(tx, actor, { action: "product.unpublished", entityType: "product", entityId: p.id });
      changed++;
    }
    return changed;
  });
}

/**
 * Permanently deletes products with their options and photographs. Orders and quotations that mention them keep the names and prices
 * they were placed with; only the link to the product is dropped. Customers' saved-for-later lists lose the product.
 */
export async function deleteProducts(actor: Actor, ids: string[]): Promise<number> {
  requirePermission(actor, "products:write");
  if (ids.length === 0) return 0;
  const files: string[] = [];
  const count = await withTx(async (tx) => {
    const rows = await tx.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, ids)).for("update");
    if (rows.length === 0) return 0;
    const found = rows.map((r) => r.id);
    const imgs = await tx.select({ fileId: productImages.fileId }).from(productImages).where(inArray(productImages.productId, found));
    files.push(...imgs.map((i) => i.fileId));
    await tx.delete(productImages).where(inArray(productImages.productId, found));
    await tx.delete(productVariants).where(inArray(productVariants.productId, found));
    await tx.delete(products).where(inArray(products.id, found));
    for (const r of rows) await recordAudit(tx, actor, { action: "product.deleted", entityType: "product", entityId: r.id, before: { name: r.name } });
    return rows.length;
  });
  for (const fileId of files) await removeFileObject(fileId);
  return count;
}

export async function setProductArchived(actor: Actor, id: string, archived: boolean): Promise<void> {
  await setProductsArchived(actor, [id], archived);
}

export async function attachProductImages(actor: Actor, productId: string, fileIds: string[], altText: string): Promise<void> {
  requirePermission(actor, "products:write");
  if (fileIds.length === 0) throw validation("Choose at least one image to add.", { fileIds: ["Upload at least one image."] });
  const verified = await verifyUploads(fileIds, "catalogue", actor);
  await withTx(async (tx) => {
    const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for("update");
    if (!p) throw notFound("That product could not be found.");
    const [{ m, n } = { m: -1, n: 0 }] = await tx
      .select({ m: sql<number>`coalesce(max(${productImages.position}), -1)::int`, n: sql<number>`count(*)::int` })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    if (n + verified.length > MAX_PHOTOS) throw validation(`A product can have up to ${MAX_PHOTOS} photos.`, { fileIds: [`A product can have up to ${MAX_PHOTOS} photos.`] });
    let pos = m + 1;
    await linkUploads(tx, verified, { type: "product", id: productId });
    for (const f of verified) await tx.insert(productImages).values({ productId, fileId: f.id, altText, position: pos++ });
    await recordAudit(tx, actor, { action: "product.images_added", entityType: "product", entityId: productId, after: { count: verified.length } });
  });
}

async function removeFileObject(fileId: string) {
  const db = getDb();
  const [f] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  if (!f) return;
  await getStorage().remove(f.bucket as BucketName, f.objectKey).catch(() => undefined);
  await db.update(uploadedFiles).set({ status: "purged" }).where(eq(uploadedFiles.id, fileId));
}

export async function removeProductImage(actor: Actor, imageId: string): Promise<void> {
  requirePermission(actor, "products:write");
  const fileId = await withTx(async (tx) => {
    const [img] = await tx.select().from(productImages).where(eq(productImages.id, imageId)).for("update");
    if (!img) throw notFound("That image could not be found.");
    await tx.delete(productImages).where(eq(productImages.id, imageId));
    await recordAudit(tx, actor, { action: "product.image_removed", entityType: "product", entityId: img.productId });
    return img.fileId;
  });
  await removeFileObject(fileId);
}

export async function makeMainImage(actor: Actor, imageId: string): Promise<void> {
  requirePermission(actor, "products:write");
  await withTx(async (tx) => {
    const [img] = await tx.select().from(productImages).where(eq(productImages.id, imageId)).for("update");
    if (!img) throw notFound("That image could not be found.");
    const all = await tx.select().from(productImages).where(eq(productImages.productId, img.productId)).orderBy(asc(productImages.position));
    const ordered = [img, ...all.filter((i) => i.id !== imageId)];
    for (let i = 0; i < ordered.length; i++) await tx.update(productImages).set({ position: i }).where(eq(productImages.id, ordered[i]!.id));
  });
}

/* ───────────────────────────── gallery ───────────────────────────── */

/** Both gallery sections with their photographs, in the order they are shown. */
export async function listGalleryPhotosAdmin(actor: Actor): Promise<Record<GalleryArea, Array<{ id: string; alt: string; url: string }>>> {
  requirePermission(actor, "website:manage");
  const rows = await getDb()
    .select({ id: galleryPhotos.id, area: galleryPhotos.area, alt: galleryPhotos.altText, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
    .from(galleryPhotos)
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, galleryPhotos.fileId))
    .orderBy(asc(galleryPhotos.position), asc(galleryPhotos.createdAt));
  const out = Object.fromEntries(GALLERY_AREAS.map((a) => [a, [] as Array<{ id: string; alt: string; url: string }>])) as Record<GalleryArea, Array<{ id: string; alt: string; url: string }>>;
  for (const r of rows) if ((GALLERY_AREAS as readonly string[]).includes(r.area)) out[r.area as GalleryArea].push({ id: r.id, alt: r.alt, url: publicFileUrl({ bucket: r.bucket, objectKey: r.key }) });
  return out;
}

export async function addGalleryPhotos(actor: Actor, area: GalleryArea, fileIds: string[]): Promise<void> {
  requirePermission(actor, "website:manage");
  if (fileIds.length === 0) throw validation("Choose at least one photo to add.", { fileIds: ["Upload at least one photo."] });
  const verified = await verifyUploads(fileIds, "gallery", actor);
  await withTx(async (tx) => {
    const [{ m, n } = { m: -1, n: 0 }] = await tx
      .select({ m: sql<number>`coalesce(max(${galleryPhotos.position}), -1)::int`, n: sql<number>`count(*)::int` })
      .from(galleryPhotos)
      .where(eq(galleryPhotos.area, area));
    if (n + verified.length > MAX_GALLERY_PHOTOS) throw validation(`A section can hold up to ${MAX_GALLERY_PHOTOS} photos.`, { fileIds: [`A section can hold up to ${MAX_GALLERY_PHOTOS} photos.`] });
    let pos = m + 1;
    const alt = area === "showroom" ? "Photograph of our showroom" : "Photograph of our workshop";
    await linkUploads(tx, verified, { type: "gallery", id: area });
    for (const f of verified) await tx.insert(galleryPhotos).values({ area, fileId: f.id, altText: alt, position: pos++ });
    await recordAudit(tx, actor, { action: "gallery.photos_added", entityType: "gallery", entityId: area, after: { count: verified.length } });
  });
}

export async function removeGalleryPhoto(actor: Actor, photoId: string): Promise<void> {
  requirePermission(actor, "website:manage");
  const fileId = await withTx(async (tx) => {
    const [photo] = await tx.select().from(galleryPhotos).where(eq(galleryPhotos.id, photoId)).for("update");
    if (!photo) throw notFound("That photo could not be found.");
    await tx.delete(galleryPhotos).where(eq(galleryPhotos.id, photoId));
    await recordAudit(tx, actor, { action: "gallery.photo_removed", entityType: "gallery", entityId: photo.area });
    return photo.fileId;
  });
  await removeFileObject(fileId);
}

/** Active, non-archived product options for pickers (quotation / order editors). */
export async function listVariantOptions(actor: Actor): Promise<Array<{ id: string; label: string; sku: string; price: string | null; name: string }>> {
  requirePermission(actor, "products:view");
  const rows = await getDb()
    .select({ id: productVariants.id, sku: productVariants.sku, option: productVariants.label, price: productVariants.listPrice, name: products.name })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.isActive, true), isNull(products.archivedAt)))
    .orderBy(asc(products.name), asc(productVariants.sortOrder));
  return rows.map((r) => ({ id: r.id, sku: r.sku, price: r.price, name: r.name, label: `${r.name}${r.option !== "Standard" ? ` — ${r.option}` : ""} (${r.sku})` }));
}

/** Archive or restore several categories at once. A category that still has products in it is skipped when archiving. Returns how many changed. */
export async function setCategoriesArchived(actor: Actor, ids: string[], archived: boolean): Promise<{ changed: number; subs: number; skipped: string[] }> {
  requirePermission(actor, "products:write");
  const skipped: string[] = [];
  let changed = 0;
  let subs = 0;
  for (const id of ids) {
    try {
      const [before] = await getDb().select({ parentId: productCategories.parentId }).from(productCategories).where(eq(productCategories.id, id)).limit(1);
      await setCategoryArchived(actor, id, archived);
      changed++;
      if (before?.parentId) subs++;
    } catch (e) {
      if (e instanceof AppError && e.code === "CONFLICT") {
        const [c] = await getDb().select({ name: productCategories.name }).from(productCategories).where(eq(productCategories.id, id)).limit(1);
        skipped.push(c?.name ?? "A category");
      } else throw e;
    }
  }
  return { changed, subs, skipped };
}

/** Puts the main categories in the given order (first id first). Their display order numbers become 0, 1, 2… */
export async function reorderMainCategories(actor: Actor, ids: string[]): Promise<number> {
  requirePermission(actor, "products:write");
  if (ids.length === 0) return 0;
  return withTx(async (tx) => {
    const rows = await tx.select({ id: productCategories.id, parentId: productCategories.parentId }).from(productCategories).where(inArray(productCategories.id, ids)).for("update");
    if (rows.length !== ids.length || rows.some((r) => r.parentId)) throw validation("Only main categories can be put in order here.");
    for (const [i, id] of ids.entries()) await tx.update(productCategories).set({ sortOrder: i }).where(eq(productCategories.id, id));
    await recordAudit(tx, actor, { action: "category.reordered", entityType: "product_category", entityId: ids[0]!, after: { order: ids } });
    return ids.length;
  });
}

/** Permanently deletes categories that have no products (archived ones included) and no categories under them. Returns how many were deleted and the names left alone. */
export async function deleteCategories(actor: Actor, ids: string[]): Promise<{ deleted: number; subs: number; kept: string[] }> {
  requirePermission(actor, "products:write");
  const kept: string[] = [];
  let deleted = 0;
  let subs = 0;
  // Subcategories go first, so a main category ticked together with its subcategories can be deleted in the same go.
  const parents = new Map((await getDb().select({ id: productCategories.id, parentId: productCategories.parentId }).from(productCategories).where(inArray(productCategories.id, ids))).map((r) => [r.id, r.parentId]));
  const ordered = [...ids].sort((a, b) => Number(Boolean(parents.get(b))) - Number(Boolean(parents.get(a))));
  for (const id of ordered) {
    await withTx(async (tx) => {
      const [c] = await tx.select().from(productCategories).where(eq(productCategories.id, id)).for("update");
      if (!c) return;
      const [{ n: productCount } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.categoryId, id));
      const [{ n: kidCount } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(productCategories).where(eq(productCategories.parentId, id));
      if (productCount > 0 || kidCount > 0) {
        kept.push(c.name);
        return;
      }
      await tx.delete(productCategories).where(eq(productCategories.id, id));
      await recordAudit(tx, actor, { action: "category.deleted", entityType: "product_category", entityId: id, before: { name: c.name, slug: c.slug } });
      deleted++;
      if (c.parentId) subs++;
    });
  }
  return { deleted, subs, kept };
}
