import { outer } from "@/lib/db/outer";
import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, exists, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { hasDatabase } from "@/lib/env";
import { galleryImages, galleryProjects, productCategories, productImages, productVariants, products, uploadedFiles } from "@/lib/db/schema";
import type { CatalogueSort } from "@/lib/catalogue-sort";
import { AVAILABILITY_LABEL } from "@/lib/schemas/catalogue";
import { moneyString } from "@/lib/money";
import { alias } from "drizzle-orm/pg-core";
import { publicFileUrl } from "./files";
import { CATALOGUE_REVALIDATE, CATALOGUE_TAG } from "./catalogue-cache";

/**
 * Read-only queries behind the public website. They take no actor because they expose ONLY published,
 * non-archived content, and only the fields the business has approved for public display
 * (price / availability are hidden unless explicitly switched on per product).
 */

const PAGE_SIZE = 24;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// A subcategory is only shown while the main category it sits under is shown too.
const parentShown = sql`(${productCategories.parentId} IS NULL OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.id = ${productCategories.parentId} AND pc.is_active AND pc.archived_at IS NULL))`;
const visible = and(eq(products.isPublished, true), isNull(products.archivedAt), eq(productCategories.isActive, true), isNull(productCategories.archivedAt), parentShown);

export interface PublicCard {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  material: string | null;
  dimensions: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  fromPrice: string | null;
  /** The price before the sale, when the lowest-priced option is on sale. */
  fromCompare: string | null;
  availability: string | null;
  /** Added to the catalogue within the last month. */
  isNew: boolean;
}

/** The photo a card or list shows for each product: the one chosen as the thumbnail, or else the first. */
export async function firstImages(productIds: string[]): Promise<Map<string, { url: string; alt: string }>> {
  if (productIds.length === 0) return new Map();
  const db = getDb();
  const [rows, thumbs] = await Promise.all([
    db
      .select({ id: productImages.id, productId: productImages.productId, alt: productImages.altText, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey, position: productImages.position })
      .from(productImages)
      .innerJoin(uploadedFiles, eq(uploadedFiles.id, productImages.fileId))
      .where(and(inArray(productImages.productId, productIds), eq(uploadedFiles.status, "linked")))
      .orderBy(asc(productImages.position)),
    db.select({ id: products.id, thumb: products.thumbnailImageId }).from(products).where(inArray(products.id, productIds)),
  ]);
  const thumbOf = new Map(thumbs.map((t) => [t.id, t.thumb]));
  const out = new Map<string, { url: string; alt: string }>();
  const toEntry = (r: (typeof rows)[number]) => ({ url: publicFileUrl({ bucket: r.bucket, objectKey: r.key }), alt: r.alt });
  for (const r of rows) if (r.id === thumbOf.get(r.productId)) out.set(r.productId, toEntry(r));
  for (const r of rows) if (!out.has(r.productId)) out.set(r.productId, toEntry(r));
  return out;
}

/** A product counts as new for this many days after it is added. */
const NEW_FOR_DAYS = 30;

async function toCards(rows: Array<typeof products.$inferSelect & { categoryName: string; categorySlug: string }>): Promise<PublicCard[]> {
  const ids = rows.map((r) => r.id);
  const [images, prices] = await Promise.all([
    firstImages(ids),
    ids.length
      ? getDb()
          .select({ productId: productVariants.productId, price: productVariants.listPrice, compare: productVariants.comparePrice })
          .from(productVariants)
          .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true), sql`${productVariants.listPrice} IS NOT NULL`))
          .orderBy(asc(productVariants.listPrice))
      : Promise.resolve([]),
  ]);
  // The cheapest option is what a card shows; rows arrive cheapest first.
  const priceBy = new Map<string, { price: string; compare: string | null }>();
  for (const p of prices) if (!priceBy.has(p.productId) && p.price) priceBy.set(p.productId, { price: p.price, compare: p.compare });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
    material: r.material,
    dimensions: r.dimensions,
    imageUrl: images.get(r.id)?.url ?? null,
    imageAlt: images.get(r.id)?.alt ?? null,
    fromPrice: r.showPrice && priceBy.get(r.id) ? moneyString(priceBy.get(r.id)!.price) : null,
    fromCompare: r.showPrice && priceBy.get(r.id)?.compare ? moneyString(priceBy.get(r.id)!.compare!) : null,
    availability: r.showAvailability && r.availability ? AVAILABILITY_LABEL[r.availability] : null,
    isNew: Date.now() - r.createdAt.getTime() < NEW_FOR_DAYS * 86400000,
  }));
}

