import "server-only";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/lib/db/client";
import { productCategories, productImages, products, uploadedFiles } from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";
import { BANNER_WIDTHS, pickWindow, warmTargets } from "@/lib/image-sizes";
import { publicFileUrl } from "./files";

/** A bulk publish can touch hundreds of products: prepare the first photographs of the first products and leave the rest to their first visitors. */
const MAX_PHOTOS = 24;
/** The daily refresh looks at this many photographs a day, moving on each day, so every photograph is reached well inside the 31 days a copy is kept. */
const PHOTOS_PER_DAY = 40;
const DAILY_BUDGET_MS = 40_000;
const PARALLEL = 3;
/** What a modern browser sends, so the copies prepared here are the ones its visitors are served. */
const ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

const onThisComputer = (site: string) => /\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(site);

/** Public addresses of the photographs of published, unarchived products that match `extra`, in a steady order. */
async function photoUrls(extra: SQL | undefined, limit?: number): Promise<string[]> {
  const q = getDb()
    .select({ bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, productImages.fileId))
    .where(and(eq(products.isPublished, true), isNull(products.archivedAt), eq(uploadedFiles.status, "linked"), extra))
    .orderBy(asc(productImages.position), asc(productImages.productId), asc(productImages.id));
  const rows = await (limit ? q.limit(limit) : q);
  return rows.map((r) => publicFileUrl({ bucket: r.bucket, objectKey: r.key }));
}

/** Public addresses of the pictures behind the category bands on the home page. */
async function bannerUrls(): Promise<string[]> {
  const rows = await getDb()
    .select({ bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
    .from(productCategories)
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, productCategories.bannerFileId))
    .where(and(isNull(productCategories.archivedAt), eq(productCategories.isActive, true), eq(uploadedFiles.status, "linked")));
  return rows.map((r) => publicFileUrl({ bucket: r.bucket, objectKey: r.key }));
}

/** The pages that show these products: the home page, the collection, each product's category page and each product page. */
async function pagePaths(productIds: string[]): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: products.slug, category: productCategories.slug })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(inArray(products.id, productIds), eq(products.isPublished, true), isNull(products.archivedAt)))
    .limit(MAX_PHOTOS);
  const categories = [...new Set(rows.map((r) => r.category))];
  return ["/", "/products", ...categories.map((c) => `/collections/${encodeURIComponent(c)}`), ...rows.map((r) => `/products/${r.slug}`)];
}

/** Requests each address a few at a time until they are done or `deadline` passes. Returns how many were answered and how many were not. */
async function requestAll(targets: string[], deadline: number): Promise<{ ok: number; failed: number }> {
  const queue = [...targets];
  let ok = 0;
  let failed = 0;
  const worker = async () => {
    for (let next = queue.shift(); next && Date.now() < deadline; next = queue.shift()) {
      try {
        const res = await fetch(next, { headers: { Accept: ACCEPT }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
        await res.arrayBuffer();
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return { ok, failed };
}

async function warm(productIds: string[]): Promise<void> {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (onThisComputer(site)) return;
  // The pages first: asking for a page that has just been refreshed rebuilds it now, so the first visitor is served a stored copy.
  const origin = site.replace(/\/+$/, "");
  await requestAll((await pagePaths(productIds)).map((p) => `${origin}${p}`), Date.now() + 20_000);
  const { failed } = await requestAll(warmTargets(site, await photoUrls(inArray(productImages.productId, productIds), MAX_PHOTOS)), Date.now() + 45_000);
  if (failed > 0) console.warn(`[image-warm] ${failed} photo sizes could not be prepared ahead of time; they will be made on first visit.`);
}

/**
 * After a product is saved or published, asks the site for each of its photographs at the sizes customers use, so Vercel makes and stores
 * those copies now and the first customer is not the one who waits. Runs after the response is sent; never affects the save.
 * Only published products are prepared, and only in production.
 */
export function warmProductPhotos(productIds: string[]): void {
  if (process.env.NODE_ENV !== "production" || productIds.length === 0) return;
  const run = () => warm(productIds).catch((e) => console.warn("[image-warm] skipped:", e instanceof Error ? e.message : "unknown error"));
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * After a category (and its home page picture) is saved, prepares the pictures behind the home page bands at the sizes phones and computers ask for.
 * Runs after the response is sent; never affects the save. Production only.
 */
export function warmCategoryBanners(): void {
  if (process.env.NODE_ENV !== "production") return;
  const run = async () => {
    const site = publicEnv().NEXT_PUBLIC_SITE_URL;
    if (onThisComputer(site)) return;
    const origin = site.replace(/\/+$/, "");
    await requestAll([`${origin}/`], Date.now() + 15_000);
    await requestAll(warmTargets(site, await bannerUrls(), BANNER_WIDTHS), Date.now() + 40_000);
  };
  const guarded = () => run().catch((e) => console.warn("[image-warm] banners skipped:", e instanceof Error ? e.message : "unknown error"));
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

/**
 * The daily job: asks for a rotating share of all published photographs at the customer sizes. A copy that is still stored answers at once;
 * one the network has thrown away is made now, while nobody is waiting. Returns how many sizes were answered.
 */
export async function refreshPublishedPhotos(): Promise<number> {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (onThisComputer(site)) return 0;
  const today = pickWindow(await photoUrls(undefined), Math.floor(Date.now() / 86_400_000), PHOTOS_PER_DAY);
  const banners = warmTargets(site, await bannerUrls(), BANNER_WIDTHS);
  const { ok, failed } = await requestAll([...warmTargets(site, today), ...banners], Date.now() + DAILY_BUDGET_MS);
  if (failed > 0) console.warn(`[image-warm] daily refresh: ${failed} photo sizes did not answer.`);
  return ok;
}
