import { outer } from "@/lib/db/outer";
import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { phoneKey } from "@/lib/contact";
import { getDb, withTx } from "@/lib/db/client";
import { customerAccounts, customerAddresses, customerCarts, customerWishlist, messages, orderItems, orders, products, uploadedFiles } from "@/lib/db/schema";
import { invalidState, notFound, rateLimited, validation } from "@/lib/errors";
import { isQuoteStatus, QUOTE_DETAIL_LABELS, quoteRef, type QuoteStatus } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { todayLocal } from "@/lib/time";
import { hitRateLimit } from "@/lib/rate-limit";
import { savedCartSchema, type SavedCartItem } from "@/lib/schemas/accounts";
import type { TrackedOrder } from "@/lib/schemas/tracking";
import { recordAudit } from "./audit";
import { firstImages, listPublicProductsByIds } from "./catalogue-public";
import { notifyQuotationAnswered } from "./notify";
import { recordUpdate } from "./account-updates";
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
  items: Array<{ name: string; variant: string | null; quantity: number; unitPrice: string; imageUrl: string | null; imageAlt: string | null }>;
}

export async function listAccountOrders(accountId: string, limit = 50): Promise<AccountOrderRow[]> {
  const rows = await getDb()
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      createdAt: orders.createdAt,
      currency: orders.currency,
      total: orders.total,
      itemCount: sql<number>`coalesce((select sum(${orderItems.quantity}) from ${orderItems} where ${orderItems.orderId} = ${outer(orders.id)}), 0)::int`,
    })
    .from(orders)
    .where(eq(orders.accountId, accountId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  const ids = rows.map((r) => r.id);
  const lines = ids.length
    ? await getDb()
        .select({ orderId: orderItems.orderId, productId: orderItems.productId, name: orderItems.productName, variant: orderItems.variantLabel, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice })
        .from(orderItems)
        .where(inArray(orderItems.orderId, ids))
        .orderBy(asc(orderItems.orderId), asc(orderItems.position))
    : [];
  const pics = await firstImages(lines.map((l) => l.productId).filter((v): v is string => Boolean(v)));
  return rows.map((r) => ({
    reference: r.reference,
    status: r.status,
    placedAt: r.createdAt.toISOString(),
    currency: r.currency,
    total: r.total,
    itemCount: Number(r.itemCount),
    items: lines
      .filter((l) => l.orderId === r.id)
      .map((l) => {
        const pic = l.productId ? pics.get(l.productId) : undefined;
        return { name: l.name, variant: l.variant, quantity: l.quantity, unitPrice: l.unitPrice, imageUrl: pic?.url ?? null, imageAlt: pic?.alt ?? null };
      }),
  }));
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

/* ───────────────────────────── quotations ───────────────────────────── */

export interface AccountQuotationRow {
  reference: string;
  summary: string;
  createdAt: string;
  status: QuoteStatus;
  quotedAmount: string | null;
  validUntil: string | null;
  orderReference: string | null;
}

const statusOf = (v: string | null): QuoteStatus => (isQuoteStatus(v) ? v : "requested");
const summaryOf = (payload: unknown) => ((payload ?? {}) as { furnitureType?: string | null }).furnitureType || "Made-to-measure piece";

/** The customer's made-to-measure requests (quotations), newest first. Other messages are not quotations and are not listed. */
export async function listAccountQuotations(accountId: string, limit = 50): Promise<AccountQuotationRow[]> {
  const rows = await getDb()
    .select({ m: messages, orderReference: orders.reference })
    .from(messages)
    .leftJoin(orders, eq(orders.id, messages.orderId))
    .where(and(eq(messages.accountId, accountId), eq(messages.kind, "custom")))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.map(({ m, orderReference }) => ({
    reference: m.reference,
    summary: summaryOf(m.payload),
    createdAt: m.createdAt.toISOString(),
    status: statusOf(m.quoteStatus),
    quotedAmount: m.quotedAmount,
    validUntil: m.quoteValidUntil,
    orderReference,
  }));
}

export interface AccountQuotation extends AccountQuotationRow {
  message: string | null;
  details: Array<{ label: string; value: string }>;
  quoteNote: string | null;
  quotedAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
  fileCount: number;
  /** The price can be accepted or declined right now. */
  canRespond: boolean;
  expired: boolean;
}

/** One of the customer's own quotations; anything that is not theirs looks like "not found". */
export async function getAccountQuotation(accountId: string, reference: string): Promise<AccountQuotation> {
  const db = getDb();
  const [row] = await db
    .select({ m: messages, orderReference: orders.reference })
    .from(messages)
    .leftJoin(orders, eq(orders.id, messages.orderId))
    .where(and(eq(messages.reference, reference), eq(messages.accountId, accountId), eq(messages.kind, "custom")))
    .limit(1);
  if (!row) throw notFound("We could not find that quotation on your account.");
  const { m, orderReference } = row;
  const [files] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.entityType, "message"), eq(uploadedFiles.entityId, m.id), eq(uploadedFiles.status, "linked")));
  const { timezone } = await getBusinessSettings();
  const status = statusOf(m.quoteStatus);
  const expired = status === "quoted" && Boolean(m.quoteValidUntil && m.quoteValidUntil < todayLocal(timezone));
  const payload = (m.payload ?? {}) as Record<string, unknown>;
  return {
    reference: m.reference,
    summary: summaryOf(m.payload),
    createdAt: m.createdAt.toISOString(),
    status,
    quotedAmount: m.quotedAmount,
    validUntil: m.quoteValidUntil,
    orderReference,
    message: m.message,
    details: Object.entries(QUOTE_DETAIL_LABELS)
      .map(([k, label]) => ({ label, value: payload[k] ? String(payload[k]) : "" }))
      .filter((d) => d.value),
    quoteNote: m.quoteNote,
    quotedAt: m.quotedAt?.toISOString() ?? null,
    respondedAt: m.respondedAt?.toISOString() ?? null,
    declineReason: m.declineReason,
    fileCount: Number(files?.n ?? 0),
    canRespond: status === "quoted" && !expired,
    expired,
  };
}