export interface CatalogueQuery {
  q?: string;
  category?: string;
  material?: string;
  sort?: CatalogueSort;
  page?: number;
}


/**
 * Pages that are pre-built at deploy time read the database while `next build` runs. On a brand-new deployment the database may be
 * reachable but still empty (migrations not run yet), which must not fail the whole deployment. During the build ONLY, a failed
 * read is logged and replaced with an empty result; at runtime errors still surface normally.
 */
async function duringBuildSafe<T>(label: string, fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (process.env.NEXT_PHASE !== "phase-production-build") throw e;
    console.warn(`[build] ${label} unavailable (database not set up yet?); building with empty content.`, e instanceof Error ? e.message.slice(0, 160) : "");
    return fallback;
  }
}

/** The lowest price a visitor can see for a piece: nothing when the price is not shown, so those pieces sort last either way. */
const shownPrice = sql`(CASE WHEN ${products.showPrice} THEN (SELECT min(${productVariants.listPrice}) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)} AND ${productVariants.isActive}) END)`;

function orderFor(sort: CatalogueSort | undefined): SQL[] {
  if (sort === "name") return [asc(products.name)];
  if (sort === "price-high") return [sql`${shownPrice} DESC NULLS LAST`, desc(products.createdAt)];
  if (sort === "price-low") return [sql`${shownPrice} ASC NULLS LAST`, desc(products.createdAt)];
  return [desc(products.createdAt)];
}

