import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/app/customer-form";
import { ActivityPanel, FollowUpPanel } from "@/components/app/crm-panels";
import { ActionForm } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE } from "@/lib/crm";
import { isAppError } from "@/lib/errors";
import { QUOTATION_STATUS_LABEL } from "@/lib/schemas/quotation";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listActivities, listFollowUpsFor } from "@/server/crm";
import { getCustomer } from "@/server/customers";
import { listAssignableStaff } from "@/server/leads";
import { archiveCustomerAction, updateCustomerAction } from "../actions";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let data;
  try {
    data = await getCustomer(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const canCrm = can(actor, "leads:view");
  const [business, activities, tasks, staff] = await Promise.all([
    getBusinessSettings(),
    canCrm ? listActivities(actor, { customerId: id }) : Promise.resolve([]),
    can(actor, "followups:manage") ? listFollowUpsFor(actor, { customerId: id }) : Promise.resolve([]),
    canCrm ? listAssignableStaff(actor) : Promise.resolve([]),
  ]);
  const { customer } = data;
  const canWrite = can(actor, "customers:write");

  return (
    <>
      <PageHeader
        title={customer.name}
        description={customer.company ?? undefined}
        actions={can(actor, "quotations:write") && !customer.archivedAt ? <ButtonLink href={`/app/quotations/new?customerId=${customer.id}`}>New quotation</ButtonLink> : undefined}
      />
      {customer.archivedAt ? <Alert tone="warning" title="Archived" className="mb-6">This customer is hidden from lists but all history is kept.</Alert> : null}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="Details">
            {canWrite ? (
              <CustomerForm action={updateCustomerAction} submitLabel="Save changes" values={{ ...customer }} />
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-text-muted">Phone</dt><dd className="font-medium">{customer.phone}</dd></div>
                <div><dt className="text-text-muted">Email</dt><dd className="font-medium">{customer.email ?? "—"}</dd></div>
              </dl>
            )}
          </Panel>
          {canCrm ? <ActivityPanel subject={{ customerId: id }} activities={activities} timezone={business.timezone} canWrite={canWrite || can(actor, "leads:write")} /> : null}
        </div>
        <div className="min-w-0 space-y-6">
          <Panel title="Enquiries">
            {data.leads.length === 0 ? (
              <p className="text-sm text-text-muted">None yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    {canCrm ? <Link className="underline" href={`/app/leads/${l.id}`}>{l.reference}</Link> : l.reference}
                    <StatusBadge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {can(actor, "quotations:view") ? (
            <Panel title="Quotations">
              {data.quotations.length === 0 ? (
                <p className="text-sm text-text-muted">None yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.quotations.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-2">
                      <Link className="underline" href={`/app/quotations/${q.id}`}>{q.reference}</Link>
                      <span className="text-text-muted">{QUOTATION_STATUS_LABEL[q.status]} · {formatDate(q.createdAt, business.timezone)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
          {can(actor, "followups:manage") ? <FollowUpPanel subject={{ customerId: id }} tasks={tasks} staff={staff} timezone={business.timezone} currentUserId={actor.id} canWrite /> : null}
          {canWrite ? (
            <Panel title={customer.archivedAt ? "Restore customer" : "Archive customer"}>
              <ActionForm action={archiveCustomerAction}>
                <input type="hidden" name="id" value={customer.id} />
                <input type="hidden" name="archive" value={customer.archivedAt ? "false" : "true"} />
                <ConfirmSubmit title={customer.archivedAt ? "Restore this customer?" : "Archive this customer?"} description={customer.archivedAt ? "They will appear in lists again." : "They are hidden from lists. Quotations and history are kept."} confirmLabel={customer.archivedAt ? "Restore" : "Archive"} destructive={!customer.archivedAt}>
                  {customer.archivedAt ? "Restore customer" : "Archive customer"}
                </ConfirmSubmit>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
