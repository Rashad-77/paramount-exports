import "server-only";
import { quoteRef } from "@/lib/quotation-ui";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { phoneKey } from "@/lib/contact";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { customerAccounts, messages, orderItems, orders, productVariants, products, uploadedFiles } from "@/lib/db/schema";
import { invalidState, notFound, rateLimited, validation } from "@/lib/errors";
import { formatMoney, moneyString } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { clearRateLimit, hitRateLimit } from "@/lib/rate-limit";
import type { EnquiryInput } from "@/lib/schemas/enquiry";
import { recordAudit } from "./audit";
import { recordUpdate } from "./account-updates";
import { emailCustomer } from "./notify";
import { linkUploads, verifyUploads } from "./files";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const ENQUIRY_LIMITS = {
  perIp: { limit: 5, windowSeconds: 600 },
  perPhone: { limit: 5, windowSeconds: 3600 },
} as const;

/**
 * Public contact form, product enquiry or custom-furniture request, stored as a message for staff to answer.
 * Callers must have passed the form guard (honeypot / token / Turnstile) already.
 */
export async function submitEnquiry(input: EnquiryInput, ctx: { ip: string | null; accountId?: string | null }): Promise<{ id: string; reference: string }> {
  const db = getDb();
  const key = phoneKey(input.phone);

  const ipHit = await hitRateLimit(db, { scope: "enquiry-ip", value: ctx.ip ?? "unknown", ...ENQUIRY_LIMITS.perIp });
  if (!ipHit.allowed) throw rateLimited("You have sent several messages recently. Please wait a few minutes, or call us instead.");
  const phoneHit = await hitRateLimit(db, { scope: "enquiry-phone", value: key, ...ENQUIRY_LIMITS.perPhone });
  if (!phoneHit.allowed) {
    const minutes = Math.max(1, Math.ceil(phoneHit.retryAfterSeconds / 60));
    throw rateLimited(`Hourly ${input.kind === "custom" ? "quotation" : "enquiry"} limit reached. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`);
  }

  // The product must exist and be public; a message cannot be attached to a hidden or archived item.
  let productId: string | null = null;
  let variantId: string | null = null;
  if (input.productId) {
    const [p] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.isPublished, true), isNull(products.archivedAt)))
      .limit(1);
    if (!p) throw validation("That product is no longer available. Please choose another or contact us directly.");
    productId = p.id;
    if (input.variantId) {
      const [v] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.id, input.variantId), eq(productVariants.productId, p.id), eq(productVariants.isActive, true)))
        .limit(1);
      variantId = v?.id ?? null;
    }
  }

  const verified = await verifyUploads(input.fileIds, "enquiry", null);
  const payload =
    input.kind === "custom"
      ? {
          furnitureType: input.furnitureType ?? null,
          dimensions: input.dimensions ?? null,
          material: input.material ?? null,
          finish: input.finish ?? null,
          budgetRange: input.budgetRange ?? null,
          targetDate: input.targetDate ?? null,
        }
      : null;

  return withTx(async (tx) => {
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('message') AS ref`)) as unknown as [{ ref: string }];
    const [row] = await tx
      .insert(messages)
      .values({
        reference: ref,
        kind: input.kind,
        name: input.name,
        phone: input.phone,
        phoneKey: key,
        email: input.email ?? null,
        preferredContact: input.preferredContact ?? null,
        message: input.message ?? null,
        productId,
        variantId,
        payload,
        quoteStatus: input.kind === "custom" ? "requested" : null,
        accountId: ctx.accountId ?? null,
      })
      .returning({ id: messages.id, reference: messages.reference });
    await linkUploads(tx, verified, { type: "message", id: row!.id });
    await recordAudit(tx, null, { action: "message.received_from_website", entityType: "message", entityId: row!.id, after: { reference: row!.reference, kind: input.kind, files: verified.length } });
    return { id: row!.id, reference: row!.reference };
  });
}

/* ───────────────────────────── staff ───────────────────────────── */

export interface MessageFilters {
  state?: "open" | "handled";
  q?: string;
  page: number;
  pageSize: number;
}

export async function listMessages(actor: Actor, f: MessageFilters) {
  requirePermission(actor, "messages:view");
  const where: SQL[] = [];
  if (f.state === "open") where.push(eq(messages.isHandled, false));
  if (f.state === "handled") where.push(eq(messages.isHandled, true));
  if (f.q) {
    const like = `%${escapeLike(f.q.replace(/^quo(?=[-sd])/i, "MSG"))}%`; // a quotation can be searched by its QUO number
    where.push(or(ilike(messages.reference, like), ilike(messages.name, like), ilike(messages.phone, like), ilike(messages.email, like), ilike(messages.message, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, [totalRow], [openRow]] = await Promise.all([
    db
      .select({
        id: messages.id,
        reference: messages.reference,
        kind: messages.kind,
        isHandled: messages.isHandled,
        name: messages.name,
        phone: messages.phone,
        message: messages.message,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(cond)
      .orderBy(desc(messages.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(messages).where(cond),
    db.select({ n: count() }).from(messages).where(eq(messages.isHandled, false)),
  ]);
  const total = totalRow?.n ?? 0;
  return { rows, total, open: openRow?.n ?? 0, pageCount: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export async function getMessage(actor: Actor, id: string) {
  requirePermission(actor, "messages:view");
  const db = getDb();
  const [m] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  if (!m) throw notFound("That message could not be found.");
  const [product] = m.productId ? await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, m.productId)).limit(1) : [];
  const files = await db
    .select({ id: uploadedFiles.id, name: uploadedFiles.originalName, size: uploadedFiles.sizeBytes })
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.entityType, "message"), eq(uploadedFiles.entityId, id), eq(uploadedFiles.status, "linked")));
  const [order] = m.orderId ? await db.select({ id: orders.id, reference: orders.reference }).from(orders).where(eq(orders.id, m.orderId)).limit(1) : [];
  const [account] = m.accountId ? await db.select({ address: customerAccounts.address }).from(customerAccounts).where(eq(customerAccounts.id, m.accountId)).limit(1) : [];
  return { message: m, product: product ?? null, files, order: order ?? null, accountAddress: account?.address ?? null };
}

export async function setMessageHandled(actor: Actor, id: string, handled: boolean): Promise<void> {
  requirePermission(actor, "messages:handle");
  await withTx(async (tx) => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, id)).for("update");
    if (!m) throw notFound("That message could not be found.");
    await tx
      .update(messages)
      .set({ isHandled: handled, inProgress: false, handledAt: handled ? new Date() : null, handledBy: handled ? actor.id : null })
      .where(eq(messages.id, id));
    await recordAudit(tx, actor, { action: handled ? "message.handled" : "message.reopened", entityType: "message", entityId: id, before: { isHandled: m.isHandled }, after: { isHandled: handled } });
  });
}

/* ───────────────────────────── quotations (made-to-measure requests) ───────────────────────────── */

/** The customer to tell: their account if they have one, else the email on the request. */
async function quoteAudience(tx: DbOrTx, m: typeof messages.$inferSelect): Promise<{ accountId: string | null; email: string | null }> {
  if (!m.accountId) return { accountId: null, email: m.email };
  const [a] = await tx.select({ email: customerAccounts.email }).from(customerAccounts).where(eq(customerAccounts.id, m.accountId)).limit(1);
  return { accountId: a ? m.accountId : null, email: a?.email ?? m.email };
}

/** Staff put a price on a request. It can be sent again (a new price) until the customer accepts it. */
export async function sendQuote(actor: Actor, id: string, input: { amount: string; validUntil?: string; note?: string }): Promise<void> {
  requirePermission(actor, "messages:handle");
  const business = await getBusinessSettings();
  let notify: { email: string | null; subject: string; text: string } | null = null;
  await withTx(async (tx) => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, id)).for("update");
    if (!m) throw notFound("That request could not be found.");
    if (m.kind !== "custom") throw invalidState("Only made-to-measure requests can be quoted.");
    if (m.quoteStatus === "accepted" || m.quoteStatus === "cancelled") throw invalidState(`A quotation that is ${m.quoteStatus} cannot be priced again.`);
    const amount = moneyString(input.amount);
    await tx
      .update(messages)
      .set({ quoteStatus: "quoted", quotedAmount: amount, quoteValidUntil: input.validUntil ?? null, quoteNote: input.note ?? null, quotedAt: new Date(), respondedAt: null, declineReason: null, isHandled: true, handledAt: new Date(), handledBy: actor.id })
      .where(eq(messages.id, id));
    await recordAudit(tx, actor, { action: "quotation.priced", entityType: "message", entityId: id, before: { status: m.quoteStatus, amount: m.quotedAmount }, after: { status: "quoted", amount } });
    const who = await quoteAudience(tx, m);
    const price = formatMoney(amount, business.currency);
    await recordUpdate(tx, who.accountId, { kind: "quotation", title: `Your quotation ${quoteRef(m.reference)} is ready`, body: `Our price is ${price}. Please read it and accept or decline.` });
    notify = {
      email: who.email,
      subject: `Your quotation ${quoteRef(m.reference)} is ready - ${business.name}`,
      text: [
        `Hello ${m.name},`,
        ``,
        `Thank you for your quotation request. Our price is ${price}.`,
        input.validUntil ? `This price is valid until ${input.validUntil}.` : null,
        input.note ? `\n${input.note}` : null,
        ``,
        `To accept, please call us on ${business.phone ?? "the number on our website"} and quote ${quoteRef(m.reference)}.`,
        ``,
        business.name,
      ]
        .filter((l): l is string => l !== null)
        .join("\n"),
    };
  });
  if (notify) emailCustomer((notify as { email: string | null }).email, (notify as { subject: string }).subject, (notify as { text: string }).text);
}

/** Staff close a request without pricing it, or withdraw a price that was not answered. */
export async function closeQuotation(actor: Actor, id: string, reason?: string): Promise<void> {
  requirePermission(actor, "messages:handle");
  await withTx(async (tx) => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, id)).for("update");
    if (!m) throw notFound("That request could not be found.");
    if (m.kind !== "custom") throw invalidState("Only made-to-measure requests can be closed this way.");
    if (m.quoteStatus === "accepted" || m.quoteStatus === "cancelled" || m.quoteStatus === "declined") throw invalidState(`A quotation that is ${m.quoteStatus} cannot be closed.`);
    await tx.update(messages).set({ quoteStatus: "cancelled", declineReason: reason ?? null, respondedAt: new Date(), isHandled: true, handledAt: new Date(), handledBy: actor.id }).where(eq(messages.id, id));
    await recordAudit(tx, actor, { action: "quotation.closed", entityType: "message", entityId: id, before: { status: m.quoteStatus }, after: { status: "cancelled" }, reason });
    const who = await quoteAudience(tx, m);
    await recordUpdate(tx, who.accountId, { kind: "quotation", title: `Quotation ${quoteRef(m.reference)} has been closed`, body: reason ?? "Please contact us if you would like to talk about it." });
  });
}

/** An accepted quotation becomes a confirmed order with one line: the made-to-measure piece, at the agreed price. */
export async function createOrderFromQuotation(actor: Actor, id: string, input: { fulfilment: "delivery" | "pickup"; address?: string; paymentMethod: "on_delivery" | "bank_transfer" | "at_showroom" }): Promise<{ id: string; reference: string }> {
  requirePermission(actor, "messages:handle");
  requirePermission(actor, "orders:update");
  const business = await getBusinessSettings();
  let notify: { email: string | null; subject: string; text: string } | null = null;
  const created = await withTx(async (tx) => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, id)).for("update");
    if (!m) throw notFound("That request could not be found.");
    if (m.kind !== "custom") throw invalidState("Only made-to-measure requests can become an order this way.");
    if (m.orderId) throw invalidState("An order has already been made from this quotation.");
    if (m.quoteStatus !== "accepted" || !m.quotedAmount) throw invalidState("The customer has not accepted a price yet.");
    const payload = (m.payload ?? {}) as { furnitureType?: string | null };
    const name = `Made to measure: ${payload.furnitureType ?? "custom piece"} (${m.reference})`;
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('order') AS ref`)) as unknown as [{ ref: string }];
    const amount = moneyString(m.quotedAmount);
    const [order] = await tx
      .insert(orders)
      .values({
        reference: ref,
        status: "confirmed",
        confirmedAt: new Date(),
        customerName: m.name,
        phone: m.phone,
        phoneKey: m.phoneKey,
        email: m.email,
        emailLower: m.email ? m.email.toLowerCase() : null,
        fulfilment: input.fulfilment,
        address: input.fulfilment === "delivery" ? (input.address ?? null) : null,
        paymentMethod: input.paymentMethod,
        currency: business.currency,
        subtotal: amount,
        deliveryCharge: "0.00",
        total: amount,
        customerNote: m.quoteNote ? `From quotation ${m.reference}. ${m.quoteNote}` : `From quotation ${m.reference}.`,
        accountId: m.accountId,
        handledBy: actor.id,
      })
      .returning({ id: orders.id, reference: orders.reference });
    await tx.insert(orderItems).values({ orderId: order!.id, position: 1, productName: name, unitPrice: amount, quantity: 1, lineTotal: amount });
    await tx.update(messages).set({ orderId: order!.id, isHandled: true, handledAt: new Date(), handledBy: actor.id }).where(eq(messages.id, id));
    await recordAudit(tx, actor, { action: "quotation.order_created", entityType: "message", entityId: id, after: { orderId: order!.id, reference: order!.reference } });
    const who = await quoteAudience(tx, m);
    await recordUpdate(tx, who.accountId, { kind: "order", title: `Your order ${order!.reference} is confirmed`, body: `Made from quotation ${m.reference}.`, link: `/account/orders/${order!.reference}` });
    notify = {
      email: who.email,
      subject: `Your order ${order!.reference} is confirmed - ${business.name}`,
      text: [`Hello ${m.name},`, ``, `Thank you for accepting quotation ${m.reference}. Your order ${order!.reference} is now confirmed, for ${formatMoney(amount, business.currency)}.`, ``, `We will be in touch about delivery or collection.`, ``, business.name].join("\n"),
    };
    return { id: order!.id, reference: order!.reference };
  });
  if (notify) emailCustomer((notify as { email: string | null }).email, (notify as { subject: string }).subject, (notify as { text: string }).text);
  return created;
}

