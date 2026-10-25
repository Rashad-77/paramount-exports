import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill, SectionHead } from "@/components/public/account-ui";
import { requireCustomer } from "@/lib/auth/customer";
import { PIECE_FIELDS } from "@/lib/enquiry-form-labels";
import { isAppError } from "@/lib/errors";
import { quoteRef } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getAccountMessage } from "@/server/accounts";

export const metadata: Metadata = { title: "Your message" };

/** One of the customer's own enquiries or requests: what they sent, and every reply we have sent back. */
export default async function AccountMessagePage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const ref = reference.toUpperCase();
  if (!/^MSG-\d{4,8}$/.test(ref)) notFound();
  const customer = await requireCustomer(`/account/messages/${ref}`);
  const business = await getBusinessSettings();
  let m;
  try {
    m = await getAccountMessage(customer.id, ref);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const custom = m.kind === "custom";
  const piece = m.payload ?? {};
  return (
    <div>
      <p className="mb-6 text-sm">
        <Link href="/account" className="underline">
          Back to your account
        </Link>
      </p>
      <SectionHead title={`${custom ? "Your request" : "Your enquiry"} ${custom ? quoteRef(m.reference) : m.reference}`} />
      <p className="mb-6 text-sm">
        Sent {formatDateTime(m.createdAt, business.timezone)} · <Pill tone={m.answered ? "success" : "info"}>{m.answered ? "Answered" : "Waiting for our reply"}</Pill>
      </p>

      <h3 className="mb-2 font-display text-lg">What you sent</h3>
      {custom ? (
        <dl className="mb-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {PIECE_FIELDS.map((f) => (
            <div key={f.key}>
              <dt className="text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00254),0.75rem)] font-semibold uppercase tracking-[0.08em]">{f.label}</dt>
              <dd>{piece[f.key] ? (f.key === "targetDate" ? formatDate(String(piece[f.key]), "UTC") : String(piece[f.key])) : "Not given"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mb-8 whitespace-pre-line border border-border px-4 py-3">{m.message ?? "No message was written."}</p>

      <h3 className="mb-2 font-display text-lg">Our replies</h3>
      {m.replies.length === 0 ? (
        <p className="text-sm">We have not replied yet. We reply within one working day, using the details on your account.</p>
      ) : (
        <ul className="space-y-3">
          {m.replies.map((r) => (
            <li key={r.id} className="border border-border px-4 py-3">
              <p className="whitespace-pre-line">{r.body}</p>
              <p className="mt-2 text-sm">{formatDateTime(r.createdAt, business.timezone)}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm">
        Need to ask something else? <Link href="/contact" className="underline">Contact us</Link>
      </p>
    </div>
  );
}
