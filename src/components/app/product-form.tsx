import { ActionForm, FField, FTextArea } from "@/components/forms/action-form";
import { DetailsFields } from "@/components/app/product-details-fields";
import { FCategorySelect } from "@/components/app/cascade-filter";
import { PhotosEditor } from "@/components/app/photos-editor";
import { ReviewAndSave } from "@/components/app/review-and-save";
import { SpecificationsEditor } from "@/components/app/spec-editor";
import type { ActionState } from "@/lib/action-state";
import { toCascadeGroups, treeLabel, treeOrder } from "@/lib/category-tree";
import type { SavedSpecType, SpecEntry } from "@/lib/specifications";

export interface ProductFormValues {
  id?: string;
  name?: string;
  categoryId?: string;
  kind?: string;
  description?: string | null;
  shortDescription?: string | null;
  specifications?: SpecEntry[];
  /** draft, published or archived. */
  visibility?: string;
  isFeatured?: boolean;
  isPremium?: boolean;
  availability?: string | null;
  stockQuantity?: number | null;
  listPrice?: string | null;
  images?: Array<{ id: string; url: string }>;
  thumbnailImageId?: string | null;
}

export function ProductForm({
  action,
  categories,
  values = {},
  currency,
  submitLabel,
  savedTypes,
  savedValues,
  savedHidden,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  values?: ProductFormValues;
  currency: string;
  submitLabel: string;
  savedTypes?: SavedSpecType[];
  savedValues?: Record<string, string[]>;
  savedHidden?: Record<string, string[]>;
}) {
  const sorted = treeOrder(categories).map(({ id, name, parentId }) => ({ id, name, parentId }));
  return (
    <ActionForm action={action}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="name" label="Product name" required defaultValue={values.name} hint="The web address is made from the name automatically." />
        <FCategorySelect
          name="categoryId"
          label="Category"
          allLabel="Choose a category"
          required
          defaultValue={values.categoryId}
          groups={toCascadeGroups(sorted)}
        />
      </div>
      <FTextArea name="shortDescription" label="Short description" rows={2} maxLength={300} defaultValue={values.shortDescription ?? ""} hint="One or two sentences shown under the name." />
      <FTextArea name="description" label="Detailed description" rows={5} defaultValue={values.description ?? ""} hint="The long text, shown under the Description bar on the product page." />

      <fieldset className="space-y-4 border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Specifications</legend>
        <SpecificationsEditor initial={values.specifications ?? []} kind={values.kind ?? "stocked"} savedTypes={savedTypes} savedValues={savedValues} savedHidden={savedHidden} />
      </fieldset>

      <fieldset className="space-y-6 border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Details</legend>
        <DetailsFields
          visibility={values.visibility ?? "draft"}
          isFeatured={values.isFeatured}
          isPremium={values.isPremium}
          availability={values.id ? values.availability : (values.availability ?? "in_stock")}
          stockQuantity={values.stockQuantity}
          price={values.listPrice}
          currency={currency}
        />
        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Photos</h3>
          {/* Remounted when the saved photos change, so it always starts from what is stored. */}
          <PhotosEditor key={(values.images ?? []).map((i) => i.id).join(",") + (values.thumbnailImageId ?? "")} initial={values.images ?? []} thumbnailId={values.thumbnailImageId} />
        </div>
      </fieldset>
      <ReviewAndSave
        currency={currency}
        confirmLabel={submitLabel === "Create product" ? "Confirm and create" : "Confirm and save"}
        categoryLabels={Object.fromEntries(treeOrder(categories).map((c) => [c.id, treeLabel(c)]))}
      />
    </ActionForm>
  );
}
