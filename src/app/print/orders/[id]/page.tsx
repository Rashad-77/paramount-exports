import { notFound } from "next/navigation";
import { OrderDocument, type DocumentMode } from "@/components/receipt/order-document";
import { ReceiptShell } from "@/components/receipt/receipt-shell";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { getBusinessSettings } from "@/lib/settings";
import { getOrderPayments } from "@/server/order-money";
import { getOrder } from "@/server/orders";

export const metadata = { title: "Receipt", robots: { index: false, follow: false } };

/**
 * A printable invoice, receipt or delivery note for one order. Open as /print/orders/<id>; add ?view=delivery-note for the delivery note,
 * and ?auto=1 to open the print dialog straight away.
 */
export default async function OrderReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string; view?: string }> }) {
  const { id } = await params;
  const { auto, view } = await searchParams;
  const actor = await requireActor();
  let data;
  try {
    data = await getOrder(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [business, payments] = await Promise.all([getBusinessSettings(), getOrderPayments(actor, id)]);
  // Only deliveries have a delivery note; a pickup has just the invoice or receipt.
  const mode: DocumentMode = view === "delivery-note" && data.order.fulfilment === "delivery" ? "delivery_note" : "receipt";
  const base = `/print/orders/${id}`;
  const { order: o } = data;
  return (
    <ReceiptShell
      backHref={`/app/orders/${id}`}
      auto={auto === "1"}
      links={
        o.fulfilment === "delivery"
          ? [
              { href: base, label: o.isPaid ? "Receipt" : "Invoice", active: mode === "receipt" },
              { href: `${base}?view=delivery-note`, label: "Delivery note", active: mode === "delivery_note" },
            ]
          : undefined
      }
    >
      <OrderDocument order={o} items={data.items} payments={payments} business={business} mode={mode} />
    </ReceiptShell>
  );
}
