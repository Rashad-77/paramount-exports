import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliveryForm } from "@/components/app/delivery-form";
import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { FileUploader } from "@/components/forms/file-uploader";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { DELIVERY_TONE, hhmm, windowLabel } from "@/lib/ops-ui";
import { DELIVERY_STATUS_LABEL } from "@/lib/schemas/operations";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getDelivery, listDeliveryStaff } from "@/server/deliveries";
import { deliveryStatusAction, rescheduleDeliveryAction, updateDeliveryAction } from "../actions";

export const metadata = { title: "Delivery" };

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let d;
  try {
    d = await getDelivery(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const tz = business.timezone;
  const { delivery: x } = d;
  const canUpdate = can(actor, "deliveries:update_status");
  const manage = d.canSchedule;
  const open = x.status === "planned" || x.status === "out_for_delivery";
  const staff = manage ? await listDeliveryStaff(actor) : [];

  return (
    <>
      <PageHeader
        title={`${x.reference} · ${x.contactName}`}
        description={`${formatDate(x.scheduledOn, tz)} · ${windowLabel(x.windowStart, x.windowEnd)}`}
        actions={can(actor, "orders:view") ? <Link className="inline-flex min-h-10 items-center underline" href={`/app/orders/${d.order.id}`}>Open order {d.order.reference}</Link> : undefined}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={DELIVERY_TONE[x.status]}>{DELIVERY_STATUS_LABEL[x.status]}</StatusBadge>
        <span className="text-sm text-text-muted">{d.assigneeName ? `Delivered by ${d.assigneeName}` : "Not assigned"}</span>
        {x.rescheduledFromId ? <span className="text-sm text-text-muted">Rescheduled after a failed attempt</span> : null}
      </div>
      {x.status === "failed" ? <Alert tone="danger" title="This attempt failed" className="mb-6">{x.failedReason}</Alert> : null}
      {x.status === "delivered" ? <Alert tone="success" title={`Delivered ${x.deliveredAt ? formatDateTime(x.deliveredAt, tz) : ""}`} className="mb-6">{x.proofNote ?? "Proof photo attached."}</Alert> : null}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {canUpdate && open ? (
            <Panel title="Update status" description="Use large buttons on your phone at the customer's door.">
              {x.status === "planned" ? (
                <ActionForm action={deliveryStatusAction} className="mb-6">
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="to" value="out_for_delivery" />
                  <SubmitButton size="lg" pendingLabel="Updating…">Start delivery — out for delivery</SubmitButton>
                </ActionForm>
              ) : null}
              <ActionForm action={deliveryStatusAction} className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Delivered</h3>
                <input type="hidden" name="id" value={x.id} />
                <input type="hidden" name="to" value="delivered" />
                <FTextArea name="note" label="Proof note" showOptional={false} rows={2} hint="Who received it, and anything worth recording. A note or a photo is required." />
                <FileUploader name="proofFileIds" purpose="delivery_proof" label="Photo of the delivered item (optional if you wrote a note)" maxFiles={3} />
                <ConfirmSubmit title="Mark as delivered?" description="The order becomes delivered and its stock is deducted. This cannot be undone." confirmLabel="Mark delivered" destructive={false} variant="primary">Mark delivered</ConfirmSubmit>
              </ActionForm>
              <ActionForm action={deliveryStatusAction} className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Could not deliver</h3>
                <input type="hidden" name="id" value={x.id} />
                <input type="hidden" name="to" value="failed" />
                <FField name="note" label="Why?" required hint="e.g. nobody home, address not found, damaged in transit" />
                <SubmitButton variant="secondary">Mark failed</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          {manage && x.status === "planned" ? (
            <Panel title="Edit delivery">
              <DeliveryForm
                action={updateDeliveryAction}
                hidden={{ id: x.id }}
                staff={staff}
                currency={business.currency}
                submitLabel="Save changes"
                initial={{ scheduledOn: x.scheduledOn, windowStart: hhmm(x.windowStart) ?? "", windowEnd: hhmm(x.windowEnd) ?? "", addressLine: x.addressLine, contactName: x.contactName, contactPhone: x.contactPhone, fee: x.fee, assigneeId: x.assigneeId ?? "", notes: x.notes ?? "" }}
              />
            </Panel>
          ) : (
            <Panel title="Details">
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div><dt className="text-text-muted">Address</dt><dd className="whitespace-pre-line font-medium">{x.addressLine}</dd></div>
                <div><dt className="text-text-muted">Contact</dt><dd className="font-medium">{x.contactName} · <a className="underline" href={`tel:${x.contactPhone}`}>{x.contactPhone}</a></dd></div>
                <div><dt className="text-text-muted">Delivery fee (reference)</dt><dd className="tabular font-medium">{formatMoney(x.fee, business.currency)}</dd></div>
                {x.notes ? <div><dt className="text-text-muted">Notes</dt><dd className="whitespace-pre-line">{x.notes}</dd></div> : null}
                {d.proof ? <div><dt className="text-text-muted">Proof photo</dt><dd><a className="underline" href={`/api/files/${d.proof.id}`} target="_blank" rel="noopener noreferrer">Open photo<span className="sr-only"> (opens in a new tab)</span></a></dd></div> : null}
              </dl>
            </Panel>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          {manage && x.status === "failed" ? (
            <Panel title="Reschedule" description="Creates a new delivery for the same order. The failed attempt stays on record.">
              <ActionForm action={rescheduleDeliveryAction}>
                <input type="hidden" name="id" value={x.id} />
                <FField name="scheduledOn" label="New date" type="date" required />
                <div className="grid grid-cols-2 gap-3">
                  <FField name="windowStart" label="From" type="time" />
                  <FField name="windowEnd" label="To" type="time" />
                </div>
                <FSelect name="assigneeId" label="Delivered by" defaultValue={x.assigneeId ?? ""} placeholder="Keep the same" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
                <SubmitButton>Reschedule</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
          <Panel title="History">
            <ol className="space-y-3 text-sm">
              {d.events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium">{e.from ? `${DELIVERY_STATUS_LABEL[e.from]} → ` : ""}{DELIVERY_STATUS_LABEL[e.to]}</p>
                  <p className="text-text-muted">{formatDateTime(e.at, tz)} · {e.byName ?? "System"}</p>
                  {e.note ? <p className="mt-0.5 whitespace-pre-line">{e.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
