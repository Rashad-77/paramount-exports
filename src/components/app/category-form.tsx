import { BannerImageField } from "@/components/app/banner-image-field";
import { FPanelSelect } from "@/components/app/panel-select";
import { ActionForm, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";

export interface CategoryFormValues {
  id?: string;
  name?: string;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  /** The picture behind a main category's band, and where it sits. */
  bannerUrl?: string | null;
  bannerX?: number;
  bannerY?: number;
  bannerZoom?: number;
  /** The subcategories listed on the band. */
  subNames?: string[];
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
      <FTextArea
        name="description"
        label="Intro for the category page"
        rows={3}
        maxLength={500}
        defaultValue={values.description ?? ""}
        hint="Shown on the category's own page, for visitors and for search engines: what the category is and what it holds, in two or three sentences."
      />
      {values.parentId ? null : <BannerImageField initialUrl={values.bannerUrl ?? null} initialX={values.bannerX ?? 50} initialY={values.bannerY ?? 50} initialZoom={values.bannerZoom ?? 100} subNames={values.subNames ?? []} />}
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
