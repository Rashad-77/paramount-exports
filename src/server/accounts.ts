import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { phoneKey } from "@/lib/contact";
import { getDb } from "@/lib/db/client";
import { customerAccounts, customerCarts, messages, orderItems, orders } from "@/lib/db/schema";
import { notFound, rateLimited } from "@/lib/errors";
import { hitRateLimit } from "@/lib/rate-limit";
import { savedCartSchema, type SavedCartItem } from "@/lib/schemas/accounts";
import type { TrackedOrder } from "@/lib/schemas/tracking";
import { toTrackedOrder } from "./tracking";

/**
 * Everything a signed-in customer can see or change, always filtered by THEIR account id in the database query itself.
 * The id comes from the verified session (getCustomer), never from the request.
 */

export interface AccountOrderRow {
  reference: string;
  status: TrackedOrder["status"];
  placedAt: string;
  currency: string;
  total: string;
  itemCount: number;
}

export async function listAccountOrders(accountId: string, limit = 50): Promise<AccountOrderRow[]> {
  const rows = await getDb()
    .select({
      reference: orders.reference,
      status: orders.status,
      createdAt: orders.createdAt,
      currency: orders.currency,
      total: orders.total,
      itemCount: sql<number>`coalesce((select sum(${orderItems.quantity}) from ${orderItems} where ${orderItems.orderId} = ${orders.id}), 0)::int`,
    })
    .from(orders)
    .where(eq(orders.accountId, accountId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return rows.map((r) => ({ reference: r.reference, status: r.status, placedAt: r.createdAt.toISOString(), currency: r.currency, total: r.total, itemCount: Number(r.itemCount) }));
}

/** One of the customer's own orders, or "not found" for anything that is not theirs (the same answer, so nothing leaks). */
export async function getAccountOrder(accountId: string, reference: string): Promise<TrackedOrder> {
  const [order] = await getDb()
    .select()
    .from(orders)
    .where(and(eq(orders.reference, reference), eq(orders.accountId, accountId)))
    .limit(1);
  if (!order) throw notFound("We could not find that order on your account.");
  return toTrackedOrder(order);
}

const CLAIM_LIMIT = { limit: 8, windowSeconds: 3600 } as const;
const CLAIM_NOT_FOUND = "We could not find an order with that number and phone number. Please check them and try again, or contact us.";

/**
 * Add an earlier (guest) order to the account. Needs the same proof as the public tracking form: the order number and the phone
 * number it was placed with. An order that already belongs to a different account cannot be taken, and looks like "not found".
 */
export async function claimOrder(accountId: string, input: { reference: string; phone: string }): Promise<{ reference: string }> {
  const db = getDb();
  const hit = await hitRateLimit(db, { scope: "claim-account", value: accountId, ...CLAIM_LIMIT });
  if (!hit.allowed) throw rateLimited("Too many attempts. Please wait a while, or contact us and we will help.");
  const [order] = await db.select().from(orders).where(eq(orders.reference, input.reference)).limit(1);
  if (!order || order.phoneKey !== phoneKey(input.phone)) throw notFound(CLAIM_NOT_FOUND);
  if (order.accountId && order.accountId !== accountId) throw notFound(CLAIM_NOT_FOUND);
  if (!order.accountId) await db.update(orders).set({ accountId }).where(and(eq(orders.id, order.id), sql`${orders.accountId} IS NULL`));
  return { reference: order.reference };
}

export interface AccountQuotationRow {
  reference: string;
  kind: string;
  summary: string;
  createdAt: string;
  isHandled: boolean;
}

export async function listAccountQuotations(accountId: string, limit = 50): Promise<AccountQuotationRow[]> {
  const rows = await getDb().select().from(messages).where(eq(messages.accountId, accountId)).orderBy(desc(messages.createdAt)).limit(limit);
  return rows.map((m) => {
    const payload = (m.payload ?? {}) as { furnitureType?: string | null };
    const summary = m.kind === "custom" ? (payload.furnitureType ?? "Made-to-measure piece") : (m.message ?? "").slice(0, 120);
    return { reference: m.reference, kind: m.kind, summary, createdAt: m.createdAt.toISOString(), isHandled: m.isHandled };
  });
}

export async function updateProfile(accountId: string, input: { fullName: string; phone?: string; address?: string }): Promise<void> {
  await getDb()
    .update(customerAccounts)
    .set({
      fullName: input.fullName,
      phone: input.phone ?? null,
      phoneKey: input.phone ? phoneKey(input.phone) : null,
      address: input.address ?? null,
      updatedAt: new Date(),
    })
    .where(eq(customerAccounts.id, accountId));
}

export async function getSavedCart(accountId: string): Promise<SavedCartItem[]> {
  const [row] = await getDb().select().from(customerCarts).where(eq(customerCarts.accountId, accountId)).limit(1);
  const parsed = savedCartSchema.safeParse(row?.items ?? []);
  return parsed.success ? parsed.data : [];
}

export async function saveCart(accountId: string, items: SavedCartItem[]): Promise<void> {
  const clean = savedCartSchema.parse(items);
  await getDb()
    .insert(customerCarts)
    .values({ accountId, items: clean })
    .onConflictDoUpdate({ target: customerCarts.accountId, set: { items: clean, updatedAt: new Date() } });
}

/** Counts for the account overview. */
export async function accountSummary(accountId: string): Promise<{ orders: number; open: number; quotations: number }> {
  const db = getDb();
  const [o] = await db
    .select({ n: sql<number>`count(*)::int`, open: sql<number>`count(*) filter (where ${orders.status} in ('new','confirmed','in_progress'))::int` })
    .from(orders)
    .where(eq(orders.accountId, accountId));
  const [q] = await db.select({ n: sql<number>`count(*)::int` }).from(messages).where(eq(messages.accountId, accountId));
  return { orders: Number(o?.n ?? 0), open: Number(o?.open ?? 0), quotations: Number(q?.n ?? 0) };
}