async function listPublicProductsImpl(query: CatalogueQuery) {
  if (!hasDatabase()) return { items: [] as PublicCard[], total: 0, page: 1, pageCount: 1 };
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const where: SQL[] = [visible!];
  if (query.category) {
    // A group shows everything filed under it, as well as anything filed on the group itself.
    const inGroup = alias(productCategories, "group_cat");
    where.push(or(eq(productCategories.slug, query.category), exists(getDb().select({ one: sql`1` }).from(inGroup).where(and(eq(inGroup.id, productCategories.parentId), eq(inGroup.slug, query.category)))))!);
  }
  if (query.material) where.push(eq(products.material, query.material));
  if (query.q) {
    const like = `%${escapeLike(query.q)}%`;
    where.push(
      or(
        ilike(products.name, like),
        ilike(products.description, like),
        ilike(products.material, like),
        exists(db.select({ one: sql`1` }).from(productVariants).where(and(eq(productVariants.productId, products.id), ilike(productVariants.sku, like)))),
      )!,
    );
  }
  const cond = and(...where);
  const [rows, countRows] = await Promise.all([
    db
      .select({ p: products, categoryName: productCategories.name, categorySlug: productCategories.slug })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(cond)
      .orderBy(...orderFor(query.sort))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(products).innerJoin(productCategories, eq(productCategories.id, products.categoryId)).where(cond),
  ]);
  const total = countRows[0]?.n ?? 0;
  return {
    items: await toCards(rows.map((r) => ({ ...r.p, categoryName: r.categoryName, categorySlug: r.categorySlug }))),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

async function listFeaturedProductsImpl(limit = 3): Promise<PublicCard[]> {
  if (!hasDatabase()) return [];
  const rows = await getDb()
    .select({ p: products, categoryName: productCategories.name, categorySlug: productCategories.slug })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(visible, eq(products.isFeatured, true)))
    .orderBy(desc(products.updatedAt))
    .limit(limit);
  return toCards(rows.map((r) => ({ ...r.p, categoryName: r.categoryName, categorySlug: r.categorySlug })));
}

/** A piece of the premium range, with every photograph and its long description, as the showroom page shows them. */
export interface PremiumPiece extends PublicCard {
  description: string | null;
  images: Array<{ id: string; url: string; alt: string }>;
}

/** The pieces the owner has marked both premium and featured, newest first. They also stay in the normal collection. */
async function listPremiumProductsImpl(limit?: number): Promise<PremiumPiece[]> {
  if (!hasDatabase()) return [];
  const db = getDb();
  const rows = await db
    .select({ p: products, categoryName: productCategories.name, categorySlug: productCategories.slug })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(visible, eq(products.isPremium, true), eq(products.isFeatured, true)))
    .orderBy(desc(products.createdAt))
    .limit(limit ?? 24);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.p.id);
  const [cards, imgs] = await Promise.all([
    toCards(rows.map((r) => ({ ...r.p, categoryName: r.categoryName, categorySlug: r.categorySlug }))),
    db
      .select({ productId: productImages.productId, id: productImages.id, alt: productImages.altText, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
      .from(productImages)
      .innerJoin(uploadedFiles, eq(uploadedFiles.id, productImages.fileId))
      .where(and(inArray(productImages.productId, ids), eq(uploadedFiles.status, "linked")))
      .orderBy(asc(productImages.position)),
  ]);
  const byId = new Map(rows.map((r) => [r.p.id, r.p]));
  return cards.map((c) => ({
    ...c,
    description: byId.get(c.id)?.description ?? null,
    images: imgs.filter((i) => i.productId === c.id).map((i) => ({ id: i.id, alt: i.alt, url: publicFileUrl({ bucket: i.bucket, objectKey: i.key }) })),
  }));
}

/**
 * More to look at on a product page: other products in the same category first, then products from the same group
 * (the categories beside it), so the row is rarely empty.
 */
export async function listRelatedProducts(productId: string, categoryId: string, limit = 4): Promise<PublicCard[]> {
  if (!hasDatabase()) return [];
  const db = getDb();
  const [cat] = await db.select({ parentId: productCategories.parentId }).from(productCategories).where(eq(productCategories.id, categoryId)).limit(1);
  const same = await db
    .select({ p: products, categoryName: productCategories.name, categorySlug: productCategories.slug })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(visible, eq(products.categoryId, categoryId), sql`${products.id} <> ${productId}`))
    .orderBy(desc(products.isFeatured), desc(products.updatedAt))
    .limit(limit);
  let rows = same;
  if (rows.length < limit && cat?.parentId) {
    const have = rows.map((r) => r.p.id);
    const near = await db
      .select({ p: products, categoryName: productCategories.name, categorySlug: productCategories.slug })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(visible, eq(productCategories.parentId, cat.parentId), sql`${products.id} <> ${productId}`, have.length ? sql`${products.id} NOT IN (${sql.join(have.map((h) => sql`${h}`), sql`, `)})` : sql`true`))
      .orderBy(desc(products.isFeatured), desc(products.updatedAt))
      .limit(limit - rows.length);
    rows = [...rows, ...near];
  }
  return toCards(rows.map((r) => ({ ...r.p, categoryName: r.categoryName, categorySlug: r.categorySlug })));
}

