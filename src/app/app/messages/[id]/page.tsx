import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { MESSAGE_KIND_LABEL } from "@/lib/order-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { getMessage } from "@/server/messages";
import { setHandledAction } from "../actions";

export const metadata = { title: "Message" };

const CUSTOM_LABELS: Record<string, string> = { furnitureType: "What they want made", dimensions: "Dimensions", material: "Wood or material", finish: "Finish", budgetRange: "Budget", targetDate: "Wanted by" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let data;
  try {
    data = await getMessage(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const { message: m, product, files } = data;
  const details = m.payload && typeof m.payload === "object" ? Object.entries(m.payload as Record<string, unknown>).filter(([, v]) => v) : [];

  return (
    <>
      <PageHeader
        title={m.reference}
        description={`${MESSAGE_KIND_LABEL[m.kind] ?? m.kind} · received ${formatDateTime(m.createdAt, business.timezone)}`}
        actions={m.isHandled ? <StatusBadge tone="success">Handled</StatusBadge> : <StatusBadge tone="info">Open</StatusBadge>}
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel title="Message">
            <p className="whitespace-pre-line text-base">{m.message ?? "No message was written."}</p>
            {product ? <p className="mt-4 text-sm text-text-muted">About the product: <span className="font-medium text-text">{product.name}</span></p> : null}
          </Panel>
          {details.length > 0 ? (
            <Panel title="Custom furniture details">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {details.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-text-muted">{CUSTOM_LABELS[k] ?? k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}
          {files.length > 0 ? (
            <Panel title="Pictures">
              <ul className="space-y-1.5 text-sm">
                {files.map((f) => (
                  <li key={f.id}>
                    <a className="underline" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer">
                      {f.name}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Reply to">
            <p className="font-medium">{m.name}</p>
            <p className="mt-1 text-sm">
              <a className="underline" href={`tel:${m.phone.replace(/\s+/g, "")}`}>
                {m.phone}
              </a>
            </p>
            {m.email ? (
              <p className="text-sm">
                <a className="underline" href={`mailto:${m.email}`}>
                  {m.email}
                </a>
              </p>
            ) : null}
            {m.preferredContact ? <p className="mt-3 text-sm text-text-muted">Prefers: {m.preferredContact}</p> : null}
          </Panel>
          {can(actor, "messages:handle") ? (
            <Panel title={m.isHandled ? "Handled" : "When you have replied"}>
              <ActionForm action={setHandledAction} className="space-y-0">
                <input type="hidden" name="id" value={m.id} />
                {m.isHandled ? null : <input type="hidden" name="handled" value="true" />}
                <SubmitButton variant={m.isHandled ? "secondary" : "primary"}>{m.isHandled ? "Move back to open" : "Mark as handled"}</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
