import "server-only";
import { eq } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { siteSettings } from "@/lib/db/schema";
import { validation } from "@/lib/errors";
import { DEFAULT_ACCOUNTS, DEFAULT_BUSINESS, DEFAULT_PAGES, accountsSchema, businessSchema, pagesSchema, type AccountSettings, type BusinessSettings, type PageContent } from "@/lib/settings";
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

export async function getSettingsForAdmin(actor: Actor): Promise<{ business: BusinessSettings; pages: PageContent; accounts: AccountSettings }> {
  requirePermission(actor, "settings:view");
  const db = getDb();
  const [b, p, a] = await Promise.all([readRow(db, "business"), readRow(db, "pages"), readRow(db, "accounts")]);
  return {
    business: businessSchema.parse({ ...DEFAULT_BUSINESS, ...b }),
    pages: pagesSchema.parse({ ...DEFAULT_PAGES, ...p }),
    accounts: accountsSchema.parse({ ...DEFAULT_ACCOUNTS, ...a }),
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

