import type { MetadataRoute } from "next";
import { hasDatabase, publicEnv } from "@/lib/env";
import { listPublishedProductSlugs } from "@/server/catalogue-public";

// Always fresh: newly published products should be discoverable immediately, and the query is cheap.
export const dynamic = "force-dynamic";

/** Public, indexable pages only. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL;
  const pages = ["", "/products", "/custom", "/about", "/gallery", "/contact", "/privacy", "/terms"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  let products: MetadataRoute.Sitemap = [];
  if (hasDatabase()) {
    try {
      products = (await listPublishedProductSlugs()).map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 }));
    } catch (e) {
      console.error("Sitemap: products unavailable", e instanceof Error ? e.message : "unknown");
    }
  }
  return [...pages, ...products];
}
