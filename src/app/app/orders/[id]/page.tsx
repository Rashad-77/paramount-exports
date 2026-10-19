import { OrderTag, PaidTag } from "@/components/app/tags";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/print-button";
import {
  ActionForm,
  FField,
  SubmitButton,
} from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { ToastOnMount } from "@/components/ui/toaster";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { NEXT_STATUS_ACTION } from "@/lib/order-ui";
import {
  PAYMENT_LABEL,
  STATUS_LABEL,
} from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { allowedNextStatuses, getOrder } from "@/server/orders";
import {
  setPaidAction,
  setStatusAction,
  updateDetailsAction,
} from "../actions";

export const metadata = { title: "Order" };

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
  const finished = o.status === "delivered" || o.status === "cancelled";
  const canUpdate = can(actor, "orders:update");
  const next = allowedNextStatuses(o.status, o.fulfilment).filter(
    (s) => s !== "cancelled",
  );
  const canCancel =
    can(actor, "orders:cancel") &&
    allowedNextStatuses(o.status, o.fulfilment).includes("cancelled");
  const showManagement =
    (canUpdate && !finished) ||
    (can(actor, "orders:record_payment") && o.status !== "cancelled");
  const when = (d: Date | null) =>
    d ? formatDateTime(d, business.timezone) : null;

  return (
    <>
      <PageHeader back={{ href: "/app/orders", to: "orders" }}
        title={o.reference}
        description={`Placed ${formatDateTime(o.createdAt, business.timezone)}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <OrderTag status={o.status} isPaid={o.isPaid} fulfilment={o.fulfilment} />
            {o.isPaid ? (
              <PaidTag paid />
            ) : (
              <StatusBadge tone="warning">Not paid yet</StatusBadge>
            )}
            <PrintButton />
          </div>
        }
      />
      {o.status === "ready" ? (
        <ToastOnMount
          tone="info"
          title={
            o.fulfilment === "delivery"
              ? "Ready for delivery"
              : "Ready to collect"
          }
          message={o.fulfilment === "delivery"
            ? "Send it out when the day is agreed, then press “Send out for delivery”."
            : "Tell the customer it can be collected from the showroom, then press “Mark as completed” once they have it."}
        />
      ) : null}
      {o.status === "cancelled" ? (
        <ToastOnMount tone="danger" title="Cancelled" message={o.cancelReason || "This order has been cancelled."} />
      ) : null}

      <section className="min-w-0 border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-walnut">Order details</h2>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-8 p-4">
          <section className="order-2">
              <h3 className="mb-3 text-sm font-semibold text-walnut">Order content</h3>
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
                            {[i.variantLabel, i.sku].filter(Boolean).join(" · ")}
                          </div>
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
                  <dd>
                    {Number(o.deliveryCharge) > 0
                      ? formatMoney(o.deliveryCharge, o.currency)
                      : "To be agreed"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatMoney(o.total, o.currency)}</dd>
                </div>
              </dl>
          </section>

          <div className="contents">
            <div className="order-1 min-w-0 border-b-2 border-border-strong pb-5">
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
                      <TH scope="row" className="w-40 border-r border-border text-left">Address</TH>
                      <TD className="whitespace-pre-line">
                        {o.fulfilment === "delivery" ? o.address : "The customer will collect from the showroom."}
                      </TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TH scope="row" className="w-40 border-r border-border text-left">Payment method</TH>
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
            </div>

          {showManagement ? (
          <div className="order-3 min-w-0 w-full space-y-6 border-t-2 border-border-strong pt-6">
            {canUpdate && !finished ? (
              <section className="ml-auto w-fit max-w-full">
                <h3 className="mb-2 text-left text-xs font-semibold text-walnut">Delivery charge</h3>
                <ActionForm action={updateDetailsAction} className="flex w-fit max-w-full flex-wrap items-end justify-start gap-2 !space-y-0">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="scheduledFor" value={o.scheduledFor ?? ""} />
                  <input type="hidden" name="staffNote" value={o.staffNote ?? ""} />
                  <div className="w-40 [&_input]:min-h-8 [&_input]:px-2 [&_input]:py-1 [&_input]:text-xs">
                    <FField name="deliveryCharge" label="" aria-label={`Delivery charge (${o.currency})`} className="[&>label]:hidden" inputMode="decimal" defaultValue={Number(o.deliveryCharge) > 0 ? o.deliveryCharge : ""} />
                  </div>
                  <SubmitButton size="md" className="min-h-8 px-3 text-xs">Save</SubmitButton>
                </ActionForm>
              </section>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-border-strong pt-5">
                {canUpdate && !finished ? (
                  <>
                  {next.map((s) => (
                    <ActionForm key={s} action={setStatusAction} className="space-y-0">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="status" value={s} />
                      <SubmitButton>{NEXT_STATUS_ACTION[s] ?? STATUS_LABEL[s]}</SubmitButton>
                    </ActionForm>
                  ))}
                  {canCancel ? (
                    <ActionForm action={setStatusAction} className="space-y-0">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <ConfirmSubmit variant="danger" title="Cancel this order?" description="The order is cancelled and cannot be reopened. Tell the customer." confirmLabel="Cancel order">
                        Cancel order
                      </ConfirmSubmit>
                    </ActionForm>
                  ) : null}
                  </>
                ) : null}

            {can(actor, "orders:record_payment") && o.status !== "cancelled" ? (
              <div>
                <ActionForm action={setPaidAction} className="space-y-0">
                  <input type="hidden" name="id" value={o.id} />
                  {o.isPaid ? null : <input type="hidden" name="paid" value="true" />}
                  <SubmitButton variant={o.isPaid ? "secondary" : "primary"}>
                    {o.isPaid ? "Mark as not paid" : "Mark as paid"}
                  </SubmitButton>
                </ActionForm>
              </div>
            ) : null}
            </div>
          </div>
          ) : null}
            <section className="order-4 min-w-0 border-t-2 border-border-strong pt-5">
              <h3 className="mb-3 text-sm font-semibold text-walnut">History</h3>
              <ul className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <li>Placed {when(o.createdAt)}</li>
                {o.confirmedAt ? <li>Confirmed {when(o.confirmedAt)}</li> : null}
                {o.readyAt ? <li>Ready {when(o.readyAt)}</li> : null}
                {o.outForDeliveryAt ? <li>Sent out for delivery {when(o.outForDeliveryAt)}</li> : null}
                {o.scheduledFor ? (
                  <li>{o.fulfilment === "delivery" ? "Planned delivery" : "Planned collection"}: {formatDate(o.scheduledFor, "UTC")}</li>
                ) : null}
                {o.deliveredAt ? <li>{o.fulfilment === "delivery" ? "Delivered" : "Collected"} {when(o.deliveredAt)}</li> : null}
                {o.cancelledAt ? <li>Cancelled {when(o.cancelledAt)}</li> : null}
              </ul>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
