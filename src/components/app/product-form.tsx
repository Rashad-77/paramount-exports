import { ActionForm, FCheckbox, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { treeLabel, treeOrder } from "@/lib/category-tree";
import type { ActionState } from "@/lib/action-state";
import { AVAILABILITY, AVAILABILITY_LABEL, CUSTOMIZATIONS, CUSTOMIZATION_LABEL, PRODUCT_KINDS, PURCHASE_MODES, PURCHASE_MODE_LABEL, WOOD_TREATMENTS } from "@/lib/schemas/catalogue";

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
  shortDescription?: string | null;
  features?: string | null;
  uses?: string | null;
  woodTreatment?: string | null;
  colour?: string | null;
  otherSpecs?: string | null;
  leadTime?: string | null;
  careInstructions?: string | null;
  customization?: string[];
  purchaseMode?: string;
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
  categories: Array<{ id: string; name: string; parentId: string | null }>;
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
        <FSelect name="categoryId" label="Category" required defaultValue={values.categoryId} placeholder="Choose a category" options={treeOrder(categories).map((c) => ({ value: c.id, label: treeLabel(c) }))} />
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
      <FTextArea name="shortDescription" label="Short description" rows={2} maxLength={300} defaultValue={values.shortDescription ?? ""} hint="One or two sentences shown under the name." />
      <FTextArea name="description" label="Detailed description" rows={5} defaultValue={values.description ?? ""} hint="The long text, shown under the Description bar on the product page." />

      <fieldset className="space-y-4 border border-border p-4">
        <legend className="px-1 text-sm font-medium">Specifications, features and care</legend>
        <p className="text-sm text-text-muted">Fill in only what applies. Anything left empty is not shown on the product page.</p>
        <div className="grid gap-5 md:grid-cols-2">
          <FSelect name="woodTreatment" label="Wood treatment" defaultValue={values.woodTreatment ?? ""} placeholder="Not applicable" options={WOOD_TREATMENTS.map((t) => ({ value: t, label: t === "treated" ? "Treated" : "Untreated" }))} />
          <FField name="colour" label="Colour" defaultValue={values.colour ?? ""} />
        </div>
        <FTextArea name="otherSpecs" label="Other specifications" rows={3} maxLength={1500} defaultValue={values.otherSpecs ?? ""} hint="One per line, as “Label: value”, for example “Weight: 18 kg”." />
        <div className="grid gap-5 md:grid-cols-2">
          <FTextArea name="features" label="Features" rows={4} maxLength={2000} defaultValue={values.features ?? ""} hint="One per line." />
          <FTextArea name="uses" label="Uses" rows={4} maxLength={1500} defaultValue={values.uses ?? ""} hint="One per line." />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <FField name="leadTime" label="Lead time" defaultValue={values.leadTime ?? ""} placeholder="e.g. 2 to 3 weeks" />
          <FTextArea name="careInstructions" label="Care instructions" rows={3} maxLength={2000} defaultValue={values.careInstructions ?? ""} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border border-border p-4">
        <legend className="px-1 text-sm font-medium">How it is sold</legend>
        <FSelect name="purchaseMode" label="Buying options on the page" required defaultValue={values.purchaseMode ?? "direct"} options={PURCHASE_MODES.map((m) => ({ value: m, label: PURCHASE_MODE_LABEL[m] }))} hint="Add to cart only appears for pieces with a public price. A piece with no price always offers a quotation." />
        <div>
          <p className="text-sm font-medium">What the customer can customize</p>
          <p className="mb-2 text-sm text-text-muted">Tick only what you offer for this piece. Nothing ticked hides the customization section.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {CUSTOMIZATIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="customization" value={c} defaultChecked={values.customization?.includes(c)} className="size-4 accent-[var(--color-walnut)]" />
                {CUSTOMIZATION_LABEL[c]}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border border-border p-4">
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
