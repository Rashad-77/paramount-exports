import "server-only";
import { outer } from "@/lib/db/outer";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { galleryImages, galleryProjects, productCategories, productImages, productVariants, products, uploadedFiles } from "@/lib/db/schema";
import { AppError, conflict, notFound, validation } from "@/lib/errors";
import {
  resolveSlug,
  type CategoryInput,
  type GalleryProjectInput,
  type ProductInput,
  type ProductUpdateInput,
  type VariantInput,
} from "@/lib/schemas/catalogue";
import { recordAudit } from "./audit";
import { linkUploads, publicFileUrl, verifyUploads } from "./files";
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
      productCount: sql<number>`count(${products.id}) FILTER (WHERE ${products.archivedAt} IS NULL)::int`,
    })
    .from(productCategories)
    .leftJoin(products, eq(products.categoryId, productCategories.id))
    .groupBy(productCategories.id)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
}

/** A category may sit under a group, never under another category and never under itself. */
async function assertParentUsable(tx: DbOrTx, parentId: string | undefined, selfId?: string) {
  if (!parentId) return;
  const bad = validation("Choose a group, or leave this as a group of its own.", { parentId: ["Choose a group, or leave this as a group of its own."] });
  if (parentId === selfId) throw bad;
  const [g] = await tx.select({ parentId: productCategories.parentId, archivedAt: productCategories.archivedAt }).from(productCategories).where(eq(productCategories.id, parentId)).limit(1);
  if (!g || g.parentId || g.archivedAt) throw bad;
  if (selfId) {
    const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(productCategories).where(eq(productCategories.parentId, selfId));
    if (n > 0) throw validation("This group has categories under it, so it cannot go under another group.", { parentId: ["This group has categories under it, so it cannot go under another group."] });
  }
}

export async function createCategory(actor: Actor, input: CategoryInput): Promise<string> {
  requirePermission(actor, "products:write");
  const slugValue = resolveSlug(input.slug, input.name);
  try {
    return await withTx(async (tx) => {
      await assertParentUsable(tx, input.parentId);
      const [c] = await tx
        .insert(productCategories)
        .values({ name: input.name, slug: slugValue, description: input.description ?? null, parentId: input.parentId ?? null, sortOrder: input.sortOrder, isActive: input.isActive })
        .returning({ id: productCategories.id });
      await recordAudit(tx, actor, { action: "category.created", entityType: "product_category", entityId: c!.id, after: { name: input.name, slug: slugValue } });
      return c!.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A category with that web address name already exists.");
    throw e;
  }
}

export async function updateCategory(actor: Actor, id: string, input: CategoryInput): Promise<void> {
  requirePermission(actor, "products:write");
  const slugValue = resolveSlug(input.slug, input.name);
  try {
    await withTx(async (tx) => {
      const [before] = await tx.select().from(productCategories).where(eq(productCategories.id, id)).for("update");
      if (!before) throw notFound("That category could not be found.");
      await assertParentUsable(tx, input.parentId, id);
      await tx
        .update(productCategories)
        .set({ name: input.name, slug: slugValue, description: input.description ?? null, parentId: input.parentId ?? null, sortOrder: input.sortOrder, isActive: input.isActive })
        .where(eq(productCategories.id, id));
      await recordAudit(tx, actor, { action: "category.updated", entityType: "product_category", entityId: id, before: { name: before.name, slug: before.slug, isActive: before.isActive }, after: { name: input.name, slug: slugValue, isActive: input.isActive } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A category with that web address name already exists.");
    throw e;
  }
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
    await tx.update(productCategories).set({ archivedAt: archived ? new Date() : null, isActive: archived ? false : c.isActive }).where(eq(productCategories.id, id));
    await recordAudit(tx, actor, { action: archived ? "category.archived" : "category.restored", entityType: "product_category", entityId: id });
  });
}

/* ───────────────────────────── products ───────────────────────────── */

export interface ProductListFilters {
  q?: string;
  status?: "published" | "draft" | "archived";
  categoryId?: string;
  page: number;
  pageSize: number;
}

export async function listProductsAdmin(actor: Actor, f: ProductListFilters) {
  requirePermission(actor, "products:view");
  const where: SQL[] = [];
  if (f.status === "archived") where.push(isNotNull(products.archivedAt));
  else {
    where.push(isNull(products.archivedAt));
    if (f.status === "published") where.push(eq(products.isPublished, true));
    if (f.status === "draft") where.push(eq(products.isPublished, false));
  }
  if (f.categoryId) where.push(eq(products.categoryId, f.categoryId));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(products.name, like), sql`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${outer(products.id)} AND v.sku ILIKE ${like})`)!);
  }
  const cond = and(...where);
  const db = getDb();
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        isPublished: products.isPublished,
        isFeatured: products.isFeatured,
        kind: products.kind,
        categoryName: productCategories.name,
        archivedAt: products.archivedAt,
        updatedAt: products.updatedAt,
        skus: sql<string>`coalesce((SELECT string_agg(v.sku, ', ' ORDER BY v.sort_order, v.sku) FROM product_variants v WHERE v.product_id = ${outer(products.id)}), '')`,
        imageCount: sql<number>`(SELECT count(*)::int FROM product_images i WHERE i.product_id = ${outer(products.id)})`,
      })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(cond)
      .orderBy(desc(products.updatedAt))
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
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.sortOrder), asc(productVariants.label)),
    db
      .select({ id: productImages.id, alt: productImages.altText, position: productImages.position, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
      .from(productImages)
      .innerJoin(uploadedFiles, eq(uploadedFiles.id, productImages.fileId))
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.position)),
  ]);
  return { product, variants, images: images.map((i) => ({ id: i.id, alt: i.alt, position: i.position, url: publicFileUrl({ bucket: i.bucket, objectKey: i.key }) })) };
}

