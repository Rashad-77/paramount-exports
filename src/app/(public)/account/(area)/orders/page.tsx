import type { Metadata } from "next";
import Link from "next/link";
import { ClaimOrderForm } from "@/components/public/account-forms";
import { requireCustomer } from "@/lib/auth/customer";
import { formatMoney } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-constants";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listAccountOrders } from "@/server/accounts";

export const metadata: Metadata = { title: "Orders" };

export default async function AccountOrdersPage() {
  const customer = await requireCustomer("/account/orders");
  const [orders, business] = await Promise.all([listAccountOrders(customer.id), getBusinessSettings()]);
  return (
    <div className="space-y-12">
      <section aria-labelledby="orders-title">
        <h2 id="orders-title" className="font-display text-[1.5rem] leading-tight text-brand">
          Your orders
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-text-muted">No orders on your account yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Your orders, newest first</caption>
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Order
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Placed
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Items
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.reference}>
                    <th scope="row" className="py-3 pr-4 font-medium">
                      <Link href={`/account/orders/${o.reference}`} className="underline">
                        {o.reference}
                      </Link>
                    </th>
                    <td className="py-3 pr-4">{formatDate(o.placedAt, business.timezone)}</td>
                    <td className="py-3 pr-4">{STATUS_LABEL[o.status]}</td>
                    <td className="py-3 pr-4">{o.itemCount}</td>
                    <td className="py-3 text-right">{formatMoney(o.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="claim-title" className="soft-card max-w-2xl">
        <h2 id="claim-title" className="font-display text-[1.25rem] leading-tight text-text">
          Add an earlier order
        </h2>
        <p className="mb-5 mt-2 text-sm text-text-muted">Ordered before you had an account? Enter its number and the phone number you gave, and it will appear above.</p>
        <ClaimOrderForm />
      </section>
    </div>
  );
}
