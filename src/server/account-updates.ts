import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/lib/db/client";
import { customerUpdates } from "@/lib/db/schema";

/**
 * "Recent updates" on a customer's dashboard: a short note whenever a quotation is priced or an order moves on.
 * Written in the same transaction as the change itself, so an update never says something that did not happen.
 */
export interface AccountUpdate {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
}

export async function recordUpdate(db: DbOrTx, accountId: string | null | undefined, u: { kind: string; title: string; body?: string; link?: string }): Promise<void> {
  if (!accountId) return;
  await db.insert(customerUpdates).values({ accountId, kind: u.kind, title: u.title, body: u.body ?? null, link: u.link ?? null });
}

export async function listAccountUpdates(accountId: string, limit = 8): Promise<AccountUpdate[]> {
  const rows = await getDb().select().from(customerUpdates).where(eq(customerUpdates.accountId, accountId)).orderBy(desc(customerUpdates.createdAt)).limit(limit);
  return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, createdAt: r.createdAt.toISOString() }));
}