async function assertCategoryUsable(tx: DbOrTx, categoryId: string) {
  const [c] = await tx.select({ id: productCategories.id, archivedAt: productCategories.archivedAt }).from(productCategories).where(eq(productCategories.id, categoryId)).limit(1);
  if (!c || c.archivedAt) throw validation("Choose an active category.", { categoryId: ["Choose an active category."] });
}

export async function createProduct(actor: Actor, input: ProductInput): Promise<string> {
  requirePermission(actor, "products:write");
  const slugValue = resolveSlug(input.slug, input.name);
  try {
    return await withTx(async (tx) => {
      await assertCategoryUsable(tx, input.categoryId);
      const [p] = await tx
        .insert(products)
        .values({
          slug: slugValue,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId,
          kind: input.kind,
          material: input.material ?? null,
          finish: input.finish ?? null,
          dimensions: input.dimensions ?? null,
          isPublished: input.isPublished,
          isFeatured: input.isFeatured,
          showAvailability: input.showAvailability,
          availability: input.availability ?? null,
          showPrice: input.showPrice,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          createdBy: actor.id,
        })
        .returning({ id: products.id });
      await tx.insert(productVariants).values({ productId: p!.id, sku: input.sku, label: "Standard", listPrice: input.listPrice ?? null });
      await recordAudit(tx, actor, { action: "product.created", entityType: "product", entityId: p!.id, after: { name: input.name, slug: slugValue, sku: input.sku, isPublished: input.isPublished } });
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
  const slugValue = resolveSlug(input.slug, input.name);
  try {
    await withTx(async (tx) => {
      const [before] = await tx.select().from(products).where(eq(products.id, id)).for("update");
      if (!before) throw notFound("That product could not be found.");
      await assertCategoryUsable(tx, input.categoryId);
      if (input.showPrice) {
        const [{ n } = { n: 0 }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(productVariants)
          .where(and(eq(productVariants.productId, id), eq(productVariants.isActive, true), isNotNull(productVariants.listPrice)));
        if (n === 0) throw validation("Add a price to at least one option, or untick “Show price publicly”.", { showPrice: ["No option has a price yet."] });
      }
      await tx
        .update(products)
        .set({
          slug: slugValue,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId,
          kind: input.kind,
          material: input.material ?? null,
          finish: input.finish ?? null,
          dimensions: input.dimensions ?? null,
          isPublished: input.isPublished,
          isFeatured: input.isFeatured,
          showAvailability: input.showAvailability,
          availability: input.availability ?? null,
          showPrice: input.showPrice,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
        })
        .where(eq(products.id, id));
      await recordAudit(tx, actor, {
        action: before.isPublished !== input.isPublished ? (input.isPublished ? "product.published" : "product.unpublished") : "product.updated",
        entityType: "product",
        entityId: id,
        before: { name: before.name, slug: before.slug, isPublished: before.isPublished, showPrice: before.showPrice },
        after: { name: input.name, slug: slugValue, isPublished: input.isPublished, showPrice: input.showPrice },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A product with that web address name already exists. Change the web address name.");
    throw e;
  }
}

export async function setProductArchived(actor: Actor, id: string, archived: boolean): Promise<void> {
  requirePermission(actor, "products:write");
  await withTx(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, id)).for("update");
    if (!p) throw notFound("That product could not be found.");
    await tx.update(products).set({ archivedAt: archived ? new Date() : null, isPublished: archived ? false : p.isPublished }).where(eq(products.id, id));
    await recordAudit(tx, actor, { action: archived ? "product.archived" : "product.restored", entityType: "product", entityId: id });
  });
}

export async function addVariant(actor: Actor, productId: string, input: VariantInput): Promise<void> {
  requirePermission(actor, "products:write");
  try {
    await withTx(async (tx) => {
      const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for("update");
      if (!p) throw notFound("That product could not be found.");
      const [{ m } = { m: 0 }] = await tx.select({ m: sql<number>`coalesce(max(${productVariants.sortOrder}), 0)::int` }).from(productVariants).where(eq(productVariants.productId, productId));
      const [v] = await tx
        .insert(productVariants)
        .values({ productId, sku: input.sku, label: input.label, listPrice: input.listPrice ?? null, salePrice: input.salePrice ?? null, isActive: input.isActive, sortOrder: m + 1 })
        .returning({ id: productVariants.id });
      await recordAudit(tx, actor, { action: "variant.created", entityType: "product_variant", entityId: v!.id, after: { productId, sku: input.sku, label: input.label } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("That SKU is already used by another product option.");
    throw e;
  }
}

export async function updateVariant(actor: Actor, variantId: string, input: VariantInput): Promise<void> {
  requirePermission(actor, "products:write");
  try {
    await withTx(async (tx) => {
      const [before] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
      if (!before) throw notFound("That product option could not be found.");
      await tx.update(productVariants).set({ sku: input.sku, label: input.label, listPrice: input.listPrice ?? null, salePrice: input.salePrice ?? null, isActive: input.isActive }).where(eq(productVariants.id, variantId));
      await recordAudit(tx, actor, {
        action: "variant.updated",
        entityType: "product_variant",
        entityId: variantId,
        before: { sku: before.sku, label: before.label, listPrice: before.listPrice, salePrice: before.salePrice, isActive: before.isActive },
        after: { sku: input.sku, label: input.label, listPrice: input.listPrice ?? null, salePrice: input.salePrice ?? null, isActive: input.isActive },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("That SKU is already used by another product option.");
    throw e;
  }
}

export async function attachProductImages(actor: Actor, productId: string, fileIds: string[], altText: string): Promise<void> {
  requirePermission(actor, "products:write");
  if (fileIds.length === 0) throw validation("Choose at least one image to add.", { fileIds: ["Upload at least one image."] });
  const verified = await verifyUploads(fileIds, "catalogue", actor);
  await withTx(async (tx) => {
    const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for("update");
    if (!p) throw notFound("That product could not be found.");
    const [{ m } = { m: -1 }] = await tx.select({ m: sql<number>`coalesce(max(${productImages.position}), -1)::int` }).from(productImages).where(eq(productImages.productId, productId));
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

export async function listGalleryAdmin(actor: Actor) {
  requirePermission(actor, "website:manage");
  return getDb()
    .select({
      id: galleryProjects.id,
      title: galleryProjects.title,
      isPublished: galleryProjects.isPublished,
      completedOn: galleryProjects.completedOn,
      archivedAt: galleryProjects.archivedAt,
      imageCount: sql<number>`(SELECT count(*)::int FROM gallery_images g WHERE g.project_id = ${outer(galleryProjects.id)})`,
    })
    .from(galleryProjects)
    .orderBy(asc(galleryProjects.sortOrder), desc(galleryProjects.createdAt));
}

export async function getGalleryProjectAdmin(actor: Actor, id: string) {
  requirePermission(actor, "website:manage");
  const db = getDb();
  const [project] = await db.select().from(galleryProjects).where(eq(galleryProjects.id, id)).limit(1);
  if (!project) throw notFound("That project could not be found.");
  const imgs = await db
    .select({ id: galleryImages.id, alt: galleryImages.altText, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
    .from(galleryImages)
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, galleryImages.fileId))
    .where(eq(galleryImages.projectId, id))
    .orderBy(asc(galleryImages.position));
  return { project, images: imgs.map((i) => ({ id: i.id, alt: i.alt, url: publicFileUrl({ bucket: i.bucket, objectKey: i.key }) })) };
}

export async function createGalleryProject(actor: Actor, input: GalleryProjectInput): Promise<string> {
  requirePermission(actor, "website:manage");
  return withTx(async (tx) => {
    const [g] = await tx
      .insert(galleryProjects)
      .values({ title: input.title, description: input.description ?? null, completedOn: input.completedOn ?? null, isPublished: input.isPublished, sortOrder: input.sortOrder, categoryId: input.categoryId ?? null })
      .returning({ id: galleryProjects.id });
    await recordAudit(tx, actor, { action: "gallery.created", entityType: "gallery_project", entityId: g!.id, after: { title: input.title } });
    return g!.id;
  });
}

export async function updateGalleryProject(actor: Actor, id: string, input: GalleryProjectInput): Promise<void> {
  requirePermission(actor, "website:manage");
  await withTx(async (tx) => {
    const [before] = await tx.select().from(galleryProjects).where(eq(galleryProjects.id, id)).for("update");
    if (!before) throw notFound("That project could not be found.");
    await tx
      .update(galleryProjects)
      .set({ title: input.title, description: input.description ?? null, completedOn: input.completedOn ?? null, isPublished: input.isPublished, sortOrder: input.sortOrder, categoryId: input.categoryId ?? null })
      .where(eq(galleryProjects.id, id));
    await recordAudit(tx, actor, { action: "gallery.updated", entityType: "gallery_project", entityId: id, before: { title: before.title, isPublished: before.isPublished }, after: { title: input.title, isPublished: input.isPublished } });
  });
}

export async function setGalleryArchived(actor: Actor, id: string, archived: boolean): Promise<void> {
  requirePermission(actor, "website:manage");
  await withTx(async (tx) => {
    const [g] = await tx.select().from(galleryProjects).where(eq(galleryProjects.id, id)).for("update");
    if (!g) throw notFound("That project could not be found.");
    await tx.update(galleryProjects).set({ archivedAt: archived ? new Date() : null, isPublished: archived ? false : g.isPublished }).where(eq(galleryProjects.id, id));
    await recordAudit(tx, actor, { action: archived ? "gallery.archived" : "gallery.restored", entityType: "gallery_project", entityId: id });
  });
}

export async function attachGalleryImages(actor: Actor, projectId: string, fileIds: string[], altText: string): Promise<void> {
  requirePermission(actor, "website:manage");
  if (fileIds.length === 0) throw validation("Choose at least one image to add.", { fileIds: ["Upload at least one image."] });
  const verified = await verifyUploads(fileIds, "gallery", actor);
  await withTx(async (tx) => {
    const [g] = await tx.select({ id: galleryProjects.id }).from(galleryProjects).where(eq(galleryProjects.id, projectId)).for("update");
    if (!g) throw notFound("That project could not be found.");
    const [{ m } = { m: -1 }] = await tx.select({ m: sql<number>`coalesce(max(${galleryImages.position}), -1)::int` }).from(galleryImages).where(eq(galleryImages.projectId, projectId));
    let pos = m + 1;
    await linkUploads(tx, verified, { type: "gallery_project", id: projectId });
    for (const f of verified) await tx.insert(galleryImages).values({ projectId, fileId: f.id, altText, position: pos++ });
    await recordAudit(tx, actor, { action: "gallery.images_added", entityType: "gallery_project", entityId: projectId, after: { count: verified.length } });
  });
}

export async function removeGalleryImage(actor: Actor, imageId: string): Promise<void> {
  requirePermission(actor, "website:manage");
  const fileId = await withTx(async (tx) => {
    const [img] = await tx.select().from(galleryImages).where(eq(galleryImages.id, imageId)).for("update");
    if (!img) throw notFound("That image could not be found.");
    await tx.delete(galleryImages).where(eq(galleryImages.id, imageId));
    await recordAudit(tx, actor, { action: "gallery.image_removed", entityType: "gallery_project", entityId: img.projectId });
    return img.fileId;
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
