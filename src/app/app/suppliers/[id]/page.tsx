import Link from "next/link";
import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/app/supplier-form";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { PO_STATUS_LABEL, PO_STATUS_TONE } from "@/lib/purchasing-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { getSupplier } from "@/server/purchasing";
import { archiveSupplierAction } from "../actions";

export const metadata = { title: "Supplier" };

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let d;
  try {
    d = await getSupplier(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { supplier: s, orders } = d;
  const tz = (await getBusinessSettings()).timezone;
  const write = can(actor, "suppliers:write");
  return (
    <>
      <PageHeader title={s.name} description={s.suppliedMaterials ?? undefined} actions={write && !s.archivedAt && can(actor, "purchasing:write") ? <ButtonLink href={`/app/purchase-orders/new?supplierId=${s.id}`}>New purchase order</ButtonLink> : undefined} />
      {s.archivedAt ? <p className="mb-4"><StatusBadge tone="neutral">Archived</StatusBadge></p> : null}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Panel title="Details">
            {write ? <SupplierForm initial={s} /> : (
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                {Object.entries({ Contact: s.contactName, Phone: s.phone, Email: s.email, Address: s.address, Notes: s.notes }).map(([k, v]) => (
                  <div key={k}><dt className="text-text-muted">{k}</dt><dd className="whitespace-pre-line font-medium">{v ?? "—"}</dd></div>
                ))}
              </dl>
            )}
          </Panel>
        </div>
        <div className="min-w-0 space-y-6">
          <Panel title="Purchase orders">
            {orders.length === 0 ? <p className="text-sm text-text-muted">None yet.</p> : (
              <ul className="divide-y divide-border text-sm">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <div><Link href={`/app/purchase-orders/${o.id}`} className="font-medium text-walnut underline">{o.reference}</Link><span className="block text-xs text-text-muted">{formatDate(o.createdAt, tz)}</span></div>
                    <StatusBadge tone={PO_STATUS_TONE[o.status]}>{PO_STATUS_LABEL[o.status]}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {write ? (
            <Panel title={s.archivedAt ? "Restore supplier" : "Archive supplier"} description="Suppliers with purchase history are never deleted. Archived suppliers cannot be chosen for new orders.">
              <ActionForm action={archiveSupplierAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="archived" value={s.archivedAt ? "0" : "1"} />
                {s.archivedAt ? <SubmitButton variant="secondary">Restore</SubmitButton> : (
                  <ConfirmSubmit title="Archive this supplier?" description="Existing purchase orders keep their history. You can restore the supplier later." confirmLabel="Archive supplier">Archive</ConfirmSubmit>
                )}
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
