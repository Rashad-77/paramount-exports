import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { normaliseEmail, phoneKey } from "@/lib/contact";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx } from "@/lib/db/client";
import { outer } from "@/lib/db/outer";
import { messages, orderItems, orders, productVariants, products } from "@/lib/db/schema";
import { conflict, invalidState, notFound, rateLimited, validation } from "@/lib/errors";
import { dec, moneyString, sum } from "@/lib/money";
import { hitRateLimit } from "@/lib/rate-limit";
import { getBusinessSettings } from "@/lib/settings";
import { OPEN_STATUSES, type CheckoutInput, type Fulfilment, type OrderStatus } from "@/lib/schemas/orders";
import { recordAudit } from "./audit";
import { recordUpdate } from "./account-updates";
import { emailCustomer } from "./notify";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const ORDER_LIMITS = {
  perIp: { limit: 6, windowSeconds: 600 },
  perPhone: { limit: 5, windowSeconds: 3600 },
} as const;

/* ───────────────────────────── placing an order (public, no payment) ───────────────────────────── */

/**
 * A visitor places an order. Nothing is charged: the customer chooses how they intend to pay (on delivery, bank transfer, at the
 * showroom) and staff confirm the order. Prices, names and availability always come from the database, never from the browser.
 * Callers must have passed the form guard (honeypot / token / Turnstile) already.
 */
