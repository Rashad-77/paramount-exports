import type { MetadataRoute } from "next";
import { hasDatabase, publicEnv } from "@/lib/env";
import { listPublicCategories, listPublishedProductSlugs } from "@/server/catalogue-public";

// Always fresh: newly published products should be discoverable immediately, and the query is cheap.
export const dynamic = "force-dynamic";

/** Public, indexable pages only. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL;
  const pages = ["", "/products", "/custom", "/about", "/gallery", "/contact", "/help", "/privacy", "/terms"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  let products: MetadataRoute.Sitemap = [];
  let categories: MetadataRoute.Sitemap = [];
  if (hasDatabase()) {
    // A page for each category that has pieces in it (they have their own title and description, see the Collection page).
    try {
      categories = (await listPublicCategories()).filter((c) => c.count > 0).map((c) => ({ url: `${base}/products?category=${encodeURIComponent(c.slug)}`, changeFrequency: "weekly" as const, priority: 0.7 }));
    } catch (e) {
      console.error("Sitemap: categories unavailable", e instanceof Error ? e.message : "unknown");
    }
    try {
      products = (await listPublishedProductSlugs()).map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 }));
    } catch (e) {
      console.error("Sitemap: products unavailable", e instanceof Error ? e.message : "unknown");
    }
  }
  return [...pages, ...categories, ...products];
}
