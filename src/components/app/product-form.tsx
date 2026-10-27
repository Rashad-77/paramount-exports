import { ActionForm, FField, FTextArea } from "@/components/forms/action-form";
import { PremiumWordCount } from "@/components/app/premium-word-count";
import { DetailsFields } from "@/components/app/product-details-fields";
import { FCategorySelect } from "@/components/app/cascade-filter";
import { PhotosEditor } from "@/components/app/photos-editor";
import { ReviewAndSave } from "@/components/app/review-and-save";
import { SpecificationsEditor } from "@/components/app/spec-editor";
import type { ActionState } from "@/lib/action-state";
import { toCascadeGroups, treeLabel, treeOrder } from "@/lib/category-tree";
import type { SavedSpecType, SpecEntry } from "@/lib/specifications";

/** Shown greyed in an empty description, as an example of the length and tone of a premium piece (85 words, under the premium limit). */
const SAMPLE_DESCRIPTION =
  "Built from a single run of seasoned solid teak, this dining table is made to be the centre of the room. The top is planed and sanded by hand until the grain glows, then sealed with a low-sheen oil finish that protects without hiding the wood. Mortise and tenon joints hold the frame square for years, and the legs are shaped to leave plenty of room for chairs. Choose the size and finish that suit your space, and we will build it to your measurements.";

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
  discountKind?: string | null;
  discountValue?: string | null;
  images?: Array<{ id: string; url: string; x?: number; y?: number; z?: number }>;
}

export function ProductForm({
  action,
  categories,
  values = {},
  currency,
  shop,
  submitLabel,
  savedTypes,
  savedValues,
  savedHidden,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  values?: ProductFormValues;
  currency: string;
  /** The showroom details the product page lists under Delivery and collection (the preview shows them too). */
  shop?: { address: string | null; openingHours: string | null; mapUrl: string | null };
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
        <FField name="name" kind="title" label="Product name" required defaultValue={values.name} hint="The web address is made from the name automatically." />
        <FCategorySelect
          name="categoryId"
          label="Category"
          allLabel="Choose a category"
          required
          defaultValue={values.categoryId}
          groups={toCascadeGroups(sorted)}
        />
      </div>
      <FTextArea name="shortDescription" label="Short description" rows={2} maxLength={300} defaultValue={values.shortDescription ?? ""} hint="Short description shown under the product name." />
      <FTextArea name="description" label="Detailed description" rows={5} defaultValue={values.description ?? ""} placeholder={SAMPLE_DESCRIPTION} hint="The long text, shown under the Description bar on the product page." />
      <PremiumWordCount />

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
          discountKind={values.discountKind}
          discountValue={values.discountValue}
          currency={currency}
        />
        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">
            Photos{submitLabel === "Create product" ? <span aria-hidden="true" className="text-danger"> *</span> : null}
            {submitLabel === "Create product" ? <span className="ml-2 font-normal text-text-muted">Add at least one.</span> : null}
          </h3>
          {/* Remounted when the saved photos change, so it always starts from what is stored. */}
          <PhotosEditor key={(values.images ?? []).map((i) => i.id).join(",")} initial={values.images ?? []} />
        </div>
      </fieldset>
      <ReviewAndSave
        currency={currency}
        shop={shop}
        confirmLabel={submitLabel === "Create product" ? "Confirm and create" : "Confirm and save"}
        photosRequired={submitLabel === "Create product"}
        categoryLabels={Object.fromEntries(treeOrder(categories).map((c) => [c.id, treeLabel(c)]))}
      />
    </ActionForm>
  );
}
