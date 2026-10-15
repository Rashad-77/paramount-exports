import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL;
  const business = await getBusinessSettings();
  // While placeholder content is showing, ask crawlers to stay away entirely.
  if (isPlaceholderBusiness(business)) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/login", "/api", "/dev"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
