import type { Metadata } from "next";
import { OrderConfirmed } from "@/components/public/order-confirmed";
import { one, type SP } from "@/lib/list-params";
import { FULFILMENT, PAYMENT_METHODS, type Fulfilment, type PaymentMethod } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Order received", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderConfirmedPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ref = one(sp.ref);
  const pay = one(sp.pay);
  const how = one(sp.how);
  const business = await getBusinessSettings();
  return (
    <div className="container-page py-[var(--section-space)]">
      <OrderConfirmed
        reference={ref && /^(ORD-\d{6}|[1-9]\d{8})$/.test(ref) ? ref : null}
        payment={pay && (PAYMENT_METHODS as readonly string[]).includes(pay) ? (pay as PaymentMethod) : null}
        fulfilment={how && (FULFILMENT as readonly string[]).includes(how) ? (how as Fulfilment) : null}
        bankDetails={business.bankDetails}
        phone={business.phone}
      />
    </div>
  );
}
