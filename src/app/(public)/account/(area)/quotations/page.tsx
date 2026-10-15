import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Empty, QuoteStatusPill, SectionHead } from "@/components/public/account-ui";
import { requireCustomer } from "@/lib/auth/customer";
import { formatMoney } from "@/lib/money";
import { QUOTE_STATUS_HELP } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listAccountQuotations } from "@/server/accounts";

export const metadata: Metadata = { title: "My Quotations" };

export default async function AccountQuotationsPage() {
  const customer = await requireCustomer("/account/quotations");
  const [rows, business] = await Promise.all([listAccountQuotations(customer.id), getBusinessSettings()]);
  return (
    <section aria-labelledby="q-title" className="acct-card">
      <SectionHead id="q-title" title="My quotations" />
      {rows.length === 0 ? (
        <Empty
          actions={
            <ButtonLink href="/custom#quotation" size="cta">
              Request quotation
            </ButtonLink>
          }
        >
          Quotation requests you send while signed in appear here, with our price once it is ready.
        </Empty>
      ) : (
        <>
          <ul className="acct-list">
            {rows.map((q) => (
              <li key={q.reference}>
                <Link href={`/account/quotations/${q.reference}`} className="acct-row">
                  <span>
                    <strong>{q.summary}</strong>
                    <small>
                      {q.reference} · sent {formatDate(q.createdAt, business.timezone)} · {QUOTE_STATUS_HELP[q.status]}
                    </small>
                  </span>
                  <span className="acct-amount">{q.quotedAmount ? formatMoney(q.quotedAmount, business.currency) : ""}</span>
                  <QuoteStatusPill status={q.status} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="acct-actions">
            <ButtonLink href="/custom#quotation" size="cta" variant="secondary">
              New quotation request
            </ButtonLink>
          </div>
        </>
      )}
    </section>
  );
}