const RESPOND_LIMIT = { limit: 20, windowSeconds: 3600 } as const;

/**
 * The customer accepts or declines the price they were sent. Only the owner of the quotation can answer, only while it is "quoted"
 * and has not run out, and the answer is final. Accepting tells the business, who then confirm the order.
 */
export async function respondToQuotation(accountId: string, reference: string, decision: "accept" | "decline", reason?: string): Promise<void> {
  const db = getDb();
  const hit = await hitRateLimit(db, { scope: "quote-respond", value: accountId, ...RESPOND_LIMIT });
  if (!hit.allowed) throw rateLimited("Too many attempts. Please wait a while, or contact us.");
  const { timezone } = await getBusinessSettings();
  const messageId = await withTx(async (tx) => {
    const [m] = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.reference, reference), eq(messages.accountId, accountId), eq(messages.kind, "custom")))
      .for("update");
    if (!m) throw notFound("We could not find that quotation on your account.");
    if (m.quoteStatus !== "quoted") {
      throw invalidState(m.quoteStatus === "accepted" || m.quoteStatus === "declined" ? "You have already answered this quotation." : "This quotation is not waiting for an answer.");
    }
    if (m.quoteValidUntil && m.quoteValidUntil < todayLocal(timezone)) throw invalidState("This quotation has run out. Please contact us and we will update the price.");
    const accepted = decision === "accept";
    await tx
      .update(messages)
      .set({ quoteStatus: accepted ? "accepted" : "declined", respondedAt: new Date(), declineReason: accepted ? null : (reason ?? null), isHandled: false, handledAt: null })
      .where(eq(messages.id, m.id));
    await recordUpdate(tx, accountId, {
      kind: "quotation",
      title: accepted ? `You accepted quotation ${quoteRef(m.reference)}` : `You declined quotation ${quoteRef(m.reference)}`,
      body: accepted ? "We will contact you to confirm your order." : undefined,
    });
    await recordAudit(tx, null, { action: accepted ? "quotation.accepted_by_customer" : "quotation.declined_by_customer", entityType: "message", entityId: m.id, after: { reference: m.reference } });
    return m.id;
  });
  notifyQuotationAnswered(messageId);
}

/* ───────────────────────────── enquiries ───────────────────────────── */

