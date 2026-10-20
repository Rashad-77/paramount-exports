import { notFound } from "next/navigation";
import { OrderFlow } from "@/components/app/order-flow";
import { OrderItemsEditor } from "@/components/app/order-items-editor";
import { NewCaseDialog, ResolveCaseDialog } from "@/components/app/order-case-controls";
import { RecordPaymentDialog, RefundDialog, VoidPaymentDialog } from "@/components/app/order-money-dialogs";
import { OrderPricingForm } from "@/components/app/order-pricing-form";
import { PrintButton } from "@/components/app/print-button";
import { OrderTag, PaymentTag } from "@/components/app/tags";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { ToastOnMount } from "@/components/ui/toaster";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { dec, formatMoney } from "@/lib/money";
import { orderMoney } from "@/lib/order-money-calc";
import { handoverAction, NEXT_STATUS_ACTION } from "@/lib/order-ui";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { listVariantOptions } from "@/server/catalogue";
import { getOrderExtras } from "@/server/order-money";
import { allowedNextStatuses, getOrder } from "@/server/orders";
import { setPaidAction, setStatusAction } from "../actions";

export const metadata = { title: "Order" };

const METHOD_LABEL = { cash: "Cash", bank_transfer: "Bank transfer", card: "Card", other: "Other" } as const;
const CASE_LABEL = { complaint: "Complaint", repair: "Repair", warranty: "Warranty claim", other: "Other" } as const;

