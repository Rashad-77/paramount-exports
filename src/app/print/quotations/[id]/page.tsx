import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/print-button";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { one, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { getQuotation } from "@/server/quotations";

export const metadata = { title: "Quotation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Print-friendly quotation: use the browser's Print → Save as PDF. Shows only what the customer should see
 * (never internal notes) and the business details configured in Settings.
 */
export default async function PrintQuotationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const rev = Number.parseInt(one((await searchParams).rev) ?? "", 10);
  const actor = await requireActor();
  let d;
  try {
    d = await getQuotation(actor, id, Number.isFinite(rev) ? rev : undefined);
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  const b = await getBusinessSettings();
  const { quotation: q, revision, items, customer } = d;
  const cur = q.currency;
  const isDraft = !revision.frozenAt;

  return (
    <main id="main" className="mx-auto max-w-[52rem] bg-white p-8 text-[0.9375rem] text-black print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <p className="text-sm text-text-muted">Use Print → “Save as PDF” to download. {isDraft ? "This is a DRAFT and is marked as such." : null}</p>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-6 border-b border-black pb-5">
        <div>
          <h1 className="font-display text-3xl">{b.name}</h1>
          {b.address ? <p className="mt-1 whitespace-pre-line text-sm">{b.address}</p> : null}
          <p className="text-sm">{[b.phone, b.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold uppercase tracking-wide">Quotation</p>
          <p className="tabular">{q.reference}{q.currentRevisionNo > 1 || revision.revisionNo > 1 ? ` · revision ${revision.revisionNo}` : ""}</p>
          {isDraft ? <p className="mt-1 inline-block border border-black px-2 text-xs font-semibold uppercase">Draft</p> : null}
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Prepared for</h2>
          <p className="mt-1 font-medium">{customer.name}</p>
          {customer.company ? <p>{customer.company}</p> : null}
          {customer.address ? <p className="whitespace-pre-line">{customer.address}</p> : null}
          <p>{[customer.phone, customer.email].filter(Boolean).join(" · ")}</p>
        </div>
        <dl className="text-right">
          <div><dt className="inline text-text-muted">Date: </dt><dd className="inline">{formatDate(revision.frozenAt ?? revision.createdAt, b.timezone)}</dd></div>
          <div><dt className="inline text-text-muted">Valid until: </dt><dd className="inline font-medium">{formatDate(revision.validUntil, b.timezone)}</dd></div>
        </dl>
      </section>

      <div className="mt-8 overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[30rem] border-collapse text-sm print:min-w-0">
        <thead>
          <tr className="border-y border-black text-left text-xs uppercase tracking-wide">
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit price</th>
            <th className="py-2 text-right">Discount</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const s = (i.specification ?? {}) as Record<string, string>;
            return (
              <tr key={i.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                <td className="py-3 pr-2">
                  <div className="font-medium">{i.description}</div>
                  {Object.keys(s).length ? (
                    <ul className="mt-1 text-xs text-neutral-700">
                      {s.dimensions ? <li>Dimensions: {s.dimensions}</li> : null}
                      {s.material ? <li>Wood / material: {s.material}</li> : null}
                      {s.finish ? <li>Finish: {s.finish}</li> : null}
                      {s.notes ? <li>{s.notes}</li> : null}
                    </ul>
                  ) : null}
                </td>
                <td className="tabular py-3 text-right">{Number(i.quantity)}</td>
                <td className="tabular py-3 text-right">{formatMoney(i.unitPrice, cur)}</td>
                <td className="tabular py-3 text-right">{Number(i.discountAmount) ? formatMoney(i.discountAmount, cur) : "—"}</td>
                <td className="tabular py-3 text-right">{formatMoney(i.lineTotal, cur)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <dl className="mt-4 ml-auto max-w-[18rem] space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{formatMoney(revision.subtotal, cur)}</dd></div>
        <div className="flex justify-between"><dt>Discounts</dt><dd className="tabular">− {formatMoney(revision.discountTotal, cur)}</dd></div>
        <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular">{formatMoney(revision.deliveryCharge, cur)}</dd></div>
        <div className="flex justify-between border-t border-black pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatMoney(revision.total, cur)}</dd></div>
      </dl>

      {revision.terms ? (
        <section className="mt-8 break-inside-avoid text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Terms</h2>
          <p className="mt-1 whitespace-pre-line">{revision.terms}</p>
        </section>
      ) : null}
      {revision.customerNotes ? (
        <section className="mt-6 break-inside-avoid text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</h2>
          <p className="mt-1 whitespace-pre-line">{revision.customerNotes}</p>
        </section>
      ) : null}

      <section className="mt-12 grid grid-cols-2 gap-10 break-inside-avoid text-sm">
        <div className="border-t border-black pt-1">Accepted by (name &amp; signature)</div>
        <div className="border-t border-black pt-1">Date</div>
      </section>
    </main>
  );
}
