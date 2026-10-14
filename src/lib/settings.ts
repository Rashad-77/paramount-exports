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
  /** Shown to customers who choose to pay by bank transfer: account name, number, bank. */
  bankDetails: z.string().trim().max(600).nullable(),
  currency: z.string().length(3),
  timezone: z.string().min(1),
  /** Used only to build WhatsApp links from local numbers (leading 0). Assumption: tied to the LKR default. */
  phoneCountryCode: z.string().regex(/^\d{1,3}$/),
});
export type BusinessSettings = z.infer<typeof businessSchema> & {
  /** True while nothing has been saved under Settings: the name below is the built-in one and the site is still a preview. */
  isDefault?: boolean;
};

/** The name shown until the owner saves business details. An older placeholder name saved in Settings is treated the same way. */
export const PLACEHOLDER_NAME = "[Business Name]";
export const DEFAULT_BUSINESS_NAME = "Paramount Export Industries";

export const DEFAULT_BUSINESS: BusinessSettings = {
  name: DEFAULT_BUSINESS_NAME,
  tagline: null,
  email: null,
  phone: null,
  whatsapp: null,
  address: null,
  mapUrl: null,
  openingHours: null,
  bankDetails: null,
  currency: "LKR", // assumption — to be confirmed with the owner
  timezone: DEFAULT_TIMEZONE, // assumption — to be confirmed with the owner
  phoneCountryCode: "94", // assumption — to be confirmed with the owner
};

/**
 * A site whose business details have never been saved is still a preview: it is hidden from search engines, shows the preview
 * notice, and (on a public demo deployment) allows the demo sign-in. Saving the details under Settings ends that.
 * The business name is shown properly either way.
 */
export const isPlaceholderBusiness = (b: BusinessSettings) => b.isDefault === true || b.name === PLACEHOLDER_NAME;

const UNSAVED: BusinessSettings = { ...DEFAULT_BUSINESS, isDefault: true };

/** Never throws: the public site must keep rendering even if the database is unreachable. */
export const getBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  if (!hasDatabase()) return UNSAVED;
  try {
    const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, "business")).limit(1);
    if (!row) return UNSAVED;
    const parsed = businessSchema.safeParse({ ...DEFAULT_BUSINESS, ...(row.value as object) });
    if (!parsed.success) return UNSAVED;
    return parsed.data.name === PLACEHOLDER_NAME ? { ...parsed.data, name: DEFAULT_BUSINESS_NAME, isDefault: true } : parsed.data;
  } catch (error) {
    console.error("Failed to load business settings; using defaults.", error instanceof Error ? error.message : "unknown");
    return UNSAVED;
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
  /** Customer reviews for the homepage, as plain text; see parseTestimonials. */
  testimonials: z.string().max(6000).nullable(),
  /** The business history for the About page, as plain text; see parseHistory. */
  history: z.string().max(6000).nullable(),
  /** A short paragraph under the history heading. */
  historyIntro: z.string().max(600).nullable(),
  /** The owner section on the About page. */
  ownerName: z.string().max(120).nullable(),
  ownerRole: z.string().max(120).nullable(),
  ownerBio: z.string().max(1500).nullable(),
});
export type PageContent = z.infer<typeof pagesSchema>;
export const DEFAULT_PAGES: PageContent = { about: null, privacy: null, terms: null, testimonials: null, history: null, historyIntro: null, ownerName: null, ownerRole: null, ownerBio: null };

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

/**
 * Customer accounts. Everything is off until the owner turns it on in Settings, and it cannot be turned on until a sign-in service
 * is connected (see lib/auth/customer.ts), so a half-configured site never shows a sign-in that cannot work.
 */
export const accountsSchema = z.object({
  enabled: z.boolean(),
  /** Let new visitors create an account. When off, only existing accounts can sign in. */
  allowSignUp: z.boolean(),
  /** Orders can only be placed by signed-in customers. Guests are sent to sign in. */
  requiredForCheckout: z.boolean(),
  /** Keep a signed-in customer's basket on their account so it follows them between devices. */
  saveCart: z.boolean(),
});
export type AccountSettings = z.infer<typeof accountsSchema>;
export const DEFAULT_ACCOUNTS: AccountSettings = { enabled: false, allowSignUp: true, requiredForCheckout: false, saveCart: true };

/** Never throws: anything unreadable means "accounts are off", the safe state. */
export const getAccountSettings = cache(async (): Promise<AccountSettings> => {
  if (!hasDatabase()) return DEFAULT_ACCOUNTS;
  try {
    const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, "accounts")).limit(1);
    const parsed = accountsSchema.safeParse({ ...DEFAULT_ACCOUNTS, ...((row?.value as object | undefined) ?? {}) });
    return parsed.success ? parsed.data : DEFAULT_ACCOUNTS;
  } catch (error) {
    console.error("Failed to load account settings; accounts stay off.", error instanceof Error ? error.message : "unknown");
    return DEFAULT_ACCOUNTS;
  }
});