/** Cards for these products, in the order given, skipping any that are no longer on sale. */
export async function listPublicProductsByIds(ids: string[]): Promise<PublicCard[]> {
  if (!hasDatabase() || ids.length === 0) return [];
  const rows = await getDb()
    .select({ p: products, categoryName: productCategories.name, categorySlug: productCategories.slug })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(visible, inArray(products.id, ids)));
  const cards = await toCards(rows.map((r) => ({ ...r.p, categoryName: r.categoryName, categorySlug: r.categorySlug })));
  const order = new Map(ids.map((id, i) => [id, i]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

async function listPublicCategoriesImpl(): Promise<Array<{ id: string; name: string; slug: string; description: string | null; parentId: string | null; count: number }>> {
  if (!hasDatabase()) return [];
  const rows = await getDb()
    .select({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug,
      description: productCategories.description,
      parentId: productCategories.parentId,
      count: sql<number>`count(${products.id}) FILTER (WHERE ${products.isPublished} AND ${products.archivedAt} IS NULL)::int`,
    })
    .from(productCategories)
    .leftJoin(products, eq(products.categoryId, productCategories.id))
    .where(and(eq(productCategories.isActive, true), isNull(productCategories.archivedAt), parentShown))
    .groupBy(productCategories.id)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
  // A group counts the pieces in the categories under it as well as its own.
  return rows.map((r) => ({ ...r, count: r.count + rows.filter((c) => c.parentId === r.id).reduce((n, c) => n + c.count, 0) }));
}

async function listPublicMaterialsImpl(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await getDb()
    .selectDistinct({ material: products.material })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(visible, sql`${products.material} IS NOT NULL`))
    .orderBy(asc(products.material));
  return rows.map((r) => r.material!).filter(Boolean);
}

/** One item per non-empty line. */
async function getPublicProductImpl(slugValue: string) {
  if (!hasDatabase()) return null;
  const db = getDb();
  const [row] = await db
    .select({ p: products, categoryName: productCategories.name, categorySlug: productCategories.slug })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(visible, eq(products.slug, slugValue)))
    .limit(1);
  if (!row) return null;
  const p = row.p;
  const [images, variants] = await Promise.all([
    db
      .select({ id: productImages.id, alt: productImages.altText, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
      .from(productImages)
      .innerJoin(uploadedFiles, eq(uploadedFiles.id, productImages.fileId))
      .where(and(eq(productImages.productId, p.id), eq(uploadedFiles.status, "linked")))
      .orderBy(asc(productImages.position)),
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, p.id), eq(productVariants.isActive, true)))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.label)),
  ]);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    material: p.material,
    finish: p.finish,
    dimensions: p.dimensions,
    kind: p.kind,
    categoryId: p.categoryId,
    shortDescription: p.shortDescription,
    specifications: p.specifications,
    customization: p.customization,
    purchaseMode: p.purchaseMode as "direct" | "quote" | "both",
    isPremium: p.isPremium,
    priceShown: p.showPrice,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    availability: p.showAvailability && p.availability ? AVAILABILITY_LABEL[p.availability] : null,
    availabilityState: p.showAvailability && p.availability ? (p.availability === "on_request" ? "made_to_order" : p.availability) : null,
    images: images.map((i) => ({ id: i.id, alt: i.alt, url: publicFileUrl({ bucket: i.bucket, objectKey: i.key }) })),
    variants: variants.map((v) => ({ id: v.id, sku: v.sku, label: v.label, price: p.showPrice && v.listPrice ? moneyString(v.listPrice) : null, compare: p.showPrice && v.listPrice && v.comparePrice ? moneyString(v.comparePrice) : null, stock: v.stockQuantity })),
    updatedAt: p.updatedAt,
  };
}

