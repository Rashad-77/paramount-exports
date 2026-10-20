import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { normaliseEmail, phoneKey } from "@/lib/contact";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx } from "@/lib/db/client";
import { outer } from "@/lib/db/outer";
import { auditLogs, messages, orderItems, orders, productVariants, products } from "@/lib/db/schema";
import { invalidState, notFound, rateLimited, validation } from "@/lib/errors";
import { dec, moneyString, sum } from "@/lib/money";
import { hitRateLimit } from "@/lib/rate-limit";
import { getBusinessSettings } from "@/lib/settings";
import { OPEN_STATUSES, type CheckoutInput, type Fulfilment, type OrderStatus } from "@/lib/schemas/orders";
import { recordAudit } from "./audit";
import { recordUpdate } from "./account-updates";
import { emailCustomer } from "./notify";
import { discountFrom, setOrderPaidShortcut, syncOrderMoney } from "./order-money";

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
      kind: products.kind,
      stock: productVariants.stockQuantity,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, [...wanted.keys()]));
  const byId = new Map(rows.map((r) => [r.variantId, r]));

  const lines = [...wanted.entries()].map(([variantId, quantity], i) => {
    const r = byId.get(variantId);
    const ok = r && r.variantActive && r.published && !r.archivedAt && r.showPrice && r.price !== null;
    if (!ok) throw validation("One of the items in your order is no longer available. Please review your order and try again.");
    if (r.kind === "stocked" && r.stock !== null && quantity > r.stock) {
      throw validation(r.stock === 0 ? `${r.name} has just sold out. Please remove it from your cart.` : `Only ${r.stock} of ${r.name} ${r.stock === 1 ? "is" : "are"} left. Please lower the quantity.`);
    }
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
        deliveryChargeSet: input.fulfilment === "pickup",
        total: moneyString(subtotal),
        customerNote: input.note ?? null,
        accountId: ctx.accountId ?? null,
      })
      .returning({ id: orders.id, reference: orders.reference });
    // Take the stock inside the same transaction; the guard in the WHERE stops two buyers taking the last piece.
    for (const l of lines) {
      const r = byId.get(l.variantId)!;
      if (r.kind !== "stocked" || r.stock === null) continue;
      const taken = await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} - ${l.quantity}` }).where(and(eq(productVariants.id, l.variantId), sql`${productVariants.stockQuantity} >= ${l.quantity}`)).returning({ id: productVariants.id });
      if (taken.length === 0) throw validation(`Sorry, ${l.productName} was just bought by someone else. Please review your cart.`);
    }
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
  statusFilters?: (OrderStatus | "completed")[];
  q?: string;
  sort?: "total_desc" | "total_asc" | "latest" | "oldest";
  payments?: ("paid" | "unpaid")[];
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
  if (f.statusFilters?.length) {
    const statusConditions = f.statusFilters.map((status) =>
      status === "completed"
        ? and(eq(orders.status, "delivered"), eq(orders.isPaid, true))!
        : status === "delivered"
          ? and(eq(orders.status, "delivered"), eq(orders.isPaid, false))!
          : eq(orders.status, status),
    );
    where.push(or(...statusConditions)!);
  }
  if (f.payment === "unpaid") where.push(and(eq(orders.isPaid, false), sql`${orders.status} NOT IN ('cancelled', 'refunded')`)!);
  if (f.payment === "paid") where.push(and(eq(orders.isPaid, true), sql`${orders.status} <> 'refunded'`)!);
  if (f.payments?.length === 1) where.push(f.payments[0] === "paid" ? and(eq(orders.isPaid, true), sql`${orders.status} <> 'refunded'`)! : eq(orders.isPaid, false));
  if (f.fulfilment) where.push(eq(orders.fulfilment, f.fulfilment));
  if (f.phoneKey) where.push(eq(orders.phoneKey, f.phoneKey));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(orders.reference, like), ilike(orders.invoiceNumber, like), ilike(orders.customerName, like), ilike(orders.phone, like), ilike(orders.email, like))!);
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
        handledBy: orders.handledBy,
        cancelReason: orders.cancelReason,
        createdAt: orders.createdAt,
        confirmedAt: orders.confirmedAt,
        readyAt: orders.readyAt,
        outForDeliveryAt: orders.outForDeliveryAt,
        deliveredAt: orders.deliveredAt,
        cancelledAt: orders.cancelledAt,
        refundedAt: orders.refundedAt,
        statusChangedAt: sql<Date | null>`(
          select max(${auditLogs.createdAt})
          from ${auditLogs}
          where ${auditLogs.entityType} = 'order'
            and ${auditLogs.entityId} = ${orders.id}::text
            and ${auditLogs.action} = 'order.' || ${orders.status}
        )`,
        quantities: sql<string>`coalesce((SELECT string_agg(i.quantity::text, E'\n' ORDER BY i.position) FROM online_order_items i WHERE i.order_id = ${outer(orders.id)}), '')`,
        contents: sql<string>`coalesce((SELECT string_agg(i.product_name || coalesce(' · ' || i.variant_label, ''), E'\n' ORDER BY i.position) FROM online_order_items i WHERE i.order_id = ${outer(orders.id)}), '')`,
        itemCount: sql<number>`coalesce((SELECT sum(i.quantity)::int FROM online_order_items i WHERE i.order_id = ${outer(orders.id)}), 0)`,
      })
      .from(orders)
      .where(cond)
      .orderBy(
        ...(f.sort === "total_desc"
          ? [desc(orders.total), desc(orders.createdAt)]
          : f.sort === "total_asc"
            ? [asc(orders.total), desc(orders.createdAt)]
            : f.sort === "oldest"
              ? [asc(orders.createdAt)]
              : [desc(orders.createdAt)]),
      )
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

export async function countOrdersByStatus(actor: Actor): Promise<Record<OrderStatus | "all", number> & { completed: number }> {
  requirePermission(actor, "orders:view");
  const rows = await getDb().select({ status: orders.status, isPaid: orders.isPaid, n: count() }).from(orders).groupBy(orders.status, orders.isPaid);
  const out: Record<OrderStatus | "all", number> & { completed: number } = { all: 0, new: 0, confirmed: 0, in_progress: 0, ready: 0, out_for_delivery: 0, delivered: 0, refunded: 0, cancelled: 0, completed: 0 };
  for (const r of rows) {
    out[r.status] += r.n;
    out.all += r.n;
    if (r.status === "delivered" && r.isPaid) out.completed += r.n;
  }
  return out;
}

/* ───────────────────────────── staff: changing orders ───────────────────────────── */

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  in_progress: ["ready", "cancelled"],
  // "Out for delivery" is no longer a step: a delivery goes from ready straight to delivered. Orders already out for delivery can still finish.
  ready: ["delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  // Staff can correct a finished order from the list if it was tagged incorrectly.
  delivered: ["new", "confirmed", "ready", "refunded"],
  // A refunded order can be put back to delivered if it was marked by mistake.
  refunded: ["delivered"],
  cancelled: ["new", "confirmed", "ready", "delivered"],
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
  refunded: "has been refunded",
  cancelled: "has been cancelled",
};

export async function setOrderStatus(actor: Actor, id: string, status: OrderStatus, reason?: string, allowCorrection = false): Promise<void> {
  requirePermission(actor, status === "cancelled" ? "orders:cancel" : status === "refunded" ? "orders:refund" : "orders:update");
  const business = await getBusinessSettings();
  let heardBy: { email: string | null; reference: string; name: string } | null = null;
  await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!o) throw notFound("That order could not be found.");
    if (status === "confirmed" && o.fulfilment === "delivery" && !o.deliveryChargeSet) throw invalidState("Enter the delivery charge (0 if it is free) and save it before confirming a delivery order.");
    if (!allowCorrection && !allowedNextStatuses(o.status, o.fulfilment).includes(status)) throw invalidState(`An order that is ${o.status.replace("_", " ")} cannot be moved to ${status.replace("_", " ")}.`);
    const now = new Date();
    // Cancelled and refunded orders have put their pieces back on the shelf; moving back to a live status takes them again.
    const released = (st: OrderStatus) => st === "cancelled" || st === "refunded";
    if (released(o.status) && !released(status)) {
      const items = await tx.select({ variantId: orderItems.variantId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, id));
      for (const it of items) {
        if (!it.variantId) continue;
        const taken = await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} - ${it.quantity}` }).where(and(eq(productVariants.id, it.variantId), sql`${productVariants.stockQuantity} IS NULL OR ${productVariants.stockQuantity} >= ${it.quantity}`)).returning({ id: productVariants.id });
        if (!taken.length) throw invalidState("There is not enough stock to reopen this order.");
      }
    }
    await tx
      .update(orders)
      .set({
        status,
        handledBy: actor.id,
        confirmedAt:
          status === "new"
            ? null
            : status === "confirmed"
              ? now
              : status === "delivered"
                ? o.confirmedAt ?? now
                : o.confirmedAt,
        readyAt: status === "new" || status === "confirmed" ? null : status === "ready" ? now : o.readyAt,
        outForDeliveryAt:
          status === "new" || status === "confirmed" || status === "ready"
            ? null
            : status === "out_for_delivery"
              ? now
              : o.outForDeliveryAt,
        deliveredAt: status === "delivered" ? now : status === "refunded" ? o.deliveredAt : null,
        cancelledAt: status === "cancelled" ? now : null,
        cancelReason: status === "cancelled" ? reason ?? "Cancelled" : null,
        refundedAt: status === "refunded" ? now : null,
        refundReason: status === "refunded" ? reason ?? null : null,
      })
      .where(eq(orders.id, id));
    if (released(status) && !released(o.status)) {
      // A cancelled or refunded order puts its counted pieces back on the shelf.
      const items = await tx.select({ variantId: orderItems.variantId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, id));
      for (const it of items) {
        if (!it.variantId) continue;
        await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} + ${it.quantity}` }).where(and(eq(productVariants.id, it.variantId), sql`${productVariants.stockQuantity} IS NOT NULL`));
      }
    }
    if (status === "confirmed" && !o.invoiceNumber) {
      const [{ ref }] = (await tx.execute(sql`SELECT next_reference('invoice') AS ref`)) as unknown as [{ ref: string }];
      await tx.update(orders).set({ invoiceNumber: ref }).where(eq(orders.id, id));
    }
    await recordAudit(tx, actor, { action: `order.${status}`, entityType: "order", entityId: id, before: { status: o.status }, after: { status }, reason });
    // Tell the customer: a note on their dashboard when they have an account, and an email when we have an address.
    await recordUpdate(tx, o.accountId, { kind: "order", title: `Order ${o.reference} ${STATUS_NOTE[status]}`, body: (status === "cancelled" || status === "refunded") && reason ? reason : undefined, link: `/account/orders/${o.reference}` });
    heardBy = { email: o.email, reference: o.reference, name: o.customerName };
  });
  if (heardBy) {
    const h = heardBy as { email: string | null; reference: string; name: string };
    emailCustomer(h.email, `Your order ${h.reference} ${STATUS_NOTE[status]} - ${business.name}`, [`Hello ${h.name},`, ``, `Your order ${h.reference} ${STATUS_NOTE[status]}.`, (status === "cancelled" || status === "refunded") && reason ? `Reason: ${reason}` : null, ``, `You can follow it any time on our website with your order number and phone number.`, ``, business.name].filter((l): l is string => l !== null).join("\n"));
  }
}

export interface OrderDetailsInput {
  deliveryCharge: string;
  staffNote?: string;
  scheduledFor?: string;
  /** A discount, either an amount or a percentage of the items. Changing it needs the discount permission. */
  discountAmount?: string;
  discountPercent?: string;
  discountReason?: string;
}

/** Delivery charge, discount, planned day and internal note. A finished order cannot change. The total follows: items − discount + delivery. */
export async function updateOrderDetails(actor: Actor, id: string, input: OrderDetailsInput): Promise<void> {
  requirePermission(actor, "orders:update");
  await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!o) throw notFound("That order could not be found.");
    if (o.status === "delivered" || o.status === "cancelled" || o.status === "refunded") throw invalidState("A finished order cannot be changed.");
    const charge = o.fulfilment === "pickup" ? "0.00" : moneyString(input.deliveryCharge);
    const wantsDiscount = input.discountAmount !== undefined || input.discountPercent !== undefined;
    let discount = o.discount;
    let discountReason = o.discountReason;
    if (wantsDiscount) {
      const next = discountFrom(o.subtotal, input.discountAmount, input.discountPercent);
      if (next !== moneyString(o.discount)) {
        requirePermission(actor, "orders:discount");
        if (dec(next).gt(0) && !input.discountReason) throw validation("Say why the discount is given.", { discountReason: ["Say why the discount is given."] });
        discount = next;
        discountReason = dec(next).gt(0) ? input.discountReason ?? null : null;
      } else if (input.discountReason !== undefined && dec(next).gt(0)) {
        discountReason = input.discountReason;
      }
    }
    const total = moneyString(dec(o.subtotal).minus(discount).plus(charge));
    await tx
      .update(orders)
      .set({ deliveryCharge: charge, deliveryChargeSet: true, discount, discountReason, total, staffNote: input.staffNote === undefined ? o.staffNote : input.staffNote, scheduledFor: input.scheduledFor === undefined ? o.scheduledFor : input.scheduledFor, handledBy: actor.id })
      .where(eq(orders.id, id));
    const money = await syncOrderMoney(tx, id);
    await recordAudit(tx, actor, {
      action: moneyString(o.discount) !== moneyString(discount) ? "order.discount_changed" : "order.details_updated",
      entityType: "order",
      entityId: id,
      before: { deliveryCharge: o.deliveryCharge, discount: o.discount, total: o.total },
      after: { deliveryCharge: charge, discount, total, paid: money.paid },
      reason: discountReason ?? undefined,
    });
  });
}

/** The Paid / Not paid shortcut on the order list. Real payments (part payments, refunds) are recorded from the order page. */
export const setOrderPaid = setOrderPaidShortcut;

/* ───────────────────────────── customers (built from orders, quotations and enquiries) ───────────────────────────── */

/** Everyone who has ordered, asked for a quotation or written to the business, grouped by phone number. */
export async function listCustomers(actor: Actor, f: { q?: string; page: number; pageSize: number }) {
  requirePermission(actor, "customers:view");
  const like = f.q ? `%${escapeLike(f.q)}%` : null;
  const having = like ? sql`HAVING max(name) ILIKE ${like} OR max(phone) ILIKE ${like} OR coalesce(max(email), '') ILIKE ${like} OR concat('CUS-', phone_key) ILIKE ${like}` : sql``;
  const db = getDb();
  const source = sql`
    WITH src AS (
      SELECT phone_key, id::text AS id, reference, customer_name AS name, phone, email, created_at, 'order' AS what FROM online_orders
      UNION ALL
      SELECT phone_key, id::text AS id, reference, name, phone, email, created_at, CASE WHEN kind = 'custom' THEN 'quotation' ELSE 'enquiry' END FROM messages
    )`;
  const rows = (await db.execute(sql`
    ${source}
    SELECT phone_key AS "phoneKey",
           (array_agg(name ORDER BY created_at DESC))[1] AS name,
           (array_agg(phone ORDER BY created_at DESC))[1] AS phone,
           (array_agg(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL))[1] AS email,
           coalesce(json_agg(json_build_object('id', id, 'reference', reference) ORDER BY created_at DESC) FILTER (WHERE what = 'order'), '[]'::json) AS "orderRefs",
           coalesce(json_agg(json_build_object('id', id, 'reference', reference) ORDER BY created_at DESC) FILTER (WHERE what = 'quotation'), '[]'::json) AS "quotationRefs",
           coalesce(json_agg(json_build_object('id', id, 'reference', reference) ORDER BY created_at DESC) FILTER (WHERE what = 'enquiry'), '[]'::json) AS "enquiryRefs"
      FROM src
     GROUP BY phone_key
     ${having}
     ORDER BY max(created_at) DESC
     LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}
  `)) as unknown as { phoneKey: string; name: string; phone: string; email: string | null; orderRefs: { id: string; reference: string }[]; quotationRefs: { id: string; reference: string }[]; enquiryRefs: { id: string; reference: string }[] }[];
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
      .select({ id: orders.id, reference: orders.reference, status: orders.status, fulfilment: orders.fulfilment, customerName: orders.customerName, total: orders.total, currency: orders.currency, createdAt: orders.createdAt, isPaid: orders.isPaid })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(6),
    db
      .select({
        orders: count(),
        value: sql<string>`coalesce(sum(${orders.total}) FILTER (WHERE ${orders.status} NOT IN ('cancelled', 'refunded')), 0)::text`,
        paid: sql<string>`coalesce(sum(${orders.total}) FILTER (WHERE ${orders.isPaid} AND ${orders.status} <> 'refunded'), 0)::text`,
      })
      .from(orders)
      .where(gte(orders.createdAt, since)),
    db.execute(sql`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(c.n, 0)::int AS orders
        FROM generate_series(current_date - 29, current_date, interval '1 day') d
        LEFT JOIN (SELECT created_at::date AS day, count(*) AS n FROM online_orders WHERE created_at >= current_date - 29 AND status NOT IN ('cancelled', 'refunded') GROUP BY 1) c ON c.day = d::date
       ORDER BY d
    `) as unknown as Promise<{ day: string; orders: number }[]>,
    db.select({ n: count() }).from(orders).where(and(eq(orders.isPaid, false), sql`${orders.status} NOT IN ('cancelled', 'refunded')`)),
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
