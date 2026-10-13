import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderView } from "@/components/public/track-order";
import { requireCustomer } from "@/lib/auth/customer";
import { isAppError } from "@/lib/errors";
import { normaliseOrderRef } from "@/lib/schemas/tracking";
import { getBusinessSettings } from "@/lib/settings";
import { getAccountOrder } from "@/server/accounts";

export const metadata: Metadata = { title: "Order" };

export default async function AccountOrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const ref = normaliseOrderRef(reference);
  if (!ref) notFound();
  const customer = await requireCustomer(`/account/orders/${ref}`);
  const business = await getBusinessSettings();
  let order;
  try {
    order = await getAccountOrder(customer.id, ref);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <div>
      <p className="mb-6 text-sm">
        <Link href="/account/orders" className="underline">
          All your orders
        </Link>
      </p>
      <OrderView o={order} timezone={business.timezone} phone={business.phone} />
    </div>
  );
}
