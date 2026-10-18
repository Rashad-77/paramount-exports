import { FPanelSelect } from "@/components/app/panel-select";
import { ActionForm, FCheckbox, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";

export interface CategoryFormValues {
  id?: string;
  name?: string;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** The add and edit form for a category. The web address is made from the name, like a product's. */
export function CategoryForm({
  action,
  groups,
  values = {},
  submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  /** The groups a category can be filed under (never itself). */
  groups: Array<{ id: string; name: string }>;
  values?: CategoryFormValues;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="name" label="Category name" required defaultValue={values.name} hint="The web address is made from the name automatically." />
        <FPanelSelect
          name="parentId"
          label="Group"
          defaultValue={values.parentId ?? ""}
          placeholder="None (this is a group)"
          quietPlaceholder={false}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
          hint="Choose a group to file this under it, for example Tables under Furniture."
        />
      </div>
      <FTextArea name="description" label="Description" rows={3} defaultValue={values.description ?? ""} />
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="sortOrder" label="Display order" type="number" min={0} defaultValue={String(values.sortOrder ?? 0)} hint="Lower numbers come first." />
      </div>
      <FCheckbox name="isActive" label="Visible on the website" defaultChecked={values.isActive ?? true} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