async function listGalleryProjectsImpl() {
  if (!hasDatabase()) return [];
  const db = getDb();
  const projects = await db
    .select({ p: galleryProjects, categorySlug: productCategories.slug })
    .from(galleryProjects)
    .leftJoin(productCategories, eq(productCategories.id, galleryProjects.categoryId))
    .where(and(eq(galleryProjects.isPublished, true), eq(galleryProjects.area, "projects"), isNull(galleryProjects.archivedAt)))
    .orderBy(asc(galleryProjects.sortOrder), desc(galleryProjects.completedOn), desc(galleryProjects.createdAt));
  if (projects.length === 0) return [];
  const rows = projects.map((r) => ({ ...r.p, categorySlug: r.categorySlug }));
  const imgs = await db
    .select({ projectId: galleryImages.projectId, id: galleryImages.id, alt: galleryImages.altText, bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey, position: galleryImages.position })
    .from(galleryImages)
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, galleryImages.fileId))
    .where(and(inArray(galleryImages.projectId, rows.map((p) => p.id)), eq(uploadedFiles.status, "linked")))
    .orderBy(asc(galleryImages.position));
  return rows.map((p) => ({
    id: p.id,
    categorySlug: p.categorySlug,
    title: p.title,
    description: p.description,
    completedOn: p.completedOn,
    images: imgs.filter((i) => i.projectId === p.id).map((i) => ({ id: i.id, alt: i.alt, url: publicFileUrl({ bucket: i.bucket, objectKey: i.key }) })),
  }));
}

async function listPublishedProductSlugsImpl(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  if (!hasDatabase()) return [];
  const rows = await getDb()
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(visible);
  return rows;
}

/**
 * The catalogue reads below are kept for a few minutes and shared by every visitor, so the collection page does not query the database
 * for each one. Anything that changes what they show clears them at once (see clearCatalogueCache); the time limit is only a safety net.
 * Results are plain data, so they survive being stored. A failed read throws and is therefore never stored.
 */
const kept = <A extends unknown[], R>(read: (...args: A) => Promise<R>, name: string) =>
  unstable_cache(read, ["catalogue", name], { tags: [CATALOGUE_TAG], revalidate: CATALOGUE_REVALIDATE });

const listPublicProductsKept = kept(listPublicProductsImpl, "products");
const listPublicCategoriesKept = kept(listPublicCategoriesImpl, "categories");
const listPublicMaterialsKept = kept(listPublicMaterialsImpl, "materials");
const listPremiumProductsKept = kept(listPremiumProductsImpl, "premium");

/** A search is typed by the visitor and could be anything, so searches are never stored; neither are oddly long filters or far-off pages. */
export const listPublicProducts = (query: CatalogueQuery) =>
  query.q || (query.category?.length ?? 0) > 80 || (query.material?.length ?? 0) > 80 || (query.page ?? 1) > 50
    ? listPublicProductsImpl(query)
    : listPublicProductsKept(query);
export const listPublicMaterials = () => listPublicMaterialsKept();

/* Build-safe public readers (see duringBuildSafe). */
export const listFeaturedProducts = (...args: Parameters<typeof listFeaturedProductsImpl>) => duringBuildSafe("listFeaturedProducts", [] as Awaited<ReturnType<typeof listFeaturedProductsImpl>>, () => listFeaturedProductsImpl(...args));
export const listPremiumProducts = (...args: Parameters<typeof listPremiumProductsImpl>) => duringBuildSafe("listPremiumProducts", [] as Awaited<ReturnType<typeof listPremiumProductsImpl>>, () => listPremiumProductsKept(...args));
export const listPublicCategories = (...args: Parameters<typeof listPublicCategoriesImpl>) => duringBuildSafe("listPublicCategories", [] as Awaited<ReturnType<typeof listPublicCategoriesImpl>>, () => listPublicCategoriesKept(...args));
export const getPublicProduct = (...args: Parameters<typeof getPublicProductImpl>) => duringBuildSafe("getPublicProduct", null as Awaited<ReturnType<typeof getPublicProductImpl>>, () => getPublicProductImpl(...args));
export const listGalleryProjects = (...args: Parameters<typeof listGalleryProjectsImpl>) => duringBuildSafe("listGalleryProjects", [] as Awaited<ReturnType<typeof listGalleryProjectsImpl>>, () => listGalleryProjectsImpl(...args));
export const listPublishedProductSlugs = (...args: Parameters<typeof listPublishedProductSlugsImpl>) => duringBuildSafe("listPublishedProductSlugs", [] as Awaited<ReturnType<typeof listPublishedProductSlugsImpl>>, () => listPublishedProductSlugsImpl(...args));
