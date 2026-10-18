import type { Metadata } from "next";
import Link from "next/link";
import { ToastOnMount } from "@/components/ui/toaster";
import { ButtonLink } from "@/components/ui/button";
import { Feed, OrderStatusText, SectionHead } from "@/components/public/account-ui";
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
  const nothingYet = data.activeOrders.length === 0 && updates.length === 0;
  return (
    <>
      {one(sp.notice) === "password-changed" ? <ToastOnMount message="Your password has been changed." /> : null}

      <ul className="acct-stats">
        {[
          { href: "/account/orders", label: "Active orders", value: counts.open, alert: false },
          { href: "/account/wishlist", label: "Wishlist", value: counts.wishlist, alert: false },
        ].map((st) => (
          <li key={st.label}>
            <Link href={st.href} className="acct-stat" data-alert={st.alert ? "" : undefined}>
              <span className="acct-stat-l">{st.label}</span>
              <span className="acct-stat-v">{st.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      {nothingYet ? (
        <section aria-labelledby="dw-title" className="acct-card">
          <SectionHead id="dw-title" title="Welcome" />
          <p className="acct-lead">Nothing here yet. Orders you place while signed in will show up on this page.</p>
          <div className="acct-actions">
            <ButtonLink href="/products" size="cta">
              Browse the collection
            </ButtonLink>
            <ButtonLink href="/custom#quotation" size="cta" variant="secondary">
              Request a quotation
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {data.activeOrders.length > 0 ? (
        <section aria-labelledby="do-title" className="acct-card">
          <SectionHead id="do-title" title="Active orders" link={{ href: "/account/orders", label: "View all" }} />
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
                  <OrderStatusText status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {updates.length > 0 ? (
        <section aria-labelledby="du-title" className="acct-card">
          <SectionHead id="du-title" title="Recent updates" />
          <Feed updates={updates} format={(iso) => formatDateTime(iso, business.timezone)} />
        </section>
      ) : null}
    </>
  );
}