export interface AccountEnquiryRow {
  reference: string;
  subject: string;
  message: string | null;
  createdAt: string;
  state: "new" | "in_progress" | "responded";
}

/** The customer's own questions to the showroom (not quotations), newest first, with where each one stands. */
export async function listAccountEnquiries(accountId: string, limit = 50): Promise<AccountEnquiryRow[]> {
  const rows = await getDb()
    .select({ m: messages, productName: products.name })
    .from(messages)
    .leftJoin(products, eq(products.id, messages.productId))
    .where(and(eq(messages.accountId, accountId), sql`${messages.kind} <> 'custom'`))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.map(({ m, productName }) => ({
    reference: m.reference,
    subject: productName ? `About ${productName}` : "General question",
    message: m.message,
    createdAt: m.createdAt.toISOString(),
    state: m.isHandled ? "responded" : m.inProgress ? "in_progress" : "new",
  }));
}

/* ───────────────────────────── dashboard ───────────────────────────── */

export interface AccountDashboard {
  quotations: AccountQuotationRow[];
  activeOrders: AccountOrderRow[];
  counts: { orders: number; open: number; quotations: number; waitingForYou: number; wishlist: number; enquiries: number };
}

export async function accountDashboard(accountId: string): Promise<AccountDashboard> {
  const db = getDb();
  const [quotations, allOrders, summary, wish, enq] = await Promise.all([
    listAccountQuotations(accountId, 20),
    listAccountOrders(accountId, 20),
    accountSummary(accountId),
    db.select({ n: sql<number>`count(*)::int` }).from(customerWishlist).where(eq(customerWishlist.accountId, accountId)),
    db.select({ n: sql<number>`count(*)::int` }).from(messages).where(and(eq(messages.accountId, accountId), sql`${messages.kind} <> 'custom'`)),
  ]);
  const activeOrders = allOrders.filter((o) => o.status === "new" || o.status === "confirmed" || o.status === "in_progress").slice(0, 3);
  return {
    quotations: quotations.slice(0, 3),
    activeOrders,
    counts: { ...summary, waitingForYou: quotations.filter((q) => q.status === "quoted").length, wishlist: Number(wish[0]?.n ?? 0), enquiries: Number(enq[0]?.n ?? 0) },
  };
}

/* ───────────────────────────── wishlist ───────────────────────────── */

export async function wishlistIds(accountId: string): Promise<string[]> {
  const rows = await getDb().select({ id: customerWishlist.productId }).from(customerWishlist).where(eq(customerWishlist.accountId, accountId)).orderBy(desc(customerWishlist.createdAt));
  return rows.map((r) => r.id);
}

/** The saved products still on sale, newest saved first. Products taken off the website quietly drop out of the list. */
export async function listWishlist(accountId: string) {
  return listPublicProductsByIds(await wishlistIds(accountId));
}

const WISHLIST_MAX = 100;

/** Save the product, or remove it when it is already saved. Returns whether it is saved now. */
export async function toggleWishlist(accountId: string, productId: string): Promise<boolean> {
  const db = getDb();
  const [existing] = await db.select().from(customerWishlist).where(and(eq(customerWishlist.accountId, accountId), eq(customerWishlist.productId, productId))).limit(1);
  if (existing) {
    await db.delete(customerWishlist).where(and(eq(customerWishlist.accountId, accountId), eq(customerWishlist.productId, productId)));
    return false;
  }
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.isPublished, true), sql`${products.archivedAt} IS NULL`)).limit(1);
  if (!p) throw notFound("That product is no longer available.");
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(customerWishlist).where(eq(customerWishlist.accountId, accountId));
  if (n >= WISHLIST_MAX) throw validation(`You can save up to ${WISHLIST_MAX} products. Remove some to add more.`);
  await db.insert(customerWishlist).values({ accountId, productId }).onConflictDoNothing();
  return true;
}

/* ───────────────────────────── addresses ───────────────────────────── */

export interface AccountAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string | null;
  address: string;
  isDefault: boolean;
}

const ADDRESS_MAX = 10;

export async function listAddresses(accountId: string): Promise<AccountAddress[]> {
  const rows = await getDb().select().from(customerAddresses).where(eq(customerAddresses.accountId, accountId)).orderBy(desc(customerAddresses.isDefault), asc(customerAddresses.createdAt));
  return rows.map((r) => ({ id: r.id, label: r.label, recipient: r.recipient, phone: r.phone, address: r.address, isDefault: r.isDefault }));
}

