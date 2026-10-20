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
  const mode: DocumentMode = view === "delivery-note" ? "delivery_note" : "receipt";
  const base = `/print/orders/${id}`;
  const { order: o } = data;
  return (
    <ReceiptShell
      backHref={`/app/orders/${id}`}
      auto={auto === "1"}
      links={[
        { href: base, label: o.isPaid ? "Receipt" : "Invoice", active: mode === "receipt" },
        { href: `${base}?view=delivery-note`, label: o.fulfilment === "delivery" ? "Delivery note" : "Collection note", active: mode === "delivery_note" },
      ]}
    >
      <OrderDocument order={o} items={data.items} payments={payments} business={business} mode={mode} />
    </ReceiptShell>
  );
}
