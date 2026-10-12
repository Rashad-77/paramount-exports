import { ActionForm, FCheckbox, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";

export function GalleryForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  values?: { id?: string; title?: string; description?: string | null; completedOn?: string | null; isPublished?: boolean; sortOrder?: number };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="title" label="Project title" required defaultValue={values.title} />
        <FField name="completedOn" label="Completed on" type="date" defaultValue={values.completedOn ?? ""} />
      </div>
      <FTextArea name="description" label="Description" rows={4} defaultValue={values.description ?? ""} />
      <FField name="sortOrder" label="Display order" type="number" min={0} defaultValue={String(values.sortOrder ?? 0)} hint="Lower numbers come first." />
      <FCheckbox name="isPublished" label="Published" hint="Visible on the Gallery page." defaultChecked={values.isPublished} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