/** What each recorded action reads like in the order's history. */
const HISTORY_LABEL: Record<string, string> = {
  "order.confirmed": "Confirmed",
  "order.in_progress": "Moved to in production",
  "order.ready": "Marked ready",
  "order.out_for_delivery": "Sent out for delivery",
  "order.delivered": "Marked delivered or collected",
  "order.cancelled": "Cancelled",
  "order.new": "Moved back to new",
  "order.payment_recorded": "Payment recorded",
  "order.payment_voided": "Payment voided",
  "order.refunded": "Refund or return recorded",
  "order.discount_changed": "Discount changed",
  "order.details_updated": "Pricing, planned day or note updated",
  "order.items_changed": "Items changed",
  "order.case_opened": "After-sales case opened",
  "order.case_resolved": "After-sales case resolved",
  "order.case_reopened": "After-sales case reopened",
  "order.marked_paid": "Marked as paid",
  "order.marked_unpaid": "Marked as not paid",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let data;
  try {
    data = await getOrder(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const { order: o, items } = data;
  const extras = await getOrderExtras(actor, id);
  const finished = o.status === "delivered" || o.status === "cancelled";
  const canUpdate = can(actor, "orders:update");
  const canRecord = can(actor, "orders:record_payment");
  const canRefund = can(actor, "orders:refund");
  const canVoid = can(actor, "orders:void_payment");
  const canDiscount = can(actor, "orders:discount");
  const canEditItems = can(actor, "orders:edit_items") && !finished;
  const canCases = can(actor, "orders:cases");
  const variantOptions = canEditItems ? await listVariantOptions(actor) : [];
  const next = allowedNextStatuses(o.status, o.fulfilment).filter((s) => s !== "cancelled");
  const canCancel = can(actor, "orders:cancel") && allowedNextStatuses(o.status, o.fulfilment).includes("cancelled");
  const delivery = o.fulfilment === "delivery";
  const when = (d: Date | null) => (d ? formatDateTime(d, business.timezone) : null);
  const money = (v: string | number) => formatMoney(v, o.currency);

  const calc = orderMoney(o);
  const net = dec(calc.net);
  const balance = dec(calc.balance);
  const overpaid = dec(calc.overpaid).gt(0) ? dec(calc.overpaid) : null;
  const payState = calc.state;
  const returnable = items.map((i) => ({ id: i.id, name: i.productName, detail: [i.variantLabel, i.sku].filter(Boolean).join(" · "), unitPrice: i.unitPrice, available: i.quantity - i.returnedQuantity }));
  const heldAfterCancel = o.status === "cancelled" && net.gt(0);

  const actionButtons = (
    <>
      {canUpdate && !finished ? (
        <>
          {next.map((s) => (
            <ActionForm key={s} action={setStatusAction} className="space-y-0">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="status" value={s} />
              <SubmitButton>{s === "delivered" ? handoverAction(o.fulfilment) : (NEXT_STATUS_ACTION[s] ?? STATUS_LABEL[s])}</SubmitButton>
            </ActionForm>
          ))}
          {canCancel ? (
            <ActionForm action={setStatusAction} className="space-y-0">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="status" value="cancelled" />
              <ConfirmSubmit
                variant="danger"
                title="Cancel this order?"
                description={net.gt(0) ? `The order is cancelled. ${money(net.toString())} has already been paid, so remember to refund it from the Payments section.` : "The order is cancelled and the items go back in stock. Tell the customer."}
                confirmLabel="Cancel order"
              >
                Cancel order
              </ConfirmSubmit>
            </ActionForm>
          ) : null}
        </>
      ) : null}
      {canRecord && !o.isPaid && o.status !== "cancelled" ? (
        <ActionForm action={setPaidAction} className="space-y-0">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="paid" value="true" />
          <SubmitButton variant="secondary">Mark as paid</SubmitButton>
        </ActionForm>
      ) : null}
    </>
  );

  // History: the order was placed, then every recorded action with who did it.
  const history = [
    { at: o.createdAt, label: "Order placed", by: "the customer", detail: null as string | null },
    ...extras.history.filter((h) => h.action !== "order.placed_from_website").map((h) => ({ at: h.at, label: HISTORY_LABEL[h.action] ?? h.action.replace(/^order\./, "").replace(/_/g, " "), by: h.by, detail: h.detail })),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/app/orders", to: "orders" }}
        title={o.reference}
        description={`Placed ${formatDateTime(o.createdAt, business.timezone)}${o.invoiceNumber ? ` · Invoice ${o.invoiceNumber}` : ""}`}
        badges={
          <>
            <OrderTag status={o.status} isPaid={o.isPaid} fulfilment={o.fulfilment} />
            <PaymentTag state={payState} />
          </>
        }
        actions={
          <>
            {actionButtons}
            <PrintButton href={`/print/orders/${o.id}`} />
          </>
        }
      />
      {o.status === "ready" ? (
        <ToastOnMount
          tone="info"
          title={delivery ? "Ready for delivery" : "Ready to collect"}
          message={
            delivery
              ? "Agree the delivery day with the customer, then press “Mark as delivered” once it has arrived."
              : o.paymentMethod === "at_showroom"
                ? "Tell the customer it can be collected. Take the payment at the counter, record it, then press “Mark as collected”."
                : "Tell the customer it can be collected from the showroom, then press “Mark as collected” once they have it."
          }
        />
      ) : null}
      {heldAfterCancel ? <ToastOnMount tone="warning" title="Money still held" message={`This order is cancelled but ${money(net.toString())} is still recorded as paid. Refund it from the Payments section.`} /> : null}

      <OrderFlow order={o} timezone={business.timezone} />

      <div className="space-y-6">
        <section className="min-w-0 border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-walnut">Order details</h2>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-8 p-4">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-walnut">Customer details</h3>
              <TableWrap label="Customer details">
                <Table className="table-fixed">
                  <tbody>
                    <TR className="hover:bg-transparent">
                      <TH scope="row" className="w-40 border-r border-border text-left">Name</TH>
                      <TD className="font-medium">{o.customerName}</TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH scope="row" className="w-40 border-r border-border text-left">ID</TH>
                      <TD>CUS-{o.phoneKey}</TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH scope="row" className="w-40 border-r border-border text-left">Mobile</TH>
                      <TD>
                        <a className="underline" href={`tel:${o.phone.replace(/\s+/g, "")}`}>
                          {o.phone}
                        </a>
                      </TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH scope="row" className="w-40 border-r border-border text-left">Email</TH>
                      <TD>{o.email ? <a className="underline" href={`mailto:${o.email}`}>{o.email}</a> : "—"}</TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH scope="row" className="w-40 border-r border-border text-left">{delivery ? "Delivery address" : "Collection"}</TH>
                      <TD className="whitespace-pre-line">{delivery ? o.address : "The customer will collect from the showroom."}</TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH scope="row" className="w-40 border-r border-border text-left">Payment method</TH>
                      <TD>{PAYMENT_LABEL[o.paymentMethod]}</TD>
                    </TR>
                    {o.scheduledFor ? (
                      <TR className="hover:bg-transparent">
                        <TH scope="row" className="w-40 border-r border-border text-left">{delivery ? "Planned delivery" : "Planned collection"}</TH>
                        <TD>{formatDate(o.scheduledFor, "UTC")}</TD>
                      </TR>
                    ) : null}
                  </tbody>
                </Table>
              </TableWrap>
              {o.customerNote ? (
                <p className="mt-3 border border-border px-3 py-2 text-sm">
                  <span className="font-medium">Customer’s note: </span>
                  <span className="whitespace-pre-line">{o.customerNote}</span>
                </p>
              ) : null}
              {o.staffNote ? (
                <p className="mt-3 border border-border bg-linen px-3 py-2 text-sm">
                  <span className="font-medium">Internal note: </span>
                  <span className="whitespace-pre-line">{o.staffNote}</span>
                </p>
              ) : null}
            </section>

            <section className="border-t-2 border-border-strong pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-walnut">Order content</h3>
                {canEditItems ? (
                  <OrderItemsEditor
                    orderId={o.id}
                    currency={o.currency}
                    items={items.map((i) => ({ id: i.id, name: i.productName, detail: [i.variantLabel, i.sku].filter(Boolean).join(" · "), unitPrice: i.unitPrice, quantity: i.quantity, returned: i.returnedQuantity }))}
                    options={variantOptions.map((v) => ({ id: v.id, label: v.label, price: v.price }))}
                  />
                ) : null}
              </div>
              <TableWrap label="Order content">
                <Table>
                  <THead>
                    <tr>
                      <TH>Item</TH>
                      <TH className="text-right">Price</TH>
                      <TH className="text-right">Qty</TH>
                      <TH className="text-right">Total</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {items.map((i) => (
                      <TR key={i.id}>
                        <TD>
                          <div className="font-medium">{i.productName}</div>
                          <div className="text-text-muted">{[i.variantLabel, i.sku].filter(Boolean).join(" · ")}</div>
                          {i.returnedQuantity > 0 ? <div className="text-[0.8125rem] text-text-muted">{i.returnedQuantity} returned</div> : null}
                        </TD>
                        <TD numeric>{money(i.unitPrice)}</TD>
                        <TD numeric>{i.quantity}</TD>
                        <TD numeric>{money(i.lineTotal)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Items</dt>
                  <dd>{money(o.subtotal)}</dd>
                </div>
                {Number(o.discount) > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Discount{o.discountReason ? ` (${o.discountReason})` : ""}</dt>
                    <dd>− {money(o.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-text-muted">{delivery ? "Delivery" : "Collection"}</dt>
                  <dd>{!delivery ? "No charge" : o.deliveryChargeSet ? (Number(o.deliveryCharge) > 0 ? money(o.deliveryCharge) : "No charge") : "To be agreed"}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{money(o.total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Paid</dt>
                  <dd>{money(o.paidAmount)}</dd>
                </div>
                {Number(o.refundedAmount) > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Refunded</dt>
                    <dd>− {money(o.refundedAmount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between font-semibold">
                  <dt>{overpaid ? "Overpaid" : "Balance due"}</dt>
                  <dd>{money((overpaid ?? balance).toString())}</dd>
                </div>
              </dl>
            </section>

            {canUpdate && !finished ? (
              <section className="border-t-2 border-border-strong pt-6">
                <h3 className="mb-3 text-sm font-semibold text-walnut">Pricing and planning</h3>
                <OrderPricingForm
                  orderId={o.id}
                  currency={o.currency}
                  delivery={delivery}
                  deliveryCharge={o.deliveryCharge}
                  deliveryChargeSet={o.deliveryChargeSet}
                  discount={o.discount}
                  discountReason={o.discountReason}
                  canDiscount={canDiscount}
                  scheduledFor={o.scheduledFor}
                  staffNote={o.staffNote}
                />
              </section>
            ) : null}

            <section id="payments" className="scroll-mt-24 border-t-2 border-border-strong pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-walnut">Payments</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {canRecord && o.status !== "cancelled" && balance.gt(0) ? <RecordPaymentDialog orderId={o.id} balance={balance.toFixed(2)} currency={o.currency} defaultMethod={o.paymentMethod === "bank_transfer" ? "bank_transfer" : "cash"} /> : null}
                  {canRefund && (net.gt(0) || returnable.some((r) => r.available > 0)) ? <RefundDialog orderId={o.id} maxAmount={net.gt(0) ? net.toFixed(2) : "0"} currency={o.currency} items={returnable} /> : null}
                </div>
              </div>
              {overpaid ? <p className="mb-3 border border-border bg-linen px-3 py-2 text-sm">This order is overpaid by {money(overpaid.toString())}. Refund the difference.</p> : null}
              {extras.payments.length === 0 ? (
                <p className="text-sm text-text-muted">No payments recorded yet. {money(o.total)} is due.</p>
              ) : (
                <TableWrap label="Payments">
                  <Table>
                    <THead>
                      <tr>
                        <TH>Number</TH>
                        <TH>Date</TH>
                        <TH>Type</TH>
                        <TH>Method</TH>
                        <TH className="text-right">Amount</TH>
                        <TH>By</TH>
                        <TH>
                          <span className="sr-only">Actions</span>
                        </TH>
                      </tr>
                    </THead>
                    <tbody>
                      {extras.payments.map((p) => (
                        <TR key={p.id} className={p.voidedAt ? "text-text-muted line-through" : undefined}>
                          <TD className="whitespace-nowrap">{p.number}</TD>
                          <TD className="whitespace-nowrap">{formatDate(p.paidAt, business.timezone)}</TD>
                          <TD>{p.kind === "refund" ? "Refund" : "Payment"}</TD>
                          <TD>
                            {METHOD_LABEL[p.method]}
                            {p.reference ? <div className="text-[0.8125rem] text-text-muted">{p.reference}</div> : null}
                            {p.note ? <div className="text-[0.8125rem] text-text-muted">{p.note}</div> : null}
                          </TD>
                          <TD numeric>
                            {p.kind === "refund" ? "− " : ""}
                            {money(p.amount)}
                          </TD>
                          <TD>{p.by ?? "—"}</TD>
                          <TD className="whitespace-nowrap text-right">
                            {p.voidedAt ? <span className="no-underline">Voided{p.voidReason ? `: ${p.voidReason}` : ""}</span> : canVoid ? <VoidPaymentDialog orderId={o.id} paymentId={p.id} number={p.number} /> : null}
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </section>

            <section className="border-t-2 border-border-strong pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-walnut">After-sales</h3>
                {canCases ? <NewCaseDialog orderId={o.id} /> : null}
              </div>
              {extras.cases.length === 0 ? (
                <p className="text-sm text-text-muted">No complaints, repairs or warranty claims on this order.</p>
              ) : (
                <ul className="space-y-2">
                  {extras.cases.map((c) => (
                    <li key={c.id} className="border border-border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium">{c.title}</span>
                        <span className="text-[0.8125rem] text-text-muted">{CASE_LABEL[c.kind as keyof typeof CASE_LABEL] ?? c.kind}</span>
                        <span className={c.status === "open" ? "text-[0.8125rem] font-medium text-danger" : "text-[0.8125rem] text-success"}>{c.status === "open" ? "Open" : "Resolved"}</span>
                        <span className="ml-auto flex items-center gap-3">{canCases ? <ResolveCaseDialog orderId={o.id} caseId={c.id} title={c.title} reopen={c.status === "resolved"} /> : null}</span>
                      </div>
                      {c.details ? <p className="mt-1 whitespace-pre-line text-text-muted">{c.details}</p> : null}
                      {c.resolution ? <p className="mt-1 whitespace-pre-line">Resolution: {c.resolution}</p> : null}
                      <p className="mt-1 text-[0.8125rem] text-text-muted">
                        Opened {when(c.createdAt)}
                        {c.by ? ` by ${c.by}` : ""}
                        {c.resolvedAt ? ` · Resolved ${when(c.resolvedAt)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border-t-2 border-border-strong pt-5">
              <h3 className="mb-3 text-sm font-semibold text-walnut">History</h3>
              <ul className="flex flex-col gap-2 border-l-2 border-border-strong pl-4 text-sm">
                {history.map((h, n) => (
                  <li key={n}>
                    {h.label}
                    {h.by ? <span className="text-text-muted"> · {h.by}</span> : null}
                    <span className="block text-[0.8125rem] text-text-muted">
                      {when(h.at)}
                      {h.detail ? ` · ${h.detail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>
    </>
  );
}
