import { notFound } from "next/navigation";
import { OrderDocument } from "@/components/receipt/order-document";
import { ReceiptShell } from "@/components/receipt/receipt-shell";
import { getDb } from "@/lib/db/client";
import { orderItems, orderPayments, orders } from "@/lib/db/schema";
import { receiptTokenValid } from "@/lib/receipt-token";
import { normaliseOrderRef } from "@/lib/schemas/tracking";
import { getBusinessSettings } from "@/lib/settings";
import { and, asc, eq } from "drizzle-orm";

export const metadata = { title: "Your receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** A customer's own copy of their invoice or receipt. Opens only with the signed link given on their account page or after the order lookup. */
export default async function CustomerReceiptPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string; auto?: string }> }) {
  const { reference } = await params;
  const { t, auto } = await searchParams;
  const ref = normaliseOrderRef(reference);
  if (!ref) notFound();
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.reference, ref)).limit(1);
  if (!order || !receiptTokenValid(order, t)) notFound();
  const [items, payments, business] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.position)),
    db.select().from(orderPayments).where(and(eq(orderPayments.orderId, order.id))).orderBy(asc(orderPayments.paidAt), asc(orderPayments.createdAt)),
    getBusinessSettings(),
  ]);
  return (
    <ReceiptShell auto={auto === "1"}>
      <OrderDocument order={order} items={items} payments={payments} business={business} mode="receipt" />
    </ReceiptShell>
  );
}
