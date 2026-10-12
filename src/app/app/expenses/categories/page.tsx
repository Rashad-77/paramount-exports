import { ActionForm, FCheckbox, FField, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { listExpenseCategories } from "@/server/expenses";
import { saveCategoryAction } from "../actions";

export const metadata = { title: "Expense categories" };

export default async function CategoriesPage() {
  const actor = await requireActor();
  requirePermission(actor, "expenses:manage_categories");
  const cats = await listExpenseCategories(actor, true);
  return (
    <>
      <PageHeader title="Expense categories" description="Categories group expenses in reports. Turning one off hides it from new expenses; old entries keep it." />
      <div className="max-w-2xl min-w-0 space-y-6">
        <Panel title="Add a category">
          <ActionForm action={saveCategoryAction}>
            <FField name="name" label="Name" required />
            <input type="hidden" name="isActive" value="on" />
            <SubmitButton>Add category</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel title="Existing categories">
          <ul className="divide-y divide-border">
            {cats.map((c) => (
              <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                <ActionForm action={saveCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_auto]">
                    <FField name="name" label="Name" required defaultValue={c.name} />
                    <FCheckbox name="isActive" label="In use" defaultChecked={c.isActive} />
                    <SubmitButton variant="secondary">Save</SubmitButton>
                  </div>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
