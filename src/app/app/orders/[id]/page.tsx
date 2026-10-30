import { addressStacked } from "@/lib/address-lines";
import { notFound } from "next/navigation";
import { plainPhone } from "@/lib/contact";
import { OrderFlow } from "@/components/app/order-flow";
import { MarkRefundedDialog } from "@/components/app/mark-refunded-dialog";
import { VoidPaymentDialog } from "@/components/app/void-payment-dialog";
import { OrderPricingForm } from "@/components/app/order-pricing-form";
import { PrintButton } from "@/components/app/print-button";
import { OrderTag, PaidTag } from "@/components/app/tags";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { ToastOnMount } from "@/components/ui/toaster";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { handoverAction, NEXT_STATUS_ACTION } from "@/lib/order-ui";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getOrderPayments } from "@/server/order-money";
import { allowedNextStatuses, getOrder } from "@/server/orders";
import { setPaidAction, setStatusAction } from "../actions";

export const metadata = { title: "Order" };

const METHOD_LABEL = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
} as const;

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const payments = await getOrderPayments(actor, id);
  const livePayments = payments.filter((p) => !p.voidedAt);
  const finished =
    o.status === "delivered" ||
    o.status === "cancelled" ||
    o.status === "refunded";
  const canUpdate = can(actor, "orders:update");
  const canRecord = can(actor, "orders:record_payment");
  const canVoid = can(actor, "orders:void_payment");
  const canRefund = can(actor, "orders:refund");
  const next = allowedNextStatuses(o.status, o.fulfilment).filter(
    (s) => s !== "cancelled",
  );
  const canCancel =
    can(actor, "orders:cancel") &&
    allowedNextStatuses(o.status, o.fulfilment).includes("cancelled");
  const delivery = o.fulfilment === "delivery";
  const when = (d: Date | null) =>
    d ? formatDateTime(d, business.timezone) : null;
  const money = (v: string | number) => formatMoney(v, o.currency);

  const actionButtons = (
    <>
      {canUpdate && !finished ? (
        <>
          {next.map((s) => (
            <ActionForm key={s} action={setStatusAction} className="space-y-0">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="status" value={s} />
              <SubmitButton>
                {s === "delivered"
                  ? handoverAction(o.fulfilment)
                  : (NEXT_STATUS_ACTION[s] ?? STATUS_LABEL[s])}
              </SubmitButton>
            </ActionForm>
          ))}
          {canCancel ? (
            <ActionForm action={setStatusAction} className="space-y-0">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="status" value="cancelled" />
              <ConfirmSubmit
                variant="danger"
                title="Cancel this order?"
                description={
                  o.isPaid
                    ? "The order is cancelled and the items go back in stock. It is marked as paid, so remember to return the money to the customer."
                    : "The order is cancelled and the items go back in stock. Tell the customer."
                }
                confirmLabel="Cancel order"
              >
                Cancel order
              </ConfirmSubmit>
            </ActionForm>
          ) : null}
        </>
      ) : null}
      {canRefund && o.status === "delivered" ? (
        <MarkRefundedDialog orderId={o.id} />
      ) : null}
      {canRefund && o.status === "refunded" ? (
        <ActionForm action={setStatusAction} className="space-y-0">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="status" value="delivered" />
          <ConfirmSubmit
            variant="secondary"
            title="Undo the refund?"
            description="The order goes back to delivered or collected and its items are taken out of stock again."
            confirmLabel="Undo refund"
          >
            Undo refund
          </ConfirmSubmit>
        </ActionForm>
      ) : null}
      {canRecord &&
      !o.isPaid &&
      o.status !== "cancelled" &&
      o.status !== "refunded" ? (
        <ActionForm action={setPaidAction} className="space-y-0">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="paid" value="true" />
          <SubmitButton variant="secondary">Mark as paid</SubmitButton>
        </ActionForm>
      ) : null}
    </>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/app/orders", to: "orders" }}
        title={o.reference}
        description={`Placed ${formatDateTime(o.createdAt, business.timezone)}${o.invoiceNumber ? ` · Invoice ${o.invoiceNumber}` : ""}`}
        badges={
          <>
            <OrderTag
              status={o.status}
              isPaid={o.isPaid}
              fulfilment={o.fulfilment}
            />
            {o.status === "refunded" ? null : <PaidTag paid={o.isPaid} />}
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
                : "Tell the customer it can be collected from the workshop, then press “Mark as collected” once they have it."
          }
        />
      ) : null}
      <OrderFlow order={o} timezone={business.timezone} />

      <div className="space-y-6">
        <section className="min-w-0 border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-walnut">Order details</h2>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-8 p-4">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-walnut">
                Customer details
              </h3>
              <TableWrap label="Customer details">
                <Table className="table-fixed">
                  <tbody>
                    <TR className="hover:bg-transparent">
                      <TH
                        scope="row"
                        className="w-40 border-r border-border text-left"
                      >
                        Name
                      </TH>
                      <TD className="font-medium">{o.customerName}</TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH
                        scope="row"
                        className="w-40 border-r border-border text-left"
                      >
                        ID
                      </TH>
                      <TD>CUS-{o.phoneKey}</TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH
                        scope="row"
                        className="w-40 border-r border-border text-left"
                      >
                        Mobile
                      </TH>
                      <TD>
                        <a
                          className="underline"
                          href={`tel:${o.phone.replace(/\s+/g, "")}`}
                        >
                          {plainPhone(o.phone)}
                        </a>
                      </TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH
                        scope="row"
                        className="w-40 border-r border-border text-left"
                      >
                        Email
                      </TH>
                      <TD>
                        {o.email ? (
                          <a className="underline" href={`mailto:${o.email}`}>
                            {o.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH
                        scope="row"
                        className="w-40 border-r border-border text-left"
                      >
                        {delivery ? "Delivery address" : "Collection"}
                      </TH>
                      <TD className="whitespace-pre-line">
                        {delivery
                          ? addressStacked(o.address ?? "")
                          : "The customer will collect from the workshop."}
                      </TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH
                        scope="row"
                        className="w-40 border-r border-border text-left"
                      >
                        Payment method
                      </TH>
                      <TD>{PAYMENT_LABEL[o.paymentMethod]}</TD>
                    </TR>
                  </tbody>
                </Table>
              </TableWrap>
              {o.customerNote ? (
                <p className="mt-3 border border-border px-3 py-2 text-sm">
                  <span className="font-medium">Customer’s note: </span>
                  <span className="whitespace-pre-line">{o.customerNote}</span>
                </p>
              ) : null}
            </section>

            <section className="border-t-2 border-border-strong pt-6">
              <h3 className="mb-3 text-sm font-semibold text-walnut">
                Order content
              </h3>
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
                          <div className="text-text-muted">
                            {[i.variantLabel, i.sku]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
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
                    <dt className="text-text-muted">
                      Discount{o.discountReason ? ` (${o.discountReason})` : ""}
                    </dt>
                    <dd>− {money(o.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-text-muted">
                    {delivery ? "Delivery" : "Collection"}
                  </dt>
                  <dd>
                    {!delivery
                      ? "No charge"
                      : o.deliveryChargeSet
                        ? Number(o.deliveryCharge) > 0
                          ? money(o.deliveryCharge)
                          : "No charge"
                        : "To be agreed"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{money(o.total)}</dd>
                </div>
              </dl>
            </section>

            {canUpdate && !finished && delivery ? (
              <section className="border-t-2 border-border-strong pt-6">
                <h3 className="mb-3 text-sm font-semibold text-walnut">
                  Pricing
                </h3>
                <OrderPricingForm
                  orderId={o.id}
                  currency={o.currency}
                  deliveryCharge={o.deliveryCharge}
                  deliveryChargeSet={o.deliveryChargeSet}
                />
              </section>
            ) : null}

            {livePayments.length > 0 ? (
              <section
                id="payments"
                className="scroll-mt-24 border-t-2 border-border-strong pt-6"
              >
                <h3 className="mb-3 text-sm font-semibold text-walnut">
                  Payment
                </h3>
                <TableWrap label="Payment">
                  <Table>
                    <THead>
                      <tr>
                        <TH>Receipt</TH>
                        <TH>Date</TH>
                        <TH>Method</TH>
                        <TH className="text-right">Amount</TH>
                        <TH>
                          <span className="sr-only">Actions</span>
                        </TH>
                      </tr>
                    </THead>
                    <tbody>
                      {livePayments.map((p) => (
                        <TR key={p.id}>
                          <TD className="whitespace-nowrap">{p.number}</TD>
                          <TD className="whitespace-nowrap">
                            {formatDate(p.paidAt, business.timezone)}
                          </TD>
                          <TD>{METHOD_LABEL[p.method]}</TD>
                          <TD numeric>{money(p.amount)}</TD>
                          <TD className="whitespace-nowrap text-right">
                            {canVoid ? (
                              <VoidPaymentDialog
                                orderId={o.id}
                                paymentId={p.id}
                                number={p.number}
                              />
                            ) : null}
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </section>
            ) : null}

            <section className="border-t-2 border-border-strong pt-5">
              <h3 className="mb-3 text-sm font-semibold text-walnut">
                History
              </h3>
              <ul className="flex flex-col gap-2 border-l-2 border-border-strong pl-4 text-sm">
                <li>Placed {when(o.createdAt)}</li>
                {o.confirmedAt ? (
                  <li>Confirmed {when(o.confirmedAt)}</li>
                ) : null}
                {o.readyAt ? <li>Ready {when(o.readyAt)}</li> : null}
                {o.scheduledFor ? (
                  <li>
                    {delivery ? "Planned delivery" : "Planned collection"}:{" "}
                    {formatDate(o.scheduledFor, "UTC")}
                  </li>
                ) : null}
                {o.deliveredAt ? (
                  <li>
                    {delivery ? "Delivered" : "Collected"} {when(o.deliveredAt)}
                  </li>
                ) : null}
                {o.paidAt ? <li>Paid {when(o.paidAt)}</li> : null}
                {o.refundedAt ? (
                  <li>
                    Refunded {when(o.refundedAt)}
                    {o.refundReason ? ` · ${o.refundReason}` : ""}
                  </li>
                ) : null}
                {o.cancelledAt ? (
                  <li>Cancelled {when(o.cancelledAt)}</li>
                ) : null}
              </ul>
            </section>
          </div>
        </section>
      </div>
    </>
  );
}