/* ───────────────────────────── staff: quotation and enquiry lists ───────────────────────────── */

/** Staff filter quotations two ways: New (not answered yet) and Responded (everything after that). */
export type QuoteFilter = "requested" | "responded";
export type EnquiryState = "new" | "responded";

const isQuotation = eq(messages.kind, "custom");
const isEnquiry = sql`${messages.kind} <> 'custom'`;
const enquiryStateCond = (s: EnquiryState): SQL => (s === "responded" ? eq(messages.isHandled, true) : eq(messages.isHandled, false));

/** Made-to-measure requests with their quotation status, newest first. */
export async function listQuotations(actor: Actor, f: { status?: QuoteFilter; q?: string; sort?: "latest" | "oldest"; page: number; pageSize: number }) {
  requirePermission(actor, "messages:view");
  const where: SQL[] = [isQuotation];
  // Quotations are answered by contacting the customer, so New and Responded follow the handled flag.
  if (f.status === "requested") where.push(eq(messages.isHandled, false));
  else if (f.status === "responded") where.push(eq(messages.isHandled, true));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(messages.reference, like), ilike(messages.name, like), ilike(messages.phone, like), ilike(messages.email, like), ilike(messages.message, like))!);
  }
  const cond = and(...where);
  const db = getDb();
  const [rows, [totalRow], countRows] = await Promise.all([
    db
      .select({ id: messages.id, reference: messages.reference, name: messages.name, phone: messages.phone, message: messages.message, payload: messages.payload, isHandled: messages.isHandled, createdAt: messages.createdAt })
      .from(messages)
      .where(cond)
      .orderBy(f.sort === "oldest" ? asc(messages.createdAt) : desc(messages.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(messages).where(cond),
    db.select({ handled: messages.isHandled, n: count() }).from(messages).where(isQuotation).groupBy(messages.isHandled),
  ]);
  const counts: Record<QuoteFilter | "all", number> = { all: 0, requested: 0, responded: 0 };
  for (const r of countRows) {
    counts.all += r.n;
    if (r.handled) counts.responded += r.n;
    else counts.requested += r.n;
  }
  const total = totalRow?.n ?? 0;
  return { rows, counts, total, pageCount: Math.max(1, Math.ceil(total / f.pageSize)) };
}

/** Contact-form messages and product questions, with the state staff have put them in. */
export async function listEnquiries(actor: Actor, f: { state?: EnquiryState; q?: string; sort?: "latest" | "oldest"; page: number; pageSize: number }) {
  requirePermission(actor, "messages:view");
  const where: SQL[] = [isEnquiry];
  if (f.state) where.push(enquiryStateCond(f.state));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(messages.reference, like), ilike(messages.name, like), ilike(messages.phone, like), ilike(messages.email, like), ilike(messages.message, like))!);
  }
  const cond = and(...where);
  const db = getDb();
  const [rows, [totalRow], [nNew], [nDone]] = await Promise.all([
    db
      .select({ id: messages.id, reference: messages.reference, kind: messages.kind, isHandled: messages.isHandled, inProgress: messages.inProgress, name: messages.name, phone: messages.phone, message: messages.message, createdAt: messages.createdAt, productName: products.name })
      .from(messages)
      .leftJoin(products, eq(products.id, messages.productId))
      .where(cond)
      .orderBy(f.sort === "oldest" ? asc(messages.createdAt) : desc(messages.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(messages).where(cond),
    db.select({ n: count() }).from(messages).where(and(isEnquiry, enquiryStateCond("new"))),
    db.select({ n: count() }).from(messages).where(and(isEnquiry, enquiryStateCond("responded"))),
  ]);
  const counts = { new: nNew?.n ?? 0, responded: nDone?.n ?? 0, all: (nNew?.n ?? 0) + (nDone?.n ?? 0) };
  const total = totalRow?.n ?? 0;
  return { rows, counts, total, pageCount: Math.max(1, Math.ceil(total / f.pageSize)) };
}

/** Staff move an enquiry between new and responded. */
/** Marks an enquiry or a quotation request as responded, or back to new. Returns which kind it was, so the message can name it. */
export async function setEnquiryState(actor: Actor, id: string, state: EnquiryState): Promise<"request" | "enquiry"> {
  requirePermission(actor, "messages:handle");
  return withTx(async (tx) => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, id)).for("update");
    if (!m) throw notFound("That message could not be found.");
    const responded = state === "responded";
    await tx
      .update(messages)
      .set({ isHandled: responded, inProgress: false, handledAt: responded ? new Date() : null, handledBy: responded ? actor.id : null })
      .where(eq(messages.id, id));
    await recordAudit(tx, actor, { action: `message.${state}`, entityType: "message", entityId: id, before: { isHandled: m.isHandled, inProgress: m.inProgress }, after: { state } });
    return m.kind === "custom" ? "request" : "enquiry";
  });
}

