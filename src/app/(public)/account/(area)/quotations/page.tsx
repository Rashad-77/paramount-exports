import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth/customer";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listAccountQuotations } from "@/server/accounts";

export const metadata: Metadata = { title: "Quotations" };

const KIND_LABEL: Record<string, string> = { custom: "Made to measure", product_enquiry: "About a piece", general: "Message" };

export default async function AccountQuotationsPage() {
  const customer = await requireCustomer("/account/quotations");
  const [rows, business] = await Promise.all([listAccountQuotations(customer.id), getBusinessSettings()]);
  return (
    <section aria-labelledby="q-title" className="space-y-6">
      <h2 id="q-title" className="font-display text-[1.5rem] leading-tight text-brand">
        Your quotation requests and enquiries
      </h2>
      {rows.length === 0 ? (
        <p className="text-text-muted">Nothing here yet. Requests you send while signed in appear here, with whether we have dealt with them.</p>
      ) : (
        <ul className="soft-card divide-y divide-border">
          {rows.map((r) => (
            <li key={r.reference} className="py-3 first:pt-0 last:pb-0">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {r.reference} <span className="font-normal text-text-muted">· {KIND_LABEL[r.kind] ?? "Message"}</span>
                </span>
                <span className="text-sm text-text-muted">
                  {formatDate(r.createdAt, business.timezone)} · {r.isHandled ? "We have replied" : "Waiting for us"}
                </span>
              </p>
              {r.summary ? <p className="mt-1 text-sm text-text-muted">{r.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <ButtonLink href="/custom#quotation" size="cta">
        Request quotation
      </ButtonLink>
    </section>
  );
}
