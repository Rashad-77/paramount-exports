import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/lib/db/client";
import { productImages, products, uploadedFiles } from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";
import { warmTargets } from "@/lib/image-sizes";
import { publicFileUrl } from "./files";

/** A bulk publish can touch hundreds of products: prepare the first photographs of the first products and leave the rest to their first visitors. */
const MAX_PHOTOS = 24;
const PARALLEL = 3;
/** What a modern browser sends, so the copies prepared here are the ones its visitors are served. */
const ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

async function warm(productIds: string[]): Promise<void> {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (/\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(site)) return;
  const rows = await getDb()
    .select({ bucket: uploadedFiles.bucket, key: uploadedFiles.objectKey })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, productImages.fileId))
    .where(and(inArray(productImages.productId, productIds), eq(products.isPublished, true), isNull(products.archivedAt), eq(uploadedFiles.status, "linked")))
    .orderBy(asc(productImages.position))
    .limit(MAX_PHOTOS);
  const queue = warmTargets(site, rows.map((r) => publicFileUrl({ bucket: r.bucket, objectKey: r.key })));
  let failed = 0;
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const res = await fetch(next, { headers: { Accept: ACCEPT }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
        await res.arrayBuffer();
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
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