/** Keeps the single default address mirrored on the account, which is what checkout offers first. */
async function syncDefaultAddress(tx: Parameters<Parameters<typeof withTx>[0]>[0], accountId: string) {
  const [d] = await tx.select({ address: customerAddresses.address }).from(customerAddresses).where(and(eq(customerAddresses.accountId, accountId), eq(customerAddresses.isDefault, true))).limit(1);
  await tx.update(customerAccounts).set({ address: d?.address ?? null, updatedAt: new Date() }).where(eq(customerAccounts.id, accountId));
}

export async function saveAddress(
  accountId: string,
  input: { id?: string; label: string; recipient: string; phone?: string; address: string; isDefault: boolean },
): Promise<void> {
  await withTx(async (tx) => {
    const mine = await tx.select({ id: customerAddresses.id, isDefault: customerAddresses.isDefault }).from(customerAddresses).where(eq(customerAddresses.accountId, accountId));
    if (input.id) {
      if (!mine.some((a) => a.id === input.id)) throw notFound("We could not find that address.");
    } else if (mine.length >= ADDRESS_MAX) {
      throw validation(`You can keep up to ${ADDRESS_MAX} addresses. Delete one to add another.`);
    }
    // The first address is the default; a default address cannot be un-defaulted except by choosing another.
    const makeDefault = input.isDefault || mine.length === 0 || (input.id ? mine.find((a) => a.id === input.id)?.isDefault === true : false);
    if (makeDefault) await tx.update(customerAddresses).set({ isDefault: false }).where(and(eq(customerAddresses.accountId, accountId), eq(customerAddresses.isDefault, true)));
    const values = { label: input.label, recipient: input.recipient, phone: input.phone ?? null, address: input.address, isDefault: makeDefault, updatedAt: new Date() };
    if (input.id) await tx.update(customerAddresses).set(values).where(and(eq(customerAddresses.id, input.id), eq(customerAddresses.accountId, accountId)));
    else await tx.insert(customerAddresses).values({ accountId, ...values });
    await syncDefaultAddress(tx, accountId);
  });
}

export async function setDefaultAddress(accountId: string, id: string): Promise<void> {
  await withTx(async (tx) => {
    const [a] = await tx.select({ id: customerAddresses.id }).from(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.accountId, accountId))).limit(1);
    if (!a) throw notFound("We could not find that address.");
    await tx.update(customerAddresses).set({ isDefault: false }).where(and(eq(customerAddresses.accountId, accountId), eq(customerAddresses.isDefault, true)));
    await tx.update(customerAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(customerAddresses.id, id));
    await syncDefaultAddress(tx, accountId);
  });
}

export async function deleteAddress(accountId: string, id: string): Promise<void> {
  await withTx(async (tx) => {
    const [a] = await tx.select().from(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.accountId, accountId))).limit(1);
    if (!a) throw notFound("We could not find that address.");
    await tx.delete(customerAddresses).where(eq(customerAddresses.id, id));
    // When the default goes, the oldest remaining address takes over so checkout still has one to offer.
    if (a.isDefault) {
      const [next] = await tx.select({ id: customerAddresses.id }).from(customerAddresses).where(eq(customerAddresses.accountId, accountId)).orderBy(asc(customerAddresses.createdAt)).limit(1);
      if (next) await tx.update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, next.id));
    }
    await syncDefaultAddress(tx, accountId);
  });
}

export async function updateProfile(accountId: string, input: { fullName: string; phone?: string; address?: string }): Promise<void> {
  await getDb()
    .update(customerAccounts)
    .set({
      fullName: input.fullName,
      phone: input.phone ?? null,
      phoneKey: input.phone ? phoneKey(input.phone) : null,
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
  const [q] = await db.select({ n: sql<number>`count(*)::int` }).from(messages).where(and(eq(messages.accountId, accountId), eq(messages.kind, "custom")));
  return { orders: Number(o?.n ?? 0), open: Number(o?.open ?? 0), quotations: Number(q?.n ?? 0) };
}
