import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/status";
import { ButtonLink } from "@/components/ui/button";
import { Empty, Feed, OrderStatusPill, QuoteStatusPill, SectionHead } from "@/components/public/account-ui";
import { requireCustomer } from "@/lib/auth/customer";
import { one, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { orderNumber } from "@/lib/schemas/tracking";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { accountDashboard } from "@/server/accounts";
import { listAccountUpdates } from "@/server/account-updates";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AccountDashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const customer = await requireCustomer("/account");
  const sp = await searchParams;
  const [data, updates, business] = await Promise.all([accountDashboard(customer.id), listAccountUpdates(customer.id, 6), getBusinessSettings()]);
  const { counts } = data;
  return (
    <>
      {one(sp.notice) === "password-changed" ? <Alert tone="success">Your password has been changed.</Alert> : null}

      <ul className="acct-stats">
        {[
          { href: "/account/quotations", label: counts.waitingForYou > 0 ? "Prices to answer" : "Quotations", value: counts.waitingForYou > 0 ? counts.waitingForYou : counts.quotations, alert: counts.waitingForYou > 0 },
          { href: "/account/orders", label: "Active orders", value: counts.open, alert: false },
          { href: "/account/orders", label: "All orders", value: counts.orders, alert: false },
          { href: "/account/wishlist", label: "Saved products", value: counts.wishlist, alert: false },
        ].map((st) => (
          <li key={st.label}>
            <Link href={st.href} className="acct-stat" data-alert={st.alert ? "" : undefined}>
              <span className="acct-stat-l">{st.label}</span>
              <span className="acct-stat-v">{st.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="dq-title" className="acct-card">
        <SectionHead id="dq-title" title="Recent quotation requests" link={data.quotations.length ? { href: "/account/quotations", label: "View all" } : undefined} />
        {data.quotations.length === 0 ? (
          <Empty
            actions={
              <ButtonLink href="/custom#quotation" size="cta">
                Request quotation
              </ButtonLink>
            }
          >
            You have not asked for a quotation yet. Tell us the piece you have in mind, with its size and wood, and we will send you a price.
          </Empty>
        ) : (
          <ul className="acct-list">
            {data.quotations.map((q) => (
              <li key={q.reference}>
                <Link href={`/account/quotations/${q.reference}`} className="acct-row">
                  <span>
                    <strong>{q.summary}</strong>
                    <small>
                      {q.reference} · {formatDate(q.createdAt, business.timezone)}
                    </small>
                  </span>
                  <span className="acct-amount">{q.quotedAmount ? formatMoney(q.quotedAmount, business.currency) : ""}</span>
                  <QuoteStatusPill status={q.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="do-title" className="acct-card">
        <SectionHead id="do-title" title="Active orders" link={data.activeOrders.length ? { href: "/account/orders", label: "View all" } : undefined} />
        {data.activeOrders.length === 0 ? (
          <Empty
            actions={
              <ButtonLink href="/products" size="cta">
                Browse the collection
              </ButtonLink>
            }
          >
            Nothing is being made or delivered for you right now. Orders you place while signed in, and orders made from an accepted quotation, appear here.
          </Empty>
        ) : (
          <ul className="acct-list">
            {data.activeOrders.map((o) => (
              <li key={o.reference}>
                <Link href={`/account/orders/${o.reference}`} className="acct-row">
                  <span>
                    <strong>{orderNumber(o.reference)}</strong>
                    <small>
                      {formatDate(o.placedAt, business.timezone)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
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

      <section aria-labelledby="du-title" className="acct-card">
        <SectionHead id="du-title" title="Recent updates" />
        {updates.length === 0 ? <p className="acct-lead">When we price a quotation or move an order on, you will see it here, and we will email you if we have your address.</p> : <Feed updates={updates} format={(iso) => formatDateTime(iso, business.timezone)} />}
      </section>
    </>
  );
}
