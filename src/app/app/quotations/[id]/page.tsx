import { MessageCircle, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { FileUploader } from "@/components/forms/file-uploader";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { whatsappLink } from "@/lib/contact";
import { isAppError } from "@/lib/errors";
import { one, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { QUOTATION_STATUS_LABEL } from "@/lib/schemas/quotation";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getQuotation } from "@/server/quotations";
import { listLocations } from "@/server/inventory";
import { ActionForm as AF, FField as FF, FSelect as FS, FTextArea as FT, SubmitButton as SB } from "@/components/forms/action-form";
import { convertQuotationAction } from "../../orders/actions";
import { QUOTATION_TONE } from "../page";
import { attachQuotationFilesAction, decideQuotationAction, reviseQuotationAction, sendQuotationAction } from "../actions";

export const metadata = { title: "Quotation" };

export default async function QuotationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const rev = Number.parseInt(one((await searchParams).rev) ?? "", 10);
  const actor = await requireActor();
  let d;
  try {
    d = await getQuotation(actor, id, Number.isFinite(rev) ? rev : undefined);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const { quotation: q, revision, items, customer } = d;
  const canConvert = d.isCurrent && q.status === "accepted" && can(actor, "quotations:convert") && can(actor, "orders:write");
  const allReady = items.length > 0 && items.every((i) => i.kind === "ready_made");
  const locs = canConvert && allReady ? await listLocations(actor) : [];
  const canWrite = can(actor, "quotations:write");
  const canSend = can(actor, "quotations:send");
  const cur = q.currency;
  const waText = `Hello ${customer.name}, here is our quotation ${q.reference} (valid until ${formatDate(revision.validUntil, business.timezone)}). Total: ${formatMoney(revision.total, cur)}.`;

  const decideForm = (decision: "accepted" | "rejected") => (
    <ActionForm action={decideQuotationAction} className="space-y-0">
      <input type="hidden" name="id" value={q.id} />
      <input type="hidden" name="decision" value={decision} />
      <ConfirmSubmit
        title={decision === "accepted" ? "Record that the customer accepted?" : "Record that the customer rejected?"}
        description={decision === "accepted" ? "This accepts the quotation as sent. It can no longer be changed, and the enquiry is marked Won." : "The quotation is marked rejected. You can still create a new revision later."}
        confirmLabel={decision === "accepted" ? "Mark accepted" : "Mark rejected"}
        destructive={decision === "rejected"}
        variant={decision === "accepted" ? "primary" : "secondary"}
      >
        {decision === "accepted" ? "Mark accepted" : "Mark rejected"}
      </ConfirmSubmit>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        title={`${q.reference}${q.currentRevisionNo > 1 ? ` · revision ${d.revision.revisionNo}` : ""}`}
        description={`${customer.name}${customer.company ? ` · ${customer.company}` : ""}`}
        actions={
          <>
            <ButtonLink href={`/print/quotations/${q.id}?rev=${revision.revisionNo}`} variant="secondary" target="_blank">
              <Printer aria-hidden="true" className="size-4" /> Print / PDF<span className="sr-only"> (opens in a new tab)</span>
            </ButtonLink>
            {customer.phone ? (
              <ButtonLink href={`${whatsappLink(customer.phone, business.phoneCountryCode)}?text=${encodeURIComponent(waText)}`} variant="secondary" target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" className="size-4" /> Open WhatsApp<span className="sr-only"> (opens in a new tab; you send the message yourself)</span>
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={QUOTATION_TONE[q.status]}>{QUOTATION_STATUS_LABEL[q.status]}</StatusBadge>
        {d.pastValidity ? <StatusBadge tone="warning">Past valid-until date</StatusBadge> : null}
        <span className="text-sm text-text-muted">Valid until {formatDate(revision.validUntil, business.timezone)}</span>
        {d.leadReference ? <span className="text-sm text-text-muted">Enquiry {d.leadReference}</span> : null}
      </div>
      {!d.isCurrent ? <Alert tone="info" title={`Viewing revision ${revision.revisionNo} (superseded)`} className="mb-6">This is an earlier version, kept for the record. <Link className="underline" href={`/app/quotations/${q.id}`}>Go to the current revision</Link>.</Alert> : null}
      {q.status === "accepted" ? <Alert tone="success" title="Accepted" className="mb-6">This quotation is final and cannot be changed. Create the order below.</Alert> : null}
      {q.status === "converted" ? <Alert tone="success" title="Converted to an order" className="mb-6">The accepted lines and prices were copied to the order, which now carries them.</Alert> : null}
      {canConvert ? (
        <div className="mb-6">
          <Panel title="Create the order" description={allReady ? "Ready-made items: choose where the stock comes from. Stock is reserved when you confirm the order." : "Custom items become a custom order. Production is set up when the order is confirmed."}>
            <AF action={convertQuotationAction}>
              <input type="hidden" name="quotationId" value={q.id} />
              <div className="grid gap-4 md:grid-cols-2">
                {allReady ? <FS name="locationId" label="Stock comes from" required placeholder="Choose a location" options={locs.filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} /> : null}
                {!allReady ? <FF name="requestedCompletionDate" label="Wanted by" type="date" /> : null}
              </div>
              <FT name="depositTerms" label="Deposit and payment terms" rows={2} hint="Free text, e.g. “30% now, balance on delivery”. No percentage is assumed." />
              <FT name="notes" label="Notes" rows={2} />
              <SB>Create order from this quotation</SB>
            </AF>
          </Panel>
        </div>
      ) : null}

      {d.isCurrent ? (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {q.status === "draft" && canWrite ? <ButtonLink href={`/app/quotations/${q.id}/edit`}>Edit draft</ButtonLink> : null}
          {q.status === "draft" && canSend ? (
            <ActionForm action={sendQuotationAction} className="space-y-0">
              <input type="hidden" name="id" value={q.id} />
              <ConfirmSubmit title="Mark as sent?" description="Once marked as sent, this version is locked. Any change after that needs a new revision, so the customer's copy and ours always match." confirmLabel="Mark as sent" destructive={false} variant="primary">
                Mark as sent
              </ConfirmSubmit>
            </ActionForm>
          ) : null}
          {q.status === "sent" && canWrite ? (
            <>
              {decideForm("accepted")}
              {decideForm("rejected")}
            </>
          ) : null}
          {["sent", "rejected", "expired"].includes(q.status) && canWrite ? (
            <ActionForm action={reviseQuotationAction} className="space-y-0">
              <input type="hidden" name="id" value={q.id} />
              <ConfirmSubmit title="Create a new revision?" description={`A copy of revision ${q.currentRevisionNo} becomes a new editable draft. The version already sent is kept unchanged.`} confirmLabel="Create revision" destructive={false}>
                Revise
              </ConfirmSubmit>
            </ActionForm>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="Items">
            <TableWrap label="Quotation items">
              <Table>
                <THead>
                  <tr>
                    <TH>Description</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">Unit price</TH>
                    <TH className="hidden text-right sm:table-cell">Discount</TH>
                    <TH className="text-right">Line total</TH>
                  </tr>
                </THead>
                <tbody>
                  {items.map((i) => {
                    const s = (i.specification ?? {}) as Record<string, string>;
                    return (
                      <TR key={i.id}>
                        <TD>
                          <div className="font-medium">{i.description}</div>
                          <div className="text-text-muted">{i.kind === "custom" ? "Custom" : "Ready-made"}</div>
                          {Object.keys(s).length ? (
                            <ul className="mt-1 text-xs text-text-muted">
                              {s.dimensions ? <li>Dimensions: {s.dimensions}</li> : null}
                              {s.material ? <li>Wood / material: {s.material}</li> : null}
                              {s.finish ? <li>Finish: {s.finish}</li> : null}
                              {s.notes ? <li>{s.notes}</li> : null}
                            </ul>
                          ) : null}
                        </TD>
                        <TD numeric>{Number(i.quantity)}</TD>
                        <TD numeric>{formatMoney(i.unitPrice, cur)}</TD>
                        <TD numeric className="hidden sm:table-cell">{Number(i.discountAmount) ? formatMoney(i.discountAmount, cur) : "—"}</TD>
                        <TD numeric>{formatMoney(i.lineTotal, cur)}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd className="tabular">{formatMoney(revision.subtotal, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Discounts</dt><dd className="tabular">− {formatMoney(revision.discountTotal, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Delivery</dt><dd className="tabular">{formatMoney(revision.deliveryCharge, cur)}</dd></div>
              <div className="flex justify-between border-t border-border pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatMoney(revision.total, cur)}</dd></div>
            </dl>
          </Panel>
          {revision.terms || revision.customerNotes || revision.internalNotes ? (
            <Panel title="Terms and notes">
              <div className="space-y-4 text-sm">
                {revision.terms ? <div><h3 className="font-medium">Terms</h3><p className="whitespace-pre-line text-text-muted">{revision.terms}</p></div> : null}
                {revision.customerNotes ? <div><h3 className="font-medium">Notes for the customer</h3><p className="whitespace-pre-line text-text-muted">{revision.customerNotes}</p></div> : null}
                {revision.internalNotes ? <div><h3 className="font-medium">Internal notes</h3><p className="whitespace-pre-line text-text-muted">{revision.internalNotes}</p></div> : null}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Revision history" description="Every version is kept. A version that was sent can never be edited.">
            <ol className="space-y-2 text-sm">
              {d.revisions.map((r) => (
                <li key={r.revisionNo} className="flex items-center justify-between gap-2">
                  <Link className={(r.revisionNo === revision.revisionNo ? "font-semibold underline" : "underline") + " whitespace-nowrap"} href={`/app/quotations/${q.id}?rev=${r.revisionNo}`} aria-current={r.revisionNo === revision.revisionNo ? "true" : undefined}>
                    Revision {r.revisionNo}
                  </Link>
                  <span className="text-text-muted">
                    {formatMoney(r.total, cur)} · {r.frozenAt ? `sent ${formatDateTime(r.frozenAt, business.timezone)}` : "draft"}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
          {can(actor, "files:view_customer_private") ? (
            <Panel title="Reference files">
              {d.files.length === 0 ? <p className="text-sm text-text-muted">No files attached.</p> : (
                <ul className="mb-4 divide-y divide-border text-sm">
                  {d.files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate">{f.name}</span>
                      <a className="shrink-0 underline" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer">Open<span className="sr-only"> {f.name} (opens in a new tab)</span></a>
                    </li>
                  ))}
                </ul>
              )}
              {canWrite ? (
                <ActionForm action={attachQuotationFilesAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <FileUploader purpose="quotation_attachment" label="Add reference files" accept="image/jpeg,image/png,image/webp,application/pdf" maxFiles={5} />
                  <SubmitButton>Attach files</SubmitButton>
                </ActionForm>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
