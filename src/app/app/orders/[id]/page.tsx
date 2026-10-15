import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/print-button";
import { ActionForm, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { NEXT_STATUS_ACTION, ORDER_STATUS_TONE } from "@/lib/order-ui";
import { FULFILMENT_LABEL, PAYMENT_LABEL, STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { allowedNextStatuses, getOrder } from "@/server/orders";
import { setPaidAction, setStatusAction, updateDetailsAction } from "../actions";

export const metadata = { title: "Order" };

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
  const finished = o.status === "delivered" || o.status === "cancelled";
  const canUpdate = can(actor, "orders:update");
  const next = allowedNextStatuses(o.status, o.fulfilment).filter((s) => s !== "cancelled");
  const canCancel = can(actor, "orders:cancel") && allowedNextStatuses(o.status, o.fulfilment).includes("cancelled");
  const when = (d: Date | null) => (d ? formatDateTime(d, business.timezone) : null);
  const customerKey = o.phoneKey;

  return (
    <>
      <PageHeader
        title={o.reference}
        description={`Placed ${formatDateTime(o.createdAt, business.timezone)}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</StatusBadge>
            {o.isPaid ? <StatusBadge tone="success">Paid</StatusBadge> : <StatusBadge tone="warning">Not paid yet</StatusBadge>}
            <PrintButton />
          </div>
        }
      />
      {o.status === "new" ? (
        <Alert tone="info" title="New order" className="mb-6">
          Call or message the customer to confirm the order, agree the delivery charge and time, then press “Confirm order”.
        </Alert>
      ) : null}
      {o.status === "ready" ? (
        <Alert tone="info" title={o.fulfilment === "delivery" ? "Ready for delivery" : "Ready to collect"} className="mb-6">
          {o.fulfilment === "delivery" ? "Send it out when the day is agreed, then press “Send out for delivery”." : "Tell the customer it can be collected from the showroom, then press “Mark as completed” once they have it."}
        </Alert>
      ) : null}
      {o.status === "cancelled" ? (
        <Alert tone="danger" title="Cancelled" className="mb-6">
          {o.cancelReason}
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel title="Items">
            <TableWrap label="Items in this order">
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
                      </TD>
                      <TD numeric>{formatMoney(i.unitPrice, o.currency)}</TD>
                      <TD numeric>{i.quantity}</TD>
                      <TD numeric>{formatMoney(i.lineTotal, o.currency)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Items</dt>
                <dd>{formatMoney(o.subtotal, o.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Delivery</dt>
                <dd>{Number(o.deliveryCharge) > 0 ? formatMoney(o.deliveryCharge, o.currency) : "To be agreed"}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total to pay</dt>
                <dd>{formatMoney(o.total, o.currency)}</dd>
              </div>
            </dl>
          </Panel>

          {canUpdate && !finished ? (
            <Panel title="Delivery, date and notes" description="Agree the delivery charge and the day with the customer and enter them here; the total updates. The note is only for staff.">
              <ActionForm action={updateDetailsAction}>
                <input type="hidden" name="id" value={o.id} />
                <div className="grid gap-5 md:grid-cols-2">
                  <FField name="deliveryCharge" label={`Delivery charge (${o.currency})`} inputMode="decimal" defaultValue={Number(o.deliveryCharge) > 0 ? o.deliveryCharge : ""} />
                  <FField name="scheduledFor" type="date" label={o.fulfilment === "delivery" ? "Delivery date" : "Collection date"} defaultValue={o.scheduledFor ?? ""} />
                </div>
                <FTextArea name="staffNote" label="Staff note" rows={3} defaultValue={o.staffNote ?? ""} />
                <SubmitButton>Save</SubmitButton>
              </ActionForm>
            </Panel>
          ) : o.staffNote ? (
            <Panel title="Staff note">
              <p className="whitespace-pre-line text-sm">{o.staffNote}</p>
            </Panel>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Customer">
            <p className="font-medium">{o.customerName}</p>
            <p className="mt-1 text-sm">
              <a className="underline" href={`tel:${o.phone.replace(/\s+/g, "")}`}>
                {o.phone}
              </a>
            </p>
            {o.email ? (
              <p className="text-sm">
                <a className="underline" href={`mailto:${o.email}`}>
                  {o.email}
                </a>
              </p>
            ) : null}
            <p className="mt-3 text-sm">
              <Link className="underline" href={`/app/customers/${customerKey}`}>
                All orders from this customer
              </Link>
            </p>
            <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
              <div>
                <dt className="text-text-muted">{FULFILMENT_LABEL[o.fulfilment]}</dt>
                <dd className="whitespace-pre-line font-medium">{o.fulfilment === "delivery" ? o.address : "The customer will collect from the showroom."}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Customer plans to pay</dt>
                <dd className="font-medium">{PAYMENT_LABEL[o.paymentMethod]}</dd>
              </div>
              {o.customerNote ? (
                <div>
                  <dt className="text-text-muted">Customer’s note</dt>
                  <dd className="whitespace-pre-line">{o.customerNote}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          {canUpdate && !finished ? (
            <Panel title="Move this order on">
              <div className="space-y-3">
                {next.map((s) => (
                  <ActionForm key={s} action={setStatusAction} className="space-y-0">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value={s} />
                    <SubmitButton>{NEXT_STATUS_ACTION[s] ?? STATUS_LABEL[s]}</SubmitButton>
                  </ActionForm>
                ))}
                {canCancel ? (
                  <ActionForm action={setStatusAction} className="space-y-3 border-t border-border pt-4">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <FField name="reason" label="Reason for cancelling" required />
                    <ConfirmSubmit variant="danger" title="Cancel this order?" description="The order is cancelled and cannot be reopened. Tell the customer." confirmLabel="Cancel order">
                      Cancel order
                    </ConfirmSubmit>
                  </ActionForm>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {can(actor, "orders:record_payment") && o.status !== "cancelled" ? (
            <Panel title="Payment" description="Customers pay offline: on delivery, by bank transfer, or at the showroom. Record it here once the money has been received.">
              {o.isPaid ? <p className="mb-3 text-sm text-text-muted">Marked as paid {when(o.paidAt)}.</p> : null}
              <ActionForm action={setPaidAction} className="space-y-0">
                <input type="hidden" name="id" value={o.id} />
                {o.isPaid ? null : <input type="hidden" name="paid" value="true" />}
                <SubmitButton variant={o.isPaid ? "secondary" : "primary"}>{o.isPaid ? "Mark as not paid" : "Mark as paid"}</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          <Panel title="History">
            <ul className="space-y-1.5 text-sm">
              <li>Placed {when(o.createdAt)}</li>
              {o.confirmedAt ? <li>Confirmed {when(o.confirmedAt)}</li> : null}
              {o.readyAt ? <li>Ready {when(o.readyAt)}</li> : null}
              {o.outForDeliveryAt ? <li>Sent out for delivery {when(o.outForDeliveryAt)}</li> : null}
              {o.scheduledFor ? <li>{o.fulfilment === "delivery" ? "Planned delivery" : "Planned collection"}: {formatDate(o.scheduledFor, "UTC")}</li> : null}
              {o.deliveredAt ? <li>{o.fulfilment === "delivery" ? "Delivered" : "Collected"} {when(o.deliveredAt)}</li> : null}
              {o.cancelledAt ? <li>Cancelled {when(o.cancelledAt)}</li> : null}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
