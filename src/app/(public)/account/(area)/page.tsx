import Link from "next/link";
import { Alert } from "@/components/ui/status";
import { ButtonLink } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth/customer";
import { one, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-constants";
import { formatDate } from "@/lib/time";
import { getBusinessSettings } from "@/lib/settings";
import { accountSummary, listAccountOrders } from "@/server/accounts";

export default async function AccountOverview({ searchParams }: { searchParams: Promise<SP> }) {
  const customer = await requireCustomer("/account");
  const sp = await searchParams;
  const [summary, recent, business] = await Promise.all([accountSummary(customer.id), listAccountOrders(customer.id, 3), getBusinessSettings()]);
  return (
    <div className="space-y-10">
      {one(sp.notice) === "password-changed" ? <Alert tone="success">Your password has been changed.</Alert> : null}
      <dl className="grid gap-5 sm:grid-cols-3">
        {[
          ["Orders", summary.orders],
          ["Being handled", summary.open],
          ["Quotation requests", summary.quotations],
        ].map(([label, n]) => (
          <div key={String(label)} className="soft-card">
            <dt className="eyebrow">{label}</dt>
            <dd className="font-display mt-3 text-[2.25rem] leading-none text-text">{n}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="recent-title">
        <h2 id="recent-title" className="font-display text-[1.5rem] leading-tight text-brand">
          Recent orders
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-text-muted">
            You have no orders on your account yet. Orders you place while signed in appear here. Placed one before? Add it from the{" "}
            <Link href="/account/orders" className="underline">
              orders page
            </Link>
            .
          </p>
        ) : (
          <ul className="soft-card mt-4 divide-y divide-border">
            {recent.map((o) => (
              <li key={o.reference} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span>
                  <Link href={`/account/orders/${o.reference}`} className="font-medium underline">
                    {o.reference}
                  </Link>
                  <span className="text-text-muted">
                    {" "}
                    · {formatDate(o.placedAt, business.timezone)} · {STATUS_LABEL[o.status]}
                  </span>
                </span>
                <span className="font-medium">{formatMoney(o.total, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/products" size="cta">
          Browse the collection
        </ButtonLink>
        <ButtonLink href="/custom#quotation" size="cta" variant="secondary">
          Request quotation
        </ButtonLink>
      </div>
    </div>
  );
}
