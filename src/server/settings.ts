import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { siteSettings } from "@/lib/db/schema";
import { validation } from "@/lib/errors";
import {
  DEFAULT_BUSINESS,
  DEFAULT_PAGES,
  DEFAULT_PRODUCTION,
  DEFAULT_SALES,
  businessSchema,
  crmSettingsSchema,
  pagesSchema,
  productionSettingsSchema,
  salesSettingsSchema,
  type BusinessSettings,
  type CrmSettings,
  type PageContent,
  type ProductionSettings,
  type SalesSettings,
} from "@/lib/settings";
import { recordAudit } from "./audit";

async function readRow(db: DbOrTx, key: string): Promise<Record<string, unknown> | null> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  return (row?.value as Record<string, unknown> | undefined) ?? null;
}

async function writeRow(tx: DbOrTx, key: string, value: unknown, actorId: string): Promise<void> {
  await tx
    .insert(siteSettings)
    .values({ key, value, updatedBy: actorId })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedBy: actorId } });
}

export async function getSettingsForAdmin(actor: Actor): Promise<{ business: BusinessSettings; pages: PageContent; crm: CrmSettings; sales: SalesSettings; production: ProductionSettings }> {
  requirePermission(actor, "settings:view");
  const db = getDb();
  const [b, p, c, sa, pr] = await Promise.all([readRow(db, "business"), readRow(db, "pages"), readRow(db, "crm"), readRow(db, "sales"), readRow(db, "production")]);
  return {
    business: businessSchema.parse({ ...DEFAULT_BUSINESS, ...b }),
    pages: pagesSchema.parse({ ...DEFAULT_PAGES, ...p }),
    crm: crmSettingsSchema.parse({ defaultAssigneeId: null, ...c }),
    sales: salesSettingsSchema.parse({ ...DEFAULT_SALES, ...sa }),
    production: productionSettingsSchema.parse({ ...DEFAULT_PRODUCTION, ...pr }),
  };
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateBusiness(actor: Actor, input: BusinessSettings): Promise<void> {
  requirePermission(actor, "settings:manage");
  const next = businessSchema.parse(input);
  if (!isValidTimeZone(next.timezone)) throw validation("Choose a valid timezone.", { timezone: ["Use an IANA timezone such as Asia/Colombo."] });
  await withTx(async (tx) => {
    const before = await readRow(tx, "business");
    await writeRow(tx, "business", next, actor.id);
    await recordAudit(tx, actor, { action: "settings.business_updated", entityType: "site_settings", entityId: "business", before, after: next });
  });
}

export async function updatePages(actor: Actor, input: PageContent): Promise<void> {
  requirePermission(actor, "website:manage");
  const next = pagesSchema.parse(input);
  await withTx(async (tx) => {
    const before = await readRow(tx, "pages");
    await writeRow(tx, "pages", next, actor.id);
    await recordAudit(tx, actor, { action: "settings.pages_updated", entityType: "site_settings", entityId: "pages", before: before ? { updated: true } : null, after: { updated: true } });
  });
}

export async function updateCrmSettings(actor: Actor, input: z.input<typeof crmSettingsSchema>): Promise<void> {
  requirePermission(actor, "settings:manage");
  const next = crmSettingsSchema.parse(input);
  await withTx(async (tx) => {
    const before = await readRow(tx, "crm");
    await writeRow(tx, "crm", next, actor.id);
    await recordAudit(tx, actor, { action: "settings.crm_updated", entityType: "site_settings", entityId: "crm", before, after: next });
  });
}

/** Used by the public enquiry pipeline (no actor): who new website leads are assigned to, if anyone. */
export async function getDefaultAssigneeId(db: DbOrTx): Promise<string | null> {
  const row = await readRow(db, "crm");
  const parsed = crmSettingsSchema.safeParse({ defaultAssigneeId: null, ...row });
  return parsed.success ? parsed.data.defaultAssigneeId : null;
}

export async function getSalesSettings(db: DbOrTx): Promise<SalesSettings> {
  const row = await readRow(db, "sales");
  const parsed = salesSettingsSchema.safeParse({ ...DEFAULT_SALES, ...row });
  return parsed.success ? parsed.data : DEFAULT_SALES;
}

export async function updateSalesSettings(actor: Actor, input: SalesSettings): Promise<void> {
  requirePermission(actor, "settings:manage");
  const next = salesSettingsSchema.parse(input);
  if (Number(next.maxDiscountPercent) > 100) throw validation("The discount limit cannot exceed 100%.", { maxDiscountPercent: ["Enter a percentage between 0 and 100."] });
  await withTx(async (tx) => {
    const before = await readRow(tx, "sales");
    await writeRow(tx, "sales", next, actor.id);
    await recordAudit(tx, actor, { action: "settings.sales_updated", entityType: "site_settings", entityId: "sales", before, after: next });
  });
}

export async function getProductionSettings(db: DbOrTx): Promise<ProductionSettings> {
  const row = await readRow(db, "production");
  const parsed = productionSettingsSchema.safeParse({ ...DEFAULT_PRODUCTION, ...row });
  return parsed.success ? parsed.data : DEFAULT_PRODUCTION;
}

export async function updateProductionSettings(actor: Actor, input: ProductionSettings): Promise<void> {
  requirePermission(actor, "settings:manage");
  const next = productionSettingsSchema.parse(input);
  await withTx(async (tx) => {
    const before = await readRow(tx, "production");
    await writeRow(tx, "production", next, actor.id);
    await recordAudit(tx, actor, { action: "settings.production_updated", entityType: "site_settings", entityId: "production", before, after: next });
  });
}
