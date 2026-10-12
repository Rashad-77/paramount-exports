import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** Public, indexable pages only. Product and gallery URLs are added when those pages exist (Step 2). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL;
  return [{ url: `${base}/`, changeFrequency: "monthly", priority: 1 }];
}