/** Staff start looking at a request: it moves from "new" to "under review". */
export async function startQuoteReview(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, "messages:handle");
  await withTx(async (tx) => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, id)).for("update");
    if (!m) throw notFound("That request could not be found.");
    if (m.kind !== "custom") throw invalidState("Only made-to-measure requests can be reviewed this way.");
    if (m.quoteStatus !== "requested") throw invalidState("Only a new request can be moved to under review.");
    await tx.update(messages).set({ quoteStatus: "under_review", handledBy: actor.id }).where(eq(messages.id, id));
    await recordAudit(tx, actor, { action: "quotation.under_review", entityType: "message", entityId: id, before: { status: m.quoteStatus }, after: { status: "under_review" } });
  });
}

/** Owner only: permanently deletes quotation requests or enquiries (and their replies). Returns how many were deleted. */
async function deleteMessages(actor: Actor, ids: string[], kind: "quotation" | "enquiry"): Promise<number> {
  requirePermission(actor, "customers:delete");
  const unique = [...new Set(ids)];
  if (unique.length === 0) return 0;
  return withTx(async (tx) => {
    const found = await tx
      .select({ id: messages.id, reference: messages.reference, name: messages.name, phoneKey: messages.phoneKey })
      .from(messages)
      .where(and(inArray(messages.id, unique), kind === "quotation" ? isQuotation : isEnquiry))
      .for("update");
    if (found.length === 0) return 0;
    await tx.delete(messages).where(inArray(messages.id, found.map((m) => m.id)));
    // The "several messages from this phone number" limit counts what a number has sent: with those messages deleted, it starts again from zero.
    for (const key of new Set(found.map((m) => m.phoneKey))) await clearRateLimit(tx, { scope: "enquiry-phone", value: key });
    for (const m of found) await recordAudit(tx, actor, { action: `${kind}.deleted`, entityType: "message", entityId: m.id, before: { reference: m.reference, name: m.name } });
    return found.length;
  });
}

export const deleteQuotations = (actor: Actor, ids: string[]) => deleteMessages(actor, ids, "quotation");
export const deleteEnquiries = (actor: Actor, ids: string[]) => deleteMessages(actor, ids, "enquiry");
