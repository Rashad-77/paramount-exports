import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orderItems, orders } from "@/lib/db/schema";
import { notFound, rateLimited } from "@/lib/errors";
import { hitRateLimit } from "@/lib/rate-limit";
import { firstImages } from "@/server/catalogue-public";
import type { TrackedOrder, TrackInput } from "@/lib/schemas/tracking";

export const TRACK_LIMITS = {
  perIp: { limit: 15, windowSeconds: 600 },
  /** Guessing order numbers is slow: only a few tries an hour per order. */
  perOrder: { limit: 8, windowSeconds: 3600 },
} as const;

const NOT_FOUND =
  "We could not find an order with that number. Please check it and try again, or contact us.";

/**
 * A customer looks up their own order with its number (no account needed).
 * Callers must have passed the honeypot check already.
 */
export async function trackOrder(
  input: TrackInput,
  ctx: { ip: string | null },
): Promise<TrackedOrder> {
  const db = getDb();

  const ipHit = await hitRateLimit(db, {
    scope: "track-ip",
    value: ctx.ip ?? "unknown",
    ...TRACK_LIMITS.perIp,
  });
  if (!ipHit.allowed)
    throw rateLimited(
      "Too many lookups from this connection. Please wait a few minutes and try again, or contact us.",
    );
  const orderHit = await hitRateLimit(db, {
    scope: "track-order",
    value: input.reference,
    ...TRACK_LIMITS.perOrder,
  });
  if (!orderHit.allowed)
    throw rateLimited(
      "Too many attempts for this order number. Please wait a while, or contact us and we will help.",
    );

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.reference, input.reference))
    .limit(1);
  if (!order) throw notFound(NOT_FOUND);

  return toTrackedOrder(order);
}

/** The small view of an order that its own customer may see. Shared by the order-number lookup and the signed-in account pages. */
export async function toTrackedOrder(
  order: typeof orders.$inferSelect,
): Promise<TrackedOrder> {
  const items = await getDb()
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.position));
  const photos = await firstImages(
    items.flatMap((i) => (i.productId ? [i.productId] : [])),
  );
  return {
    reference: order.reference,
    status: order.status,
    firstName: order.customerName.trim().split(/\s+/)[0] ?? "",
    fulfilment: order.fulfilment,
    paymentMethod: order.paymentMethod,
    isPaid: order.isPaid,
    currency: order.currency,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    total: order.total,
    placedAt: order.createdAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    items: items.map((i) => ({
      name: i.productName,
      label: i.variantLabel,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
      imageUrl: (i.productId && photos.get(i.productId)?.url) || null,
      imageAlt: (i.productId && photos.get(i.productId)?.alt) || i.productName,
    })),
  };
}
