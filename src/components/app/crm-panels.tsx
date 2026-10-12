import { Check } from "lucide-react";
import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { completeFollowUpAction, addActivityAction, createFollowUpAction } from "@/app/app/leads/crm-actions";
import { ACTIVITY_LABEL, ACTIVITY_TYPES } from "@/lib/schemas/crm";
import { formatDate, formatDateTime } from "@/lib/time";

export interface Subject {
  leadId?: string;
  customerId?: string;
}

export function ActivityPanel({
  subject,
  activities,
  timezone,
  canWrite,
}: {
  subject: Subject;
  activities: Array<{ id: string; type: string; body: string; occurredAt: Date; byName: string | null }>;
  timezone: string;
  canWrite: boolean;
}) {
  return (
    <Panel title="Activity" description="Calls, meetings, visits, messages and notes. WhatsApp messages are sent by you from WhatsApp; record them here.">
      {canWrite ? (
        <ActionForm action={addActivityAction} className="mb-6 space-y-3 border-b border-border pb-6">
          {subject.leadId ? <input type="hidden" name="leadId" value={subject.leadId} /> : null}
          {subject.customerId ? <input type="hidden" name="customerId" value={subject.customerId} /> : null}
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <FSelect name="type" label="What happened" required defaultValue="note" options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABEL[t]! }))} />
            <FTextArea name="body" label="Details" required rows={2} />
          </div>
          <SubmitButton>Record activity</SubmitButton>
        </ActionForm>
      ) : null}
      {activities.length === 0 ? (
        <p className="text-sm text-text-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="space-y-4">
          {activities.map((a) => (
            <li key={a.id} className="grid grid-cols-[7.5rem_1fr] gap-3 text-sm">
              <div>
                <StatusBadge tone={a.type === "status_change" ? "info" : "neutral"}>{ACTIVITY_LABEL[a.type] ?? a.type}</StatusBadge>
              </div>
              <div>
                <p className="whitespace-pre-line">{a.body}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {formatDateTime(a.occurredAt, timezone)}
                  {a.byName ? ` · ${a.byName}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function FollowUpPanel({
  subject,
  tasks,
  staff,
  timezone,
  currentUserId,
  canWrite,
}: {
  subject: Subject;
  tasks: Array<{ id: string; title: string; dueOn: string; completedAt: Date | null; assigneeName: string; overdue: boolean }>;
  staff: Array<{ id: string; name: string }>;
  timezone: string;
  currentUserId: string;
  canWrite: boolean;
}) {
  return (
    <Panel title="Follow-ups" description="Reminders with a due date. Overdue ones are flagged.">
      {tasks.length > 0 ? (
        <ul className="mb-6 divide-y divide-border text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={t.completedAt ? "text-text-muted line-through" : "font-medium"}>{t.title}</p>
                <p className="text-xs text-text-muted">
                  Due {formatDate(t.dueOn, timezone)} · {t.assigneeName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.completedAt ? <StatusBadge tone="success">Done</StatusBadge> : t.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : <StatusBadge tone="neutral">Open</StatusBadge>}
                {!t.completedAt && canWrite ? (
                  <ActionForm action={completeFollowUpAction} className="space-y-0">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="leadId" value={subject.leadId ?? ""} />
                    <input type="hidden" name="customerId" value={subject.customerId ?? ""} />
                    <Button type="submit" variant="secondary" aria-label={`Mark “${t.title}” done`}>
                      <Check aria-hidden="true" className="size-4" /> Done
                    </Button>
                  </ActionForm>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-sm text-text-muted">No follow-ups yet.</p>
      )}
      {canWrite ? (
        <ActionForm action={createFollowUpAction} className="space-y-3 border-t border-border pt-6">
          {subject.leadId ? <input type="hidden" name="leadId" value={subject.leadId} /> : null}
          {subject.customerId ? <input type="hidden" name="customerId" value={subject.customerId} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FField name="title" label="What needs doing" required placeholder="e.g. Call back about the oak table" className="sm:col-span-2" />
            <FField name="dueOn" label="Due date" type="date" required />
            <FSelect name="assignedTo" label="Assigned to" required defaultValue={currentUserId} options={staff.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <SubmitButton>Add follow-up</SubmitButton>
        </ActionForm>
      ) : null}
    </Panel>
  );
}
