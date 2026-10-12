import { MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityPanel, FollowUpPanel } from "@/components/app/crm-panels";
import { ActionForm, DuplicateConfirm, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { whatsappLink } from "@/lib/contact";
import { LEAD_KIND_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_STATUS_TONE } from "@/lib/crm";
import { isAppError } from "@/lib/errors";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { listActivities, listFollowUpsFor } from "@/server/crm";
import { getLead, listAssignableStaff } from "@/server/leads";
import { assignLeadAction, changeLeadStatusAction } from "../actions";
import { attachLeadFilesAction, createCustomerFromLeadAction, linkCustomerAction } from "../crm-actions";

export const metadata = { title: "Enquiry" };

const CONTACT_LABEL = { phone: "Phone call", whatsapp: "WhatsApp", email: "Email" } as const;

const PAYLOAD_LABEL: Record<string, string> = {
  furnitureType: "Furniture type",
  dimensions: "Dimensions",
  material: "Wood / material",
  finish: "Finish",
  budgetRange: "Budget range",
  targetDate: "Wanted by",
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let data;
  try {
    data = await getLead(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [business, staff, activities, tasks] = await Promise.all([
    getBusinessSettings(),
    listAssignableStaff(actor),
    listActivities(actor, { leadId: id }),
    can(actor, "followups:manage") ? listFollowUpsFor(actor, { leadId: id }) : Promise.resolve([]),
  ]);
  const { lead } = data;
  const canWrite = can(actor, "leads:write");
  const payload = (lead.payload ?? {}) as Record<string, string | null>;
  const payloadRows = Object.entries(PAYLOAD_LABEL).filter(([k]) => payload[k]);

  return (
    <>
      <PageHeader
        title={`${lead.reference} · ${lead.contactName}`}
        description={`${LEAD_KIND_LABEL[lead.kind] ?? lead.kind} from ${LEAD_SOURCE_LABEL[lead.source]}, received ${formatDateTime(lead.createdAt, business.timezone)}`}
        actions={
          <>
            {lead.customerId && can(actor, "quotations:write") ? <ButtonLink href={`/app/quotations/new?customerId=${lead.customerId}&leadId=${lead.id}`}>New quotation</ButtonLink> : null}
            <ButtonLink href={`tel:${lead.contactPhone.replace(/\s+/g, "")}`} variant="secondary">
              <Phone aria-hidden="true" className="size-4" /> Call
            </ButtonLink>
            <ButtonLink href={whatsappLink(lead.contactPhone, business.phoneCountryCode)} variant="secondary" target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" className="size-4" /> Open WhatsApp
              <span className="sr-only"> (opens in a new tab; messages are sent by you, not automatically)</span>
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</StatusBadge>
        {lead.status === "lost" && lead.lostReason ? <span className="text-sm text-text-muted">Reason: {lead.lostReason}</span> : null}
      </div>

      {data.possibleDuplicate ? (
        <Alert tone="warning" title="This contact may already be a customer" className="mb-6">
          {data.possibleDuplicate.name} ({data.possibleDuplicate.phone}
          {data.possibleDuplicate.email ? `, ${data.possibleDuplicate.email}` : ""}) has the same phone number or email. Nothing has been merged; choose what to do in the Customer panel.
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title="Contact">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Row k="Name" v={lead.contactName} />
              <Row k="Phone" v={lead.contactPhone} />
              <Row k="Email" v={lead.contactEmail ?? "—"} />
              <Row k="Preferred contact" v={lead.preferredContact ? CONTACT_LABEL[lead.preferredContact] : "No preference"} />
            </dl>
          </Panel>

          <Panel title="Request">
            {data.productName ? (
              <p className="mb-4 text-sm">
                About product:{" "}
                <Link className="underline" href={`/app/products?q=${encodeURIComponent(data.productName)}`}>
                  {data.productName}
                </Link>
              </p>
            ) : null}
            {lead.message ? <p className="whitespace-pre-line text-sm">{lead.message}</p> : <p className="text-sm text-text-muted">No message.</p>}
            {payloadRows.length > 0 ? (
              <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
                {payloadRows.map(([k, label]) => (
                  <Row key={k} k={label} v={k === "targetDate" ? formatDate(payload[k]!, business.timezone) : payload[k]!} />
                ))}
              </dl>
            ) : null}
          </Panel>

          {can(actor, "files:view_customer_private") ? (
            <Panel title="Attached files" description="Opened through a short-lived secure link.">
              {data.files.length === 0 ? (
                <p className="text-sm text-text-muted">No files attached.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {data.files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate">{f.name}</span>
                      <a className="shrink-0 underline" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer">
                        Open<span className="sr-only"> {f.name} (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
          {can(actor, "files:view_customer_private") && canWrite ? (
            <Panel title="Add files">
              <ActionForm action={attachLeadFilesAction}>
                <input type="hidden" name="leadId" value={lead.id} />
                <FileUploader purpose="lead_attachment" label="Photos, sketches or PDFs" accept="image/jpeg,image/png,image/webp,application/pdf" hint="Up to 10 MB each, up to 5 at a time." />
                <SubmitButton>Attach files</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
          <ActivityPanel subject={{ leadId: lead.id }} activities={activities} timezone={business.timezone} canWrite={canWrite} />
        </div>

        <div className="min-w-0 space-y-6">
          {can(actor, "followups:manage") ? <FollowUpPanel subject={{ leadId: lead.id }} tasks={tasks} staff={staff} timezone={business.timezone} currentUserId={actor.id} canWrite /> : null}
          <Panel title="Customer">
            {lead.customerId ? (
              <p className="text-sm">
                Linked to{" "}
                <Link className="font-medium underline" href={`/app/customers/${lead.customerId}`}>
                  the customer record
                </Link>
                .
              </p>
            ) : can(actor, "customers:write") && canWrite ? (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">This enquiry is not linked to a customer yet. Public enquiries never create customers automatically.</p>
                {data.possibleDuplicate ? (
                  <ActionForm action={linkCustomerAction}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="customerId" value={data.possibleDuplicate.id} />
                    <SubmitButton variant="secondary">Link to {data.possibleDuplicate.name}</SubmitButton>
                  </ActionForm>
                ) : null}
                <ActionForm action={createCustomerFromLeadAction}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <DuplicateConfirm label="Create a new customer anyway" />
                  <SubmitButton variant={data.possibleDuplicate ? "ghost" : "primary"}>Create customer from this enquiry</SubmitButton>
                </ActionForm>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Not linked to a customer.</p>
            )}
          </Panel>
          {can(actor, "leads:assign") ? (
            <Panel title="Assigned to">
              <ActionForm action={assignLeadAction}>
                <input type="hidden" name="id" value={lead.id} />
                <FSelect name="assigneeId" showOptional={false} label="Team member" defaultValue={lead.assignedTo ?? ""} placeholder="Unassigned" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
                <SubmitButton>Save assignment</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
          {can(actor, "leads:write") ? (
            <Panel title="Status">
              <ActionForm action={changeLeadStatusAction}>
                <input type="hidden" name="id" value={lead.id} />
                <FSelect name="status" required label="Pipeline status" defaultValue={lead.status} options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))} />
                <FTextArea name="lostReason" label="Reason (needed when lost)" rows={2} defaultValue={lead.lostReason ?? ""} />
                <SubmitButton>Update status</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-text-muted">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}
