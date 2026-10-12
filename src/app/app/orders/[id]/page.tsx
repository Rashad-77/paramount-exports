import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { ORDER_TONE } from "@/lib/order-ui";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, orderStatusLabel, orderTypeLabel } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getOrder } from "@/server/orders";
import { getJobStatusForOrder } from "@/server/production";
import { STAGE_LABEL, STAGE_TONE, type JobStage } from "@/lib/production";
import { advanceOrderAction, cancelOrderAction, confirmOrderAction, recordPaymentAction, updateTermsAction, voidPaymentAction } from "../actions";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let d;
  try {
    d = await getOrder(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const job = d.order.type === "custom" ? await getJobStatusForOrder(actor, d.order.id) : null;
  const { order: o, items, money } = d;
  const cur = o.currency;
  const canWrite = can(actor, "orders:write");
  const live = o.status !== "cancelled" && o.status !== "delivered";
  const short = d.availability ? items.filter((i) => Number(d.availability![i.id]) < Number(i.quantity)) : [];

  const advance = (to: "preparing" | "ready" | "delivered", label: string, primary = false) => (
    <ActionForm action={advanceOrderAction} className="space-y-0">
      <input type="hidden" name="id" value={o.id} />
      <input type="hidden" name="to" value={to} />
      <ConfirmSubmit
        title={`${label}?`}
        description={to === "delivered" ? (o.type === "ready_made" ? "The reserved stock is deducted from the location now. This cannot be undone and the order becomes final." : "The order becomes final.") : "The status is updated for everyone."}
        confirmLabel={label}
        destructive={false}
        variant={primary ? "primary" : "secondary"}
      >
        {label}
      </ConfirmSubmit>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        title={`${o.reference} · ${d.customer.name}`}
        description={`${orderTypeLabel(o.type)}${d.quotationReference ? ` from ${d.quotationReference}` : ""}${d.locationName ? ` · stock from ${d.locationName}` : ""}`}
        actions={d.quotationReference && o.quotationId ? <Link className="inline-flex min-h-10 items-center underline" href={`/app/quotations/${o.quotationId}`}>View quotation</Link> : undefined}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={ORDER_TONE[o.status]}>{orderStatusLabel(o.status, o.type)}</StatusBadge>
        {o.requestedCompletionDate ? <span className="text-sm text-text-muted">Wanted by {formatDate(o.requestedCompletionDate, business.timezone)}</span> : null}
        {o.status === "cancelled" ? <span className="text-sm text-text-muted">Reason: {o.cancelReason}</span> : null}
      </div>

      {job ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium">Workshop</span>
          <StatusBadge tone={STAGE_TONE[job.stage as JobStage]}>{STAGE_LABEL[job.stage as JobStage]}</StatusBadge>
          <span className="text-text-muted">Job {job.reference}{job.targetDate ? ` · due ${formatDate(job.targetDate, business.timezone)}` : ""}</span>
          {job.linkable ? <Link className="inline-flex min-h-10 items-center underline" href={`/app/production/${job.id}`}>Open job</Link> : null}
        </div>
      ) : null}

      {o.status === "draft" && short.length > 0 ? (
        <Alert tone="warning" title="Not enough stock to confirm yet" className="mb-6">
          {short.map((i) => `${i.description}: available ${Number(d.availability![i.id])}, needed ${Number(i.quantity)}`).join("; ")}. Confirming will be refused until stock is received or the quantity is reduced.
        </Alert>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start gap-3">
        {o.status === "draft" && canWrite && o.type === "ready_made" ? <ButtonLink href={`/app/orders/${o.id}/edit`} variant="secondary">Edit draft</ButtonLink> : null}
        {o.status === "draft" && can(actor, "orders:confirm") ? (
          <ActionForm action={confirmOrderAction} className="space-y-0">
            <input type="hidden" name="id" value={o.id} />
            <ConfirmSubmit title="Confirm this order?" description={o.type === "ready_made" ? "Stock is reserved for this customer now. If any item is short, nothing is reserved and you will see exactly what is missing. After confirming, the lines and prices are locked." : "The order is confirmed and its lines and prices are locked."} confirmLabel="Confirm order" destructive={false} variant="primary">
              Confirm order
            </ConfirmSubmit>
          </ActionForm>
        ) : null}
        {canWrite && o.status === "confirmed" ? advance("preparing", o.type === "custom" ? "Mark in production" : "Start preparing") : null}
        {canWrite && (o.status === "confirmed" || o.status === "preparing") ? advance("ready", "Mark ready for delivery / pickup") : null}
        {canWrite && (o.status === "confirmed" || o.status === "preparing" || o.status === "ready") ? advance("delivered", "Mark delivered", true) : null}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="Items">
            <TableWrap label="Order items">
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
                          {Object.keys(s).length ? (
                            <ul className="mt-1 text-xs text-text-muted">
                              {s.dimensions ? <li>Dimensions: {s.dimensions}</li> : null}
                              {s.material ? <li>Wood / material: {s.material}</li> : null}
                              {s.finish ? <li>Finish: {s.finish}</li> : null}
                              {s.notes ? <li>{s.notes}</li> : null}
                            </ul>
                          ) : null}
                          {d.availability ? <div className="mt-1 text-xs text-text-muted">Available now: {Number(d.availability[i.id])}</div> : null}
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
              <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd className="tabular">{formatMoney(o.subtotal, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Discounts</dt><dd className="tabular">− {formatMoney(o.discountTotal, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Delivery</dt><dd className="tabular">{formatMoney(o.deliveryCharge, cur)}</dd></div>
              <div className="flex justify-between border-t border-border pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular">{formatMoney(o.total, cur)}</dd></div>
            </dl>
          </Panel>

          {money ? (
            <Panel title="Payments" description="Money received against this order. Entries are never deleted; a mistake is voided and the void is recorded.">
              <dl className="mb-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-text-muted">Order total</dt><dd className="tabular text-lg font-semibold">{formatMoney(o.total, cur)}</dd></div>
                <div><dt className="text-text-muted">Received</dt><dd className="tabular text-lg font-semibold">{formatMoney(money.paid, cur)}</dd></div>
                <div><dt className="text-text-muted">Outstanding</dt><dd className="tabular text-lg font-semibold">{formatMoney(money.outstanding, cur)}</dd></div>
              </dl>
              {money.entries.length === 0 ? (
                <p className="mb-6 text-sm text-text-muted">No payments recorded yet.</p>
              ) : (
                <TableWrap label="Payments" className="mb-6">
                  <Table>
                    <THead>
                      <tr>
                        <TH>When</TH>
                        <TH>Method</TH>
                        <TH className="text-right">Amount</TH>
                        <TH className="hidden md:table-cell">Reference / by</TH>
                        <TH>{can(actor, "payments:void") ? "Action" : "Status"}</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {money.entries.map((e) => (
                        <TR key={e.id}>
                          <TD className="whitespace-nowrap">{formatDateTime(e.paidAt, business.timezone)}</TD>
                          <TD>{PAYMENT_METHOD_LABEL[e.method]}</TD>
                          <TD numeric className={e.voidsPaymentId ? "text-danger" : ""}>{formatMoney(e.amount, cur)}</TD>
                          <TD className="hidden md:table-cell">
                            {e.reference ?? e.note ?? "—"}
                            <div className="text-xs text-text-muted">{e.recordedByName ?? ""}</div>
                          </TD>
                          <TD>
                            {e.voidsPaymentId ? (
                              <StatusBadge tone="danger">Reversal</StatusBadge>
                            ) : e.voided ? (
                              <StatusBadge tone="neutral">Voided</StatusBadge>
                            ) : can(actor, "payments:void") ? (
                              <details>
                                <summary className="cursor-pointer text-sm underline">Void…</summary>
                                <ActionForm action={voidPaymentAction} className="mt-3 min-w-56 space-y-3">
                                  <input type="hidden" name="paymentId" value={e.id} />
                                  <input type="hidden" name="orderId" value={o.id} />
                                  <FField name="reason" label="Why is it being voided?" required />
                                  <ConfirmSubmit title="Void this payment?" description="A reversal is added and the outstanding balance goes back up. The original entry stays on record. This is audited." confirmLabel="Void payment">
                                    Void payment
                                  </ConfirmSubmit>
                                </ActionForm>
                              </details>
                            ) : (
                              <StatusBadge tone="success">Recorded</StatusBadge>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
              {can(actor, "payments:record") && (o.status === "confirmed" || o.status === "preparing" || o.status === "ready" || o.status === "delivered") && Number(money.outstanding) > 0 ? (
                <ActionForm action={recordPaymentAction} className="border-t border-border pt-6">
                  <h3 className="text-sm font-semibold">Record a payment or deposit</h3>
                  <input type="hidden" name="orderId" value={o.id} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FField name="amount" label={`Amount (${cur})`} required inputMode="decimal" hint={`Up to ${formatMoney(money.outstanding, cur)}`} />
                    <FSelect name="method" label="Method" required defaultValue="cash" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
                    <FField name="reference" label="Reference" hint="Receipt or transfer number" />
                  </div>
                  <SubmitButton>Record payment</SubmitButton>
                </ActionForm>
              ) : null}
            </Panel>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          {live && canWrite ? (
            <Panel title="Terms and notes">
              <ActionForm action={updateTermsAction}>
                <input type="hidden" name="id" value={o.id} />
                <FTextArea name="depositTerms" label="Deposit and payment terms" rows={2} defaultValue={o.depositTerms ?? ""} />
                <FField name="requestedCompletionDate" label="Wanted by" type="date" defaultValue={o.requestedCompletionDate ?? ""} />
                <FTextArea name="notes" label="Notes" rows={2} defaultValue={o.notes ?? ""} />
                <SubmitButton variant="secondary">Save</SubmitButton>
              </ActionForm>
            </Panel>
          ) : o.depositTerms || o.notes ? (
            <Panel title="Terms and notes">
              <div className="space-y-3 text-sm">
                {o.depositTerms ? <p><span className="text-text-muted">Terms: </span>{o.depositTerms}</p> : null}
                {o.notes ? <p className="whitespace-pre-line"><span className="text-text-muted">Notes: </span>{o.notes}</p> : null}
              </div>
            </Panel>
          ) : null}
          {live && can(actor, "orders:cancel") ? (
            <Panel title="Cancel order" description={money && Number(money.paid) > 0 ? "Money has been received, so only a manager or the owner can cancel. Void the payment afterwards if it is refunded." : "Reserved stock is released immediately."}>
              <ActionForm action={cancelOrderAction}>
                <input type="hidden" name="id" value={o.id} />
                <FField name="reason" label="Reason" required />
                <ConfirmSubmit title="Cancel this order?" description="The order is cancelled for good and any reserved stock is released. This is recorded in the audit log." confirmLabel="Cancel order">
                  Cancel order
                </ConfirmSubmit>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
