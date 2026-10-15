import type { Metadata } from "next";
import Link from "next/link";
import { ClaimOrderForm } from "@/components/public/account-forms";
import { Empty, OrderStatusPill, SectionHead } from "@/components/public/account-ui";
import { ButtonLink } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth/customer";
import { formatMoney } from "@/lib/money";
import { orderNumber } from "@/lib/schemas/tracking";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listAccountOrders } from "@/server/accounts";

export const metadata: Metadata = { title: "My Orders" };

export default async function AccountOrdersPage() {
  const customer = await requireCustomer("/account/orders");
  const [orders, business] = await Promise.all([listAccountOrders(customer.id), getBusinessSettings()]);
  return (
    <>
      <section aria-labelledby="orders-title" className="acct-card">
        <SectionHead id="orders-title" title="My orders" />
        {orders.length === 0 ? (
          <Empty
            actions={
              <ButtonLink href="/products" size="cta">
                Browse the collection
              </ButtonLink>
            }
          >
            No orders on your account yet. Orders you place while signed in appear here, and you can follow each one from order to delivery.
          </Empty>
        ) : (
          <ul className="acct-list">
            {orders.map((o) => (
              <li key={o.reference}>
                <Link href={`/account/orders/${o.reference}`} className="acct-row">
                  <span>
                    <strong>{orderNumber(o.reference)}</strong>
                    <small>
                      Placed {formatDate(o.placedAt, business.timezone)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                    </small>
                  </span>
                  <span className="acct-amount">{formatMoney(o.total, o.currency)}</span>
                  <OrderStatusPill status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="claim-title" className="acct-card">
        <SectionHead id="claim-title" title="Add an earlier order" />
        <p className="acct-lead mb-5">Ordered before you had an account? Enter its number and the phone number you gave, and it will appear above.</p>
        <ClaimOrderForm />
      </section>
    </>
  );
}
