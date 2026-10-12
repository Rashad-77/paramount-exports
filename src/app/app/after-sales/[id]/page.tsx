import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { CASE_TONE } from "@/lib/ops-ui";
import { CASE_STATUS_LABEL, CASE_TYPE_LABEL } from "@/lib/schemas/operations";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { CASE_FLOW, getCase } from "@/server/aftersales";
import { listDeliveryStaff } from "@/server/deliveries";
import { caseNoteAction, caseStatusAction, updateCaseAction } from "../actions";

export const metadata = { title: "After-sales case" };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let d;
  try {
    d = await getCase(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const tz = (await getBusinessSettings()).timezone;
  const c = d.case;
  const manage = can(actor, "aftersales:manage") && c.status !== "closed";
  const next = CASE_FLOW[c.status];
  const staff = manage ? await listDeliveryStaff(actor).catch(() => []) : [];
  return (
    <>
      <PageHeader title={`${c.reference} · ${c.subject}`} description={`${CASE_TYPE_LABEL[c.type]} for ${d.customerName}${d.orderReference ? ` · order ${d.orderReference}` : ""}`} actions={can(actor, "customers:view") ? <Link className="inline-flex min-h-10 items-center underline" href={`/app/customers/${c.customerId}`}>Open customer</Link> : undefined} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={CASE_TONE[c.status]}>{CASE_STATUS_LABEL[c.status]}</StatusBadge>
        <span className="text-sm text-text-muted">{d.assigneeName ? `Assigned to ${d.assigneeName}` : "Not assigned"}{c.dueOn ? ` · resolve by ${formatDate(c.dueOn, tz)}` : ""}</span>
      </div>
      {c.resolution ? <Alert tone="success" title="Resolution" className="mb-6"><span className="whitespace-pre-line">{c.resolution}</span></Alert> : null}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {c.description ? <Panel title="Details"><p className="whitespace-pre-line text-sm">{c.description}</p></Panel> : null}
          {manage && next.length > 0 ? (
            <Panel title="Change status" description="Resolving or closing needs a written resolution.">
              <ActionForm action={caseStatusAction}>
                <input type="hidden" name="id" value={c.id} />
                <FSelect name="to" label="Move to" required placeholder="Choose a status" options={next.map((s) => ({ value: s, label: CASE_STATUS_LABEL[s] }))} />
                <FTextArea name="resolution" label="Resolution" rows={3} defaultValue={c.resolution ?? ""} hint="What was done for the customer. Required to resolve or close." />
                <FField name="note" label="Note" />
                <SubmitButton variant="secondary">Update status</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
          <Panel title="History">
            {manage ? (
              <ActionForm action={caseNoteAction} className="mb-6 border-b border-border pb-6">
                <input type="hidden" name="id" value={c.id} />
                <FTextArea name="body" label="Add a note" rows={2} required />
                <SubmitButton variant="secondary">Add note</SubmitButton>
              </ActionForm>
            ) : null}
            <ol className="space-y-4 text-sm">
              {d.notes.map((n) => (
                <li key={n.id}>
                  <p className="font-medium">{n.to ? `${n.from ? `${CASE_STATUS_LABEL[n.from]} → ` : ""}${CASE_STATUS_LABEL[n.to]}` : "Note"}</p>
                  <p className="text-text-muted">{formatDateTime(n.at, tz)} · {n.byName ?? "System"}</p>
                  {n.body ? <p className="mt-0.5 whitespace-pre-line">{n.body}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="min-w-0">
          {manage ? (
            <Panel title="Case details">
              <ActionForm action={updateCaseAction}>
                <input type="hidden" name="id" value={c.id} />
                <FField name="subject" label="Subject" required defaultValue={c.subject} />
                <FTextArea name="description" label="Details" rows={3} defaultValue={c.description ?? ""} />
                <FSelect name="assigneeId" label="Assigned to" defaultValue={c.assigneeId ?? ""} placeholder="Not assigned" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
                <FField name="dueOn" label="Resolve by" type="date" defaultValue={c.dueOn ?? ""} />
                <SubmitButton variant="secondary">Save</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
