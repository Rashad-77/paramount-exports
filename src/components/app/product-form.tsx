import { ActionForm, FCheckbox, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";
import { AVAILABILITY, AVAILABILITY_LABEL, PRODUCT_KINDS } from "@/lib/schemas/catalogue";

export interface ProductFormValues {
  id?: string;
  name?: string;
  slug?: string;
  categoryId?: string;
  kind?: string;
  description?: string | null;
  material?: string | null;
  finish?: string | null;
  dimensions?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
  showAvailability?: boolean;
  availability?: string | null;
  showPrice?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export function ProductForm({
  action,
  categories,
  values = {},
  creating = false,
  submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  categories: Array<{ id: string; name: string }>;
  values?: ProductFormValues;
  creating?: boolean;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="name" label="Product name" required defaultValue={values.name} />
        <FField name="slug" label="Web address name" defaultValue={values.slug} hint="Lowercase letters and hyphens. Leave blank to create it from the name." />
        <FSelect name="categoryId" label="Category" required defaultValue={values.categoryId} placeholder="Choose a category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <FSelect name="kind" label="Type" required defaultValue={values.kind ?? "stocked"} options={PRODUCT_KINDS.map((k) => ({ value: k, label: k === "stocked" ? "Ready-made (stocked)" : "Made to order" }))} />
        <FField name="material" label="Wood / material" defaultValue={values.material ?? ""} />
        <FField name="finish" label="Finish" defaultValue={values.finish ?? ""} />
        <FField name="dimensions" label="Dimensions" defaultValue={values.dimensions ?? ""} placeholder="e.g. W 180 × D 90 × H 75 cm" className="md:col-span-2" />
        {creating ? (
          <>
            <FField name="sku" label="SKU / code" required hint="Unique. Further sizes or finishes are added as options after saving." />
            <FField name="listPrice" label="Price" inputMode="decimal" hint="Leave blank if not priced yet." />
          </>
        ) : null}
      </div>
      <FTextArea name="description" label="Description" rows={5} defaultValue={values.description ?? ""} />

      <fieldset className="space-y-3 rounded-[var(--radius-md)] border border-border p-4">
        <legend className="px-1 text-sm font-medium">Website</legend>
        <FCheckbox name="isPublished" label="Published" hint="Visible on the public website." defaultChecked={values.isPublished} />
        <FCheckbox name="isFeatured" label="Featured on the homepage" defaultChecked={values.isFeatured} />
        <FCheckbox name="showPrice" label="Show price publicly" hint="Off by default. Prices are never shown unless you switch this on." defaultChecked={values.showPrice} />
        <FCheckbox name="showAvailability" label="Show availability publicly" hint="Only show this if you keep it accurate." defaultChecked={values.showAvailability} />
        <FSelect name="availability" label="Availability to show" defaultValue={values.availability ?? ""} placeholder="—" options={AVAILABILITY.map((a) => ({ value: a, label: AVAILABILITY_LABEL[a] }))} />
        <div className="grid gap-5 md:grid-cols-2">
          <FField name="seoTitle" label="Search result title" defaultValue={values.seoTitle ?? ""} hint="Optional. Up to 70 characters." />
          <FField name="seoDescription" label="Search result description" defaultValue={values.seoDescription ?? ""} hint="Optional. Up to 160 characters." />
        </div>
      </fieldset>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
