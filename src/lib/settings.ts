import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { siteSettings } from "@/lib/db/schema";
import { hasDatabase } from "@/lib/env";
import { DEFAULT_TIMEZONE } from "@/lib/time";

/**
 * Business details shown on the public site and in documents. All values are editable by authorised
 * staff (Settings, Step 2+). Until real details are supplied the placeholders below are used and the
 * site clearly labels them — nothing here is a real business name, address or phone number.
 */
export const businessSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).nullable(),
  email: z.string().trim().email().nullable(),
  phone: z.string().trim().max(40).nullable(),
  whatsapp: z.string().trim().max(40).nullable(),
  address: z.string().trim().max(400).nullable(),
  mapUrl: z.string().url().nullable(),
  openingHours: z.string().trim().max(600).nullable(),
  currency: z.string().length(3),
  timezone: z.string().min(1),
  /** Used only to build WhatsApp links from local numbers (leading 0). Assumption: tied to the LKR default. */
  phoneCountryCode: z.string().regex(/^\d{1,3}$/),
});
export type BusinessSettings = z.infer<typeof businessSchema>;

export const PLACEHOLDER_NAME = "[Business Name]";

export const DEFAULT_BUSINESS: BusinessSettings = {
  name: PLACEHOLDER_NAME,
  tagline: null,
  email: null,
  phone: null,
  whatsapp: null,
  address: null,
  mapUrl: null,
  openingHours: null,
  currency: "LKR", // assumption — to be confirmed with the owner
  timezone: DEFAULT_TIMEZONE, // assumption — to be confirmed with the owner
  phoneCountryCode: "94", // assumption — to be confirmed with the owner
};

export const isPlaceholderBusiness = (b: BusinessSettings) => b.name === PLACEHOLDER_NAME;

/** Never throws: the public site must keep rendering even if the database is unreachable. */
export const getBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  if (!hasDatabase()) return DEFAULT_BUSINESS;
  try {
    const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, "business")).limit(1);
    if (!row) return DEFAULT_BUSINESS;
    const parsed = businessSchema.safeParse({ ...DEFAULT_BUSINESS, ...(row.value as object) });
    return parsed.success ? parsed.data : DEFAULT_BUSINESS;
  } catch (error) {
    console.error("Failed to load business settings; using defaults.", error instanceof Error ? error.message : "unknown");
    return DEFAULT_BUSINESS;
  }
});

/**
 * Editable page copy. Defaults are deliberately plain and are labelled drafts: they describe what this system
 * really does with enquiry data, and must be reviewed by the business (and legal advice taken) before launch.
 */
export const pagesSchema = z.object({
  about: z.string().max(8000).nullable(),
  privacy: z.string().max(12000).nullable(),
  terms: z.string().max(12000).nullable(),
});
export type PageContent = z.infer<typeof pagesSchema>;
export const DEFAULT_PAGES: PageContent = { about: null, privacy: null, terms: null };

export const getPageContent = cache(async (): Promise<PageContent> => {
  if (!hasDatabase()) return DEFAULT_PAGES;
  try {
    const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, "pages")).limit(1);
    const parsed = pagesSchema.safeParse({ ...DEFAULT_PAGES, ...((row?.value as object | undefined) ?? {}) });
    return parsed.success ? parsed.data : DEFAULT_PAGES;
  } catch (error) {
    console.error("Failed to load page content; using defaults.", error instanceof Error ? error.message : "unknown");
    return DEFAULT_PAGES;
  }
});

export const crmSettingsSchema = z.object({ defaultAssigneeId: z.uuid().nullable() });
export type CrmSettings = z.infer<typeof crmSettingsSchema>;
