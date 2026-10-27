import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { EmptyRow, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { listMaterials } from "@/server/specs";
import { addMaterialAction, deleteMaterialAction } from "./actions";

export const metadata = { title: "Materials" };

export default async function MaterialsPage() {
  const actor = await requireActor();
  const materials = await listMaterials(actor);
  const canWrite = can(actor, "products:write");
  return (
    <>
      <ModuleHeader href="/app/materials" />
      <div className="min-w-0 space-y-6">
        {canWrite ? (
          <Panel title="Add a material" description="It is offered whenever a product's Material is filled in. The collection page lists a material once a product on the website uses it.">
            <ActionForm action={addMaterialAction} resetOnSuccess>
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,24rem)_auto]">
                <FField name="name" kind="title" label="Material name" required maxLength={80} placeholder="e.g. Teak" />
                <SubmitButton pendingLabel="Adding…">Add material</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        ) : null}
        <Panel title="Materials" description="Removing a material only takes it off the list offered on products. Products that already use it keep it.">
          <TableWrap label="Materials">
            <Table>
              <THead>
                <TR>
                  <TH className="w-16 text-center">No.</TH>
                  <TH>Material</TH>
                  <TH className="text-center">Products</TH>
                  {canWrite ? (
                    <TH>
                      <span className="sr-only">Remove</span>
                    </TH>
                  ) : null}
                </TR>
              </THead>
              <tbody>
                {materials.length === 0 ? <EmptyRow colSpan={canWrite ? 4 : 3} title="No materials yet" description="Add the first one above." /> : null}
                {materials.map((m, i) => (
                  <TR key={m.name}>
                    <TD className="tabular text-center text-text-muted">{i + 1}</TD>
                    <TD className="font-medium">{m.name}</TD>
                    <TD className="text-center">{m.products}</TD>
                    {canWrite ? (
                      <TD>
                        <div className="flex justify-end">
                          <ActionForm action={deleteMaterialAction} className="space-y-0">
                            <input type="hidden" name="name" value={m.name} />
                            <ConfirmSubmit variant="ghost" title={`Remove ${m.name}?`} description="It is no longer offered on products. Products that already use it keep it." confirmLabel="Remove">
                              Remove
                            </ConfirmSubmit>
                          </ActionForm>
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}
