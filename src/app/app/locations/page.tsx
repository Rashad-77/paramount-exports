import Link from "next/link";
import { ActionForm, FCheckbox, FField, FSelect, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { LOCATION_KINDS } from "@/lib/schemas/inventory";
import { listLocations } from "@/server/inventory";
import { saveLocationAction } from "../stock/actions";

export const metadata = { title: "Locations" };
const KIND: Record<string, string> = { showroom: "Showroom", workshop: "Workshop", warehouse: "Warehouse" };

export default async function LocationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const editId = one((await searchParams).edit);
  const rows = await listLocations(actor, true);
  const canEdit = can(actor, "inventory:adjust");
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;
  return (
    <>
      <PageHeader title="Locations" description="Places stock is kept. Each has its own stock, so the showroom and workshop can differ." />
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <TableWrap label="Locations">
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                {canEdit ? <TH>Actions</TH> : null}
              </tr>
            </THead>
            <tbody>
              {rows.map((l) => (
                <TR key={l.id}>
                  <TD className="font-medium">{l.name}</TD>
                  <TD>{KIND[l.kind]}</TD>
                  <TD>{l.isActive ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge>Inactive</StatusBadge>}</TD>
                  {canEdit ? <TD><Link className="underline" href={`/app/locations?edit=${l.id}`}>Edit</Link></TD> : null}
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {canEdit ? (
          <Panel title={editing ? `Edit “${editing.name}”` : "Add a location"}>
            <ActionForm key={editing?.id ?? "new"} action={saveLocationAction}>
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <FField name="name" label="Name" required defaultValue={editing?.name} />
              <FSelect name="kind" label="Type" required defaultValue={editing?.kind ?? "warehouse"} options={LOCATION_KINDS.map((k) => ({ value: k, label: KIND[k]! }))} />
              <FCheckbox name="isActive" label="Active" hint="Inactive locations cannot be used for new orders or transfers." defaultChecked={editing?.isActive ?? true} />
              <SubmitButton>{editing ? "Save changes" : "Add location"}</SubmitButton>
            </ActionForm>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
