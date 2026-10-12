import Link from "next/link";
import { ActionForm, FCheckbox, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { listCategories } from "@/server/catalogue";
import { archiveCategoryAction, createCategoryAction, updateCategoryAction } from "./actions";

export const metadata = { title: "Categories" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const editId = one((await searchParams).edit);
  const rows = await listCategories(actor);
  const canWrite = can(actor, "products:write");
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;

  return (
    <>
      <PageHeader title="Categories" description="Group products for the website. A category with no published products is hidden from the public site." />
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        {rows.length === 0 ? (
          <Panel>
            <p className="text-sm text-text-muted">No categories yet. Add the first one to start building the catalogue.</p>
          </Panel>
        ) : (
          <TableWrap label="Categories">
            <Table>
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>Web address</TH>
                  <TH>Products</TH>
                  <TH>Status</TH>
                  {canWrite ? <TH>Actions</TH> : null}
                </tr>
              </THead>
              <tbody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD className="text-text-muted">/{c.slug}</TD>
                    <TD numeric>{c.productCount}</TD>
                    <TD>{c.archivedAt ? <StatusBadge>Archived</StatusBadge> : c.isActive ? <StatusBadge tone="success">Visible</StatusBadge> : <StatusBadge tone="warning">Hidden</StatusBadge>}</TD>
                    {canWrite ? (
                      <TD>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/app/categories?edit=${c.id}`} className="underline">
                            Edit
                          </Link>
                          <ActionForm action={archiveCategoryAction} className="space-y-0">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="archive" value={c.archivedAt ? "false" : "true"} />
                            <ConfirmSubmit variant="ghost" title={c.archivedAt ? "Restore category?" : "Archive category?"} description={c.archivedAt ? "It will be available again." : "It is hidden from the website. You can restore it later."} confirmLabel={c.archivedAt ? "Restore" : "Archive"} destructive={!c.archivedAt}>
                              {c.archivedAt ? "Restore" : "Archive"}
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
        )}

        {canWrite ? (
          <Panel title={editing ? `Edit “${editing.name}”` : "New category"}>
            <ActionForm key={editing?.id ?? "new"} action={editing ? updateCategoryAction : createCategoryAction}>
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <FField name="name" label="Name" required defaultValue={editing?.name} />
              <FField name="slug" label="Web address name" defaultValue={editing?.slug} hint="Lowercase letters and hyphens. Leave blank to create it from the name." />
              <FTextArea name="description" label="Description" rows={3} defaultValue={editing?.description ?? ""} />
              <FField name="sortOrder" label="Display order" type="number" min={0} defaultValue={String(editing?.sortOrder ?? 0)} hint="Lower numbers come first." />
              <FCheckbox name="isActive" label="Visible on the website" defaultChecked={editing?.isActive ?? true} />
              <div className="flex gap-2">
                <SubmitButton>{editing ? "Save changes" : "Add category"}</SubmitButton>
                {editing ? (
                  <Link href="/app/categories" className="inline-flex min-h-10 items-center px-3 underline">
                    Cancel
                  </Link>
                ) : null}
              </div>
            </ActionForm>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
