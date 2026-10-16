import type { Metadata } from "next";
import Link from "next/link";
import { SiteImage } from "@/components/public/site-image";
import { AccountSort } from "@/components/public/account-sort";
import { ClaimOrderForm } from "@/components/public/account-forms";
import { Empty, SectionHead } from "@/components/public/account-ui";
import { ButtonLink } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth/customer";
import { one, oneOf, type SP } from "@/lib/list-params";
import { formatAmount, formatMoney } from "@/lib/money";
import { orderNumber } from "@/lib/schemas/tracking";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listAccountOrders } from "@/server/accounts";

export const metadata: Metadata = { title: "My Orders" };

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest total" },
  { value: "lowest", label: "Lowest total" },
];

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const customer = await requireCustomer("/account/orders");
  const sp = await searchParams;
  const sort = oneOf(one(sp.sort), SORTS.map((o) => o.value)) ?? "newest";
  const q = (one(sp.q) ?? "").trim().slice(0, 80);
  const [all, business] = await Promise.all([listAccountOrders(customer.id), getBusinessSettings()]);
  const needle = q.toLowerCase();
  const found = needle ? all.filter((o) => o.reference.toLowerCase().includes(needle) || orderNumber(o.reference).includes(needle) || o.items.some((it) => it.name.toLowerCase().includes(needle))) : all;
  const orders = [...found].sort((a, b) =>
    sort === "oldest" ? a.placedAt.localeCompare(b.placedAt) : sort === "highest" ? Number(b.total) - Number(a.total) : sort === "lowest" ? Number(a.total) - Number(b.total) : b.placedAt.localeCompare(a.placedAt),
  );
  return (
    <>
      <section aria-labelledby="orders-title" className="acct-card">
        <SectionHead id="orders-title" title="My orders" link={all.length > 0 ? { href: "/track", label: "Track orders" } : undefined} />
        {all.length === 0 ? (
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
          <>
            <AccountSort value={sort} options={SORTS} basePath="/account/orders" q={q} placeholder="Search orders" />
            {orders.length === 0 ? <p className="acct-lead">No orders match “{q}”.</p> : null}
            <div className="acct-table-wrap" hidden={orders.length === 0}>
              <table className="acct-table">
                <thead>
                  <tr>
                    <th scope="col" colSpan={2}>
                      Item
                    </th>
                    <th scope="col" className="num">
                      Qty
                    </th>
                    <th scope="col" className="num price">
                      Price ({orders[0]?.currency ?? "LKR"})
                    </th>
                  </tr>
                </thead>
                {orders.map((o) => (
                  <tbody key={o.reference}>
                    <tr className="acct-table-order">
                      <th scope="colgroup" colSpan={4}>
                        <Link href={`/account/orders/${o.reference}`}>
                          <span>{orderNumber(o.reference)}</span>
                          <small>Placed {formatDate(o.placedAt, business.timezone)}</small>
                        </Link>
                      </th>
                    </tr>
                    {o.items.map((it, i) => (
                      <tr key={i}>
                        <td className="pic">
                          <span className="acct-order-pic">{it.imageUrl ? <SiteImage src={it.imageUrl} alt={it.imageAlt ?? it.name} fill sizes="48px" className="object-cover" /> : null}</span>
                        </td>
                        <td>
                          {it.name}
                          {it.variant ? <small className="block text-text-muted">{it.variant}</small> : null}
                        </td>
                        <td className="num">{it.quantity}</td>
                        <td className="num price">{formatAmount(it.unitPrice)}</td>
                      </tr>
                    ))}
                    <tr className="acct-table-total">
                      <td colSpan={4}>
                        <span>Total</span>
                        <span>{formatMoney(o.total, o.currency)}</span>
                      </td>
                    </tr>
                  </tbody>
                ))}
              </table>
            </div>
          </>
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
