import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FField, FSelect, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { PO_STATUS_LABEL, PO_STATUS_TONE, SUPPLIER_PAY_LABEL, SUPPLIER_PAY_TONE } from "@/lib/purchasing-ui";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getPurchaseOrder } from "@/server/purchasing";
import { cancelPoAction, receiveGoodsAction, recordInvoiceAction, recordSupplierPaymentAction, sendPoAction } from "../actions";

export const metadata = { title: "Purchase order" };

export default async function PoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let po;
  try {
    po = await getPurchaseOrder(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const tz = business.timezone;
  const cur = po.currency;
  const write = can(actor, "purchasing:write");
  const canReceive = can(actor, "purchasing:receive") && (po.status === "sent" || po.status === "partially_received");
  const money = po.showMoney;
  const canPay = can(actor, "purchasing:record_payment") && (po.status === "sent" || po.status === "partially_received" || po.status === "received");

  return (
    <>
      <PageHeader
        title={`${po.reference} · ${po.supplierName}`}
        description={`Receive into ${po.locationName}${po.expectedOn ? ` · expected ${formatDate(po.expectedOn, tz)}` : ""}`}
        actions={write && po.status === "draft" ? <ButtonLink href={`/app/purchase-orders/${po.id}/edit`} variant="secondary">Edit draft</ButtonLink> : undefined}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={PO_STATUS_TONE[po.status]}>{PO_STATUS_LABEL[po.status]}</StatusBadge>
        {money && po.paymentStatus !== "n_a" ? <StatusBadge tone={SUPPLIER_PAY_TONE[po.paymentStatus]}>{SUPPLIER_PAY_LABEL[po.paymentStatus]}</StatusBadge> : null}
        {po.status === "cancelled" ? <span className="text-sm text-text-muted">Reason: {po.cancelReason}</span> : null}
      </div>

      {write && po.status === "draft" ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <ActionForm action={sendPoAction} className="space-y-0">
            <input type="hidden" name="id" value={po.id} />
            <ConfirmSubmit title="Mark as sent?" description="Lines are locked once the order is sent. You can still receive goods against it and cancel it before anything arrives." confirmLabel="Mark as sent" destructive={false} variant="primary">Mark as sent to supplier</ConfirmSubmit>
          </ActionForm>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="Items">
            <TableWrap label="Ordered items">
              <Table>
                <THead>
                  <tr><TH>Item</TH><TH className="text-right">Ordered</TH><TH className="text-right">Received</TH><TH className="text-right">Still expected</TH>{money ? <TH className="hidden text-right md:table-cell">Cost / unit</TH> : null}</tr>
                </THead>
                <tbody>
                  {po.lines.map((l) => (
                    <TR key={l.id}>
                      <TD><span className="font-medium">{l.itemName}</span><span className="block text-xs text-text-muted">{l.sku}</span></TD>
                      <TD numeric>{Number(l.quantityOrdered)} {l.unit}</TD>
                      <TD numeric>{Number(l.received)} {l.unit}</TD>
                      <TD numeric>{Number(l.remaining)} {l.unit}</TD>
                      {money ? <TD numeric className="hidden md:table-cell">{l.expectedUnitCost ? formatMoney(l.expectedUnitCost, cur) : "—"}</TD> : null}
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            {money && po.orderValue ? <p className="mt-4 text-right text-sm">Expected value <span className="tabular ml-2 text-base font-semibold">{formatMoney(po.orderValue, cur)}</span></p> : null}
            {po.notes ? <p className="mt-4 whitespace-pre-line text-sm"><span className="text-text-muted">Notes: </span>{po.notes}</p> : null}
          </Panel>

          {canReceive ? (
            <Panel title="Receive goods" description="Enter what actually arrived. Stock goes up by exactly these quantities — leave a line blank if nothing arrived for it.">
              <ActionForm action={receiveGoodsAction}>
                <input type="hidden" name="id" value={po.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  {po.lines.filter((l) => Number(l.remaining) > 0).map((l) => (
                    <FField key={l.id} name={`qty_${l.id}`} label={`${l.itemName} (${l.unit})`} inputMode="decimal" hint={`Up to ${Number(l.remaining)} still expected`} />
                  ))}
                </div>
                <FField name="note" label="Note" hint="e.g. delivery note number, damaged items" />
                <SubmitButton size="lg" pendingLabel="Recording…">Record receipt</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          <Panel title="Receipts">
            {po.receipts.length === 0 ? <p className="text-sm text-text-muted">Nothing received yet.</p> : (
              <ul className="divide-y divide-border text-sm">
                {po.receipts.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="font-medium">{r.reference}</p>
                    <p className="text-text-muted">{formatDateTime(r.receivedAt, tz)} · {r.byName ?? "—"}</p>
                    {r.note ? <p className="mt-0.5">{r.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          {money ? (
            <Panel title="Supplier invoice and payments" description="Tracks what was invoiced and paid for this order. It is not a payables ledger.">
              <dl className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Supplier invoice</dt><dd className="tabular">{po.supplierInvoiceAmount ? `${formatMoney(po.supplierInvoiceAmount, cur)}${po.supplierInvoiceRef ? ` (${po.supplierInvoiceRef})` : ""}` : "Not recorded"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Paid so far</dt><dd className="tabular">{formatMoney(po.paid ?? "0", cur)}</dd></div>
              </dl>
              {po.payments.length > 0 ? (
                <ul className="mb-4 divide-y divide-border text-sm">
                  {po.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 py-2">
                      <span>{formatDate(p.paidAt, tz)} · {PAYMENT_METHOD_LABEL[p.method]}{p.reference ? ` · ${p.reference}` : ""}</span>
                      <span className="tabular">{formatMoney(p.amount, cur)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {canPay ? (
                <div className="space-y-6 border-t border-border pt-5">
                  <ActionForm action={recordInvoiceAction}>
                    <h3 className="text-sm font-semibold">Record supplier invoice</h3>
                    <input type="hidden" name="id" value={po.id} />
                    <FField name="amount" label={`Invoice amount (${cur})`} required inputMode="decimal" defaultValue={po.supplierInvoiceAmount ?? ""} />
                    <FField name="ref" label="Invoice number" defaultValue={po.supplierInvoiceRef ?? ""} />
                    <SubmitButton variant="secondary">Save invoice</SubmitButton>
                  </ActionForm>
                  <ActionForm action={recordSupplierPaymentAction}>
                    <h3 className="text-sm font-semibold">Record a payment</h3>
                    <input type="hidden" name="id" value={po.id} />
                    <FField name="amount" label={`Amount (${cur})`} required inputMode="decimal" />
                    <FSelect name="method" label="Method" required defaultValue="bank_transfer" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
                    <FField name="reference" label="Reference" />
                    <SubmitButton variant="secondary">Record payment</SubmitButton>
                  </ActionForm>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {write && (po.status === "draft" || po.status === "sent") ? (
            <Panel title="Cancel purchase order" description="Not possible once any goods have been received.">
              <ActionForm action={cancelPoAction}>
                <input type="hidden" name="id" value={po.id} />
                <FField name="reason" label="Reason" required />
                <ConfirmSubmit title="Cancel this purchase order?" description="The order is cancelled for good. This is recorded in the audit log." confirmLabel="Cancel purchase order">Cancel order</ConfirmSubmit>
              </ActionForm>
            </Panel>
          ) : null}
          <p className="text-sm"><Link className="underline" href={`/app/suppliers/${po.supplierId}`}>View supplier</Link></p>
        </div>
      </div>
    </>
  );
}
