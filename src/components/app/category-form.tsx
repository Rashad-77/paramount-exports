import { FPanelSelect } from "@/components/app/panel-select";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";
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
  /** The main categories a subcategory can be filed under (never itself). */
  groups: Array<{ id: string; name: string }>;
  values?: CategoryFormValues;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="name" kind="title" label="Name" required defaultValue={values.name} hint="The web address is made from the name automatically." />
        <FPanelSelect
          name="parentId"
          label="Parent category"
          defaultValue={values.parentId ?? ""}
          placeholder="None (this is a main category)"
          quietPlaceholder={false}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