export async function placeOrder(input: CheckoutInput, ctx: { ip: string | null; accountId?: string | null }): Promise<{ id: string; reference: string }> {
  const db = getDb();
  const key = phoneKey(input.phone);

  const ipHit = await hitRateLimit(db, { scope: "order-ip", value: ctx.ip ?? "unknown", ...ORDER_LIMITS.perIp });
  if (!ipHit.allowed) throw rateLimited("You have placed several orders recently. Please wait a few minutes, or call us instead.");
  const phoneHit = await hitRateLimit(db, { scope: "order-phone", value: key, ...ORDER_LIMITS.perPhone });
  if (!phoneHit.allowed) throw rateLimited("We already have several orders from this phone number. We will be in touch shortly.");

  // Merge repeated lines for the same option.
  const wanted = new Map<string, number>();
  for (const l of input.cart) wanted.set(l.variantId, Math.min(99, (wanted.get(l.variantId) ?? 0) + l.quantity));

  const rows = await db
    .select({
      variantId: productVariants.id,
      label: productVariants.label,
      sku: productVariants.sku,
      price: productVariants.listPrice,
      variantActive: productVariants.isActive,
      productId: products.id,
      name: products.name,
      published: products.isPublished,
      archivedAt: products.archivedAt,
      showPrice: products.showPrice,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, [...wanted.keys()]));
  const byId = new Map(rows.map((r) => [r.variantId, r]));

  const lines = [...wanted.entries()].map(([variantId, quantity], i) => {
    const r = byId.get(variantId);
    const ok = r && r.variantActive && r.published && !r.archivedAt && r.showPrice && r.price !== null;
    if (!ok) throw validation("One of the items in your order is no longer available. Please review your order and try again.");
    const unit = dec(r.price!);
    return { position: i + 1, productId: r.productId, variantId, productName: r.name, variantLabel: r.label === "Standard" ? null : r.label, sku: r.sku, unit, quantity, line: unit.times(quantity) };
  });

  const subtotal = sum(lines.map((l) => l.line));
  const { currency } = await getBusinessSettings();
  const email = input.email ?? null;

  return withTx(async (tx) => {
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('order') AS ref`)) as unknown as [{ ref: string }];
    const [order] = await tx
      .insert(orders)
      .values({
        reference: ref,
        customerName: input.name,
        phone: input.phone,
        phoneKey: key,
        email,
        emailLower: email ? normaliseEmail(email) : null,
        fulfilment: input.fulfilment,
        address: input.fulfilment === "delivery" ? (input.address ?? null) : null,
        paymentMethod: input.paymentMethod,
        currency,
        subtotal: moneyString(subtotal),
        deliveryCharge: "0.00",
        total: moneyString(subtotal),
        customerNote: input.note ?? null,
        accountId: ctx.accountId ?? null,
      })
      .returning({ id: orders.id, reference: orders.reference });
    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order!.id,
        position: l.position,
        productId: l.productId,
        variantId: l.variantId,
        productName: l.productName,
        variantLabel: l.variantLabel,
        sku: l.sku,
        unitPrice: moneyString(l.unit),
        quantity: l.quantity,
        lineTotal: moneyString(l.line),
      })),
    );
    await recordAudit(tx, null, { action: "order.placed_from_website", entityType: "order", entityId: order!.id, after: { reference: order!.reference, lines: lines.length, total: moneyString(subtotal) } });
    return { id: order!.id, reference: order!.reference };
  });
}

/* ───────────────────────────── staff: reading orders ───────────────────────────── */

export interface OrderListFilters {
  status?: OrderStatus | "open";
  /** "unpaid": not cancelled and not marked paid yet. */
  payment?: "unpaid" | "paid";
  fulfilment?: Fulfilment;
  /** Only these statuses (several at once), e.g. everything waiting to be delivered. */
  statuses?: OrderStatus[];
  q?: string;
  phoneKey?: string;
  page: number;
  pageSize: number;
}

export async function listOrders(actor: Actor, f: OrderListFilters) {
  requirePermission(actor, "orders:view");
  const where: SQL[] = [];
  if (f.status === "open") where.push(inArray(orders.status, [...OPEN_STATUSES]));
  else if (f.status) where.push(eq(orders.status, f.status));
  if (f.statuses?.length) where.push(inArray(orders.status, f.statuses));
  if (f.payment === "unpaid") where.push(and(eq(orders.isPaid, false), sql`${orders.status} <> 'cancelled'`)!);
  if (f.payment === "paid") where.push(eq(orders.isPaid, true));
  if (f.fulfilment) where.push(eq(orders.fulfilment, f.fulfilment));
  if (f.phoneKey) where.push(eq(orders.phoneKey, f.phoneKey));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(orders.reference, like), ilike(orders.customerName, like), ilike(orders.phone, like), ilike(orders.email, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        status: orders.status,
        customerName: orders.customerName,
        phone: orders.phone,
        fulfilment: orders.fulfilment,
        paymentMethod: orders.paymentMethod,
        isPaid: orders.isPaid,
        currency: orders.currency,
        total: orders.total,
        deliveryCharge: orders.deliveryCharge,
        scheduledFor: orders.scheduledFor,
        address: orders.address,
        createdAt: orders.createdAt,
        quantities: sql<string>`coalesce((SELECT string_agg(i.quantity::text, E'\n' ORDER BY i.position) FROM online_order_items i WHERE i.order_id = ${outer(orders.id)}), '')`,
        contents: sql<string>`coalesce((SELECT string_agg(i.product_name || coalesce(' · ' || i.variant_label, ''), E'\n' ORDER BY i.position) FROM online_order_items i WHERE i.order_id = ${outer(orders.id)}), '')`,
        itemCount: sql<number>`coalesce((SELECT sum(i.quantity)::int FROM online_order_items i WHERE i.order_id = ${outer(orders.id)}), 0)`,
      })
      .from(orders)
      .where(cond)
      .orderBy(desc(orders.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(orders).where(cond),
  ]);
  const total = totalRow?.n ?? 0;
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export async function getOrder(actor: Actor, id: string) {
  requirePermission(actor, "orders:view");
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw notFound("That order could not be found.");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.position);
  return { order, items };
}

export async function countOrdersByStatus(actor: Actor): Promise<Record<OrderStatus | "all", number>> {
  requirePermission(actor, "orders:view");
  const rows = await getDb().select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status);
  const out: Record<OrderStatus | "all", number> = { all: 0, new: 0, confirmed: 0, in_progress: 0, ready: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 };
  for (const r of rows) {
    out[r.status] = r.n;
    out.all += r.n;
  }
  return out;
}

/* ───────────────────────────── staff: changing orders ───────────────────────────── */

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "ready", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

/** What an order can become next. A showroom pickup is never "out for delivery". */
export const allowedNextStatuses = (status: OrderStatus, fulfilment?: Fulfilment): OrderStatus[] =>
  NEXT[status].filter((s) => !(s === "out_for_delivery" && fulfilment === "pickup"));

const STATUS_NOTE: Record<OrderStatus, string> = {
  new: "has been received",
  confirmed: "is confirmed",
  in_progress: "is now being made",
  ready: "is ready",
  out_for_delivery: "is out for delivery",
  delivered: "has been delivered. Thank you for ordering with us",
  cancelled: "has been cancelled",
};

export async function setOrderStatus(actor: Actor, id: string, status: OrderStatus, reason?: string): Promise<void> {
  requirePermission(actor, status === "cancelled" ? "orders:cancel" : "orders:update");
  const business = await getBusinessSettings();
  let heardBy: { email: string | null; reference: string; name: string } | null = null;
  await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!o) throw notFound("That order could not be found.");
    if (!allowedNextStatuses(o.status, o.fulfilment).includes(status)) throw invalidState(`An order that is ${o.status.replace("_", " ")} cannot be moved to ${status.replace("_", " ")}.`);
    const now = new Date();
    await tx
      .update(orders)
      .set({
        status,
        handledBy: actor.id,
        ...(status === "confirmed" ? { confirmedAt: now } : {}),
        ...(status === "ready" ? { readyAt: now } : {}),
        ...(status === "out_for_delivery" ? { outForDeliveryAt: now } : {}),
        ...(status === "delivered" ? { deliveredAt: now, confirmedAt: o.confirmedAt ?? now } : {}),
        ...(status === "cancelled" ? { cancelledAt: now, cancelReason: reason ?? "Cancelled" } : {}),
      })
      .where(eq(orders.id, id));
    await recordAudit(tx, actor, { action: `order.${status}`, entityType: "order", entityId: id, before: { status: o.status }, after: { status }, reason });
    // Tell the customer: a note on their dashboard when they have an account, and an email when we have an address.
    await recordUpdate(tx, o.accountId, { kind: "order", title: `Order ${o.reference} ${STATUS_NOTE[status]}`, body: status === "cancelled" && reason ? reason : undefined, link: `/account/orders/${o.reference}` });
    heardBy = { email: o.email, reference: o.reference, name: o.customerName };
  });
  if (heardBy) {
    const h = heardBy as { email: string | null; reference: string; name: string };
    emailCustomer(h.email, `Your order ${h.reference} ${STATUS_NOTE[status]} - ${business.name}`, [`Hello ${h.name},`, ``, `Your order ${h.reference} ${STATUS_NOTE[status]}.`, status === "cancelled" && reason ? `Reason: ${reason}` : null, ``, `You can follow it any time on our website with your order number and phone number.`, ``, business.name].filter((l): l is string => l !== null).join("\n"));
  }
}

export async function updateOrderDetails(actor: Actor, id: string, input: { deliveryCharge: string; staffNote?: string; scheduledFor?: string }): Promise<void> {
  requirePermission(actor, "orders:update");
  await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!o) throw notFound("That order could not be found.");
    if (o.status === "delivered" || o.status === "cancelled") throw invalidState("A finished order cannot be changed.");
    const charge = moneyString(input.deliveryCharge);
    const total = moneyString(dec(o.subtotal).plus(charge));
    await tx.update(orders).set({ deliveryCharge: charge, total, staffNote: input.staffNote ?? null, scheduledFor: input.scheduledFor ?? null, handledBy: actor.id }).where(eq(orders.id, id));
    await recordAudit(tx, actor, { action: "order.details_updated", entityType: "order", entityId: id, before: { deliveryCharge: o.deliveryCharge, total: o.total }, after: { deliveryCharge: charge, total, scheduledFor: input.scheduledFor ?? null } });
  });
}

/** Staff record that the money has been received offline (cash, transfer, or at the showroom). */
export async function setOrderPaid(actor: Actor, id: string, paid: boolean): Promise<void> {
  requirePermission(actor, "orders:record_payment");
  await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!o) throw notFound("That order could not be found.");
    if (o.status === "cancelled") throw invalidState("A cancelled order cannot be marked as paid.");
    if (o.isPaid === paid) throw conflict(paid ? "That order is already marked as paid." : "That order is already marked as not paid.");
    await tx.update(orders).set({ isPaid: paid, paidAt: paid ? new Date() : null, handledBy: actor.id }).where(eq(orders.id, id));
    await recordAudit(tx, actor, { action: paid ? "order.marked_paid" : "order.marked_unpaid", entityType: "order", entityId: id, before: { isPaid: o.isPaid }, after: { isPaid: paid } });
  });
}

/* ───────────────────────────── customers (built from orders, quotations and enquiries) ───────────────────────────── */

/** Everyone who has ordered, asked for a quotation or written to the business, grouped by phone number. */
export async function listCustomers(actor: Actor, f: { q?: string; page: number; pageSize: number }) {
  requirePermission(actor, "customers:view");
  const like = f.q ? `%${escapeLike(f.q)}%` : null;
  const having = like ? sql`HAVING max(name) ILIKE ${like} OR max(phone) ILIKE ${like} OR coalesce(max(email), '') ILIKE ${like}` : sql``;
  const db = getDb();
  const source = sql`
    WITH src AS (
      SELECT phone_key, customer_name AS name, phone, email, created_at, 'order' AS what, total, status::text AS status, currency, account_id FROM online_orders
      UNION ALL
      SELECT phone_key, name, phone, email, created_at, CASE WHEN kind = 'custom' THEN 'quotation' ELSE 'enquiry' END, 0, NULL, NULL, account_id FROM messages
    )`;
  const rows = (await db.execute(sql`
    ${source}
    SELECT phone_key AS "phoneKey",
           (array_agg(name ORDER BY created_at DESC))[1] AS name,
           (array_agg(phone ORDER BY created_at DESC))[1] AS phone,
           (array_agg(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL))[1] AS email,
           (count(*) FILTER (WHERE what = 'order'))::int AS orders,
           (count(*) FILTER (WHERE what = 'quotation'))::int AS quotations,
           (count(*) FILTER (WHERE what = 'enquiry'))::int AS enquiries,
           coalesce(sum(total) FILTER (WHERE what = 'order' AND status <> 'cancelled'), 0)::text AS spent,
           coalesce(max(currency), 'LKR') AS currency,
           max(created_at) AS "lastContactAt",
           bool_or(account_id IS NOT NULL) AS "hasAccount"
      FROM src
     GROUP BY phone_key
     ${having}
     ORDER BY max(created_at) DESC
     LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
  `)) as unknown as { phoneKey: string; name: string; phone: string; email: string | null; orders: number; quotations: number; enquiries: number; spent: string; currency: string; lastContactAt: Date; hasAccount: boolean }[];
  const [{ n }] = (await db.execute(sql`${source} SELECT count(*)::int AS n FROM (SELECT 1 FROM src GROUP BY phone_key ${having}) c`)) as unknown as [{ n: number }];
  return { rows, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function getCustomer(actor: Actor, key: string) {
  requirePermission(actor, "customers:view");
  const db = getDb();
  const [list, notes] = await Promise.all([
    db.select().from(orders).where(eq(orders.phoneKey, key)).orderBy(desc(orders.createdAt)),
    db
      .select({ id: messages.id, reference: messages.reference, kind: messages.kind, name: messages.name, phone: messages.phone, email: messages.email, message: messages.message, quoteStatus: messages.quoteStatus, quotedAmount: messages.quotedAmount, isHandled: messages.isHandled, inProgress: messages.inProgress, accountId: messages.accountId, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.phoneKey, key))
      .orderBy(desc(messages.createdAt)),
  ]);
  if (list.length === 0 && notes.length === 0) throw notFound("That customer could not be found.");
  const latest = list[0];
  const contact = latest ?? notes[0]!;
  const spent = sum(list.filter((o) => o.status !== "cancelled").map((o) => o.total));
  return {
    phoneKey: key,
    name: latest ? latest.customerName : (notes[0]!.name),
    phone: contact.phone,
    email: list.find((o) => o.email)?.email ?? notes.find((m) => m.email)?.email ?? null,
    hasAccount: list.some((o) => o.accountId !== null) || notes.some((m) => m.accountId !== null),
    addresses: [...new Set(list.map((o) => o.address).filter((a): a is string => Boolean(a)))].slice(0, 3),
    currency: latest?.currency ?? "LKR",
    spent: moneyString(spent),
    orders: list,
    quotations: notes.filter((m) => m.kind === "custom"),
    enquiries: notes.filter((m) => m.kind !== "custom"),
  };
}

/* ───────────────────────────── dashboard ───────────────────────────── */

export async function getDashboard(actor: Actor) {
  requirePermission(actor, "dashboard:view");
  const db = getDb();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [counts, recent, [rev], daily, [unpaid], upcoming, quotes, [quotesPending], enquiries, [enquiriesNew]] = await Promise.all([
    countOrdersByStatus(actor),
    db
      .select({ id: orders.id, reference: orders.reference, status: orders.status, customerName: orders.customerName, total: orders.total, currency: orders.currency, createdAt: orders.createdAt, isPaid: orders.isPaid })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(6),
    db
      .select({
        orders: count(),
        value: sql<string>`coalesce(sum(${orders.total}) FILTER (WHERE ${orders.status} <> 'cancelled'), 0)::text`,
        paid: sql<string>`coalesce(sum(${orders.total}) FILTER (WHERE ${orders.isPaid}), 0)::text`,
      })
      .from(orders)
      .where(gte(orders.createdAt, since)),
    db.execute(sql`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(c.n, 0)::int AS orders
        FROM generate_series(current_date - 29, current_date, interval '1 day') d
        LEFT JOIN (SELECT created_at::date AS day, count(*) AS n FROM online_orders WHERE created_at >= current_date - 29 AND status <> 'cancelled' GROUP BY 1) c ON c.day = d::date
       ORDER BY d
    `) as unknown as Promise<{ day: string; orders: number }[]>,
    db.select({ n: count() }).from(orders).where(and(eq(orders.isPaid, false), sql`${orders.status} <> 'cancelled'`)),
    db
      .select({ id: orders.id, reference: orders.reference, customerName: orders.customerName, status: orders.status, fulfilment: orders.fulfilment, scheduledFor: orders.scheduledFor })
      .from(orders)
      .where(and(eq(orders.fulfilment, "delivery"), inArray(orders.status, ["confirmed", "in_progress", "ready", "out_for_delivery"])))
      .orderBy(sql`${orders.scheduledFor} ASC NULLS LAST`, orders.createdAt)
      .limit(5),
    db
      .select({ id: messages.id, reference: messages.reference, name: messages.name, quoteStatus: messages.quoteStatus, payload: messages.payload, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.kind, "custom"))
      .orderBy(desc(messages.createdAt))
      .limit(4),
    db.select({ n: count() }).from(messages).where(and(eq(messages.kind, "custom"), inArray(messages.quoteStatus, ["requested", "under_review"]))),
    db
      .select({ id: messages.id, reference: messages.reference, name: messages.name, message: messages.message, isHandled: messages.isHandled, inProgress: messages.inProgress, createdAt: messages.createdAt })
      .from(messages)
      .where(sql`${messages.kind} <> 'custom'`)
      .orderBy(desc(messages.createdAt))
      .limit(4),
    db.select({ n: count() }).from(messages).where(and(sql`${messages.kind} <> 'custom'`, eq(messages.isHandled, false))),
  ]);
  const currency = (await getBusinessSettings()).currency;
  const [upcomingRow] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.fulfilment, "delivery"), inArray(orders.status, ["confirmed", "in_progress", "ready", "out_for_delivery"])));
  return {
    counts,
    upcomingDeliveriesCount: upcomingRow?.n ?? 0,
    recent,
    last30: { orders: rev?.orders ?? 0, value: rev?.value ?? "0", paid: rev?.paid ?? "0" },
    daily,
    awaitingPayment: unpaid?.n ?? 0,
    upcomingDeliveries: upcoming,
    recentQuotes: quotes,
    pendingQuotations: quotesPending?.n ?? 0,
    recentEnquiries: enquiries,
    newEnquiries: enquiriesNew?.n ?? 0,
    currency,
  };
}
