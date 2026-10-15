import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuotationResponse } from "@/components/public/account-forms";
import { QuoteStatusPill, SectionHead } from "@/components/public/account-ui";
import { Alert } from "@/components/ui/status";
import { requireCustomer } from "@/lib/auth/customer";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { QUOTE_STATUS_HELP, type QuoteStatus } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getAccountQuotation } from "@/server/accounts";

export const metadata: Metadata = { title: "Quotation" };

const REF = /^MSG-\d{1,12}$/i;

/** The four steps a quotation goes through, and how far along this one is. */
function steps(status: QuoteStatus, hasOrder: boolean) {
  const reached = status === "requested" ? 0 : status === "quoted" ? 1 : status === "accepted" ? (hasOrder ? 3 : 2) : status === "declined" ? 2 : 1;
  const names = ["Request received", "Price sent", status === "declined" ? "Declined" : status === "cancelled" ? "Closed" : "Accepted", "Order confirmed"];
  return names.map((label, i) => ({ label, done: i <= reached, current: i === reached }));
}

export default async function AccountQuotationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const ref = reference.toUpperCase();
  if (!REF.test(ref)) notFound();
  const customer = await requireCustomer(`/account/quotations/${ref}`);
  const business = await getBusinessSettings();
  let q;
  try {
    q = await getAccountQuotation(customer.id, ref);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const price = q.quotedAmount ? formatMoney(q.quotedAmount, business.currency) : null;
  return (
    <>
      <p className="text-sm">
        <Link href="/account/quotations" className="underline">
          All your quotations
        </Link>
      </p>

      <section aria-labelledby="qd-title" className="acct-card">
        <div className="acct-h">
          <h1 id="qd-title">{q.summary}</h1>
          <QuoteStatusPill status={q.status} />
        </div>
        <p className="acct-lead">{QUOTE_STATUS_HELP[q.status]}</p>
        <ol className="acct-steps mt-6" aria-label="Where this quotation is">
          {steps(q.status, Boolean(q.orderReference)).map((s) => (
            <li key={s.label} data-done={s.done ? "" : undefined} data-current={s.current ? "" : undefined} aria-current={s.current ? "step" : undefined}>
              {s.label}
            </li>
          ))}
        </ol>
      </section>

      {price && q.status !== "requested" ? (
        <section aria-labelledby="qp-title" className="space-y-5">
          <div className="acct-price">
            <span id="qp-title">Our price</span>
            <strong>{price}</strong>
            <small>
              {q.validUntil ? `Valid until ${formatDate(q.validUntil, business.timezone)}. ` : ""}
              {q.expired ? "This price has run out. Please contact us and we will update it." : ""}
            </small>
          </div>
          {q.quoteNote ? (
            <div className="acct-card">
              <p className="acct-lead whitespace-pre-line">{q.quoteNote}</p>
            </div>
          ) : null}
          {q.canRespond ? (
            <div className="acct-card">
              <SectionHead title="Your answer" />
              <QuotationResponse reference={q.reference} amount={price} />
            </div>
          ) : null}
        </section>
      ) : null}

      {q.status === "accepted" && q.orderReference ? (
        <Alert tone="success" title="Your order is confirmed">
          Order{" "}
          <Link href={`/account/orders/${q.orderReference}`} className="font-semibold underline">
            {q.orderReference}
          </Link>{" "}
          was made from this quotation. You can follow it from your orders.
        </Alert>
      ) : null}
      {q.status === "accepted" && !q.orderReference ? (
        <Alert tone="info" title="Thank you for accepting">
          We will contact you to confirm your order. It will appear under My Orders once it is confirmed.
        </Alert>
      ) : null}
      {q.status === "declined" && q.declineReason ? <p className="acct-lead">Your reason: {q.declineReason}</p> : null}

      <section aria-labelledby="qr-title" className="acct-card">
        <SectionHead id="qr-title" title="Your request" />
        <dl className="acct-details">
          <div>
            <dt>Reference</dt>
            <dd>{q.reference}</dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>{formatDateTime(q.createdAt, business.timezone)}</dd>
          </div>
          {q.details.map((d) => (
            <div key={d.label}>
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
          {q.fileCount > 0 ? (
            <div>
              <dt>Reference photos</dt>
              <dd>{q.fileCount} attached</dd>
            </div>
          ) : null}
        </dl>
        {q.message ? <p className="acct-lead mt-6 whitespace-pre-line">{q.message}</p> : null}
      </section>
    </>
  );
}
