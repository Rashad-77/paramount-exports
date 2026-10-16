import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/app/product-form";
import {
  ActionForm,
  FCheckbox,
  FField,
  SubmitButton,
} from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { FileUploader } from "@/components/forms/file-uploader";
import { SiteImage } from "@/components/public/site-image";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { getProductAdmin, listCategories } from "@/server/catalogue";
import {
  addImagesAction,
  addVariantAction,
  archiveProductAction,
  mainImageAction,
  removeImageAction,
  updateProductAction,
  updateVariantAction,
} from "../actions";

export const metadata = { title: "Product" };

export default async function ProductAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireActor();
  let data;
  try {
    data = await getProductAdmin(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [cats, business] = await Promise.all([
    listCategories(actor),
    getBusinessSettings(),
  ]);
  const canWrite = can(actor, "products:write");
  const { product, variants, images } = data;

  return (
    <>
      <PageHeader
        title={product.name}
        description={`/products/${product.slug}`}
        actions={
          product.isPublished && !product.archivedAt ? (
            <Link
              className="inline-flex min-h-10 items-center underline"
              href={`/products/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on website
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          ) : undefined
        }
      />
      {product.archivedAt ? (
        <Alert tone="warning" title="Archived" className="mb-6">
          This product is hidden from the website.
        </Alert>
      ) : null}
      {!product.archivedAt && product.isPublished && images.length === 0 ? (
        <Alert tone="warning" title="No photographs yet" className="mb-6">
          Published products look best with at least one photograph.
        </Alert>
      ) : null}

      <div className="min-w-0 space-y-6">
        <Panel title="Details">
          {canWrite ? (
            <ProductForm
              action={updateProductAction}
              categories={cats.filter(
                (c) => !c.archivedAt || c.id === product.categoryId,
              )}
              values={{ ...product }}
              submitLabel="Save changes"
            />
          ) : (
            <p className="text-sm text-text-muted">
              You can view this product but not edit it.
            </p>
          )}
        </Panel>

        <Panel
          title="Options & prices"
          description="Each option has its own SKU. Customers can only add an option to their order when it has a price and “Show price publicly” is on for the product."
        >
          <ul className="divide-y divide-border">
            {variants.map((v) => (
              <li key={v.id} className="py-4 first:pt-0">
                {canWrite ? (
                  <>
                    <ActionForm
                      action={updateVariantAction}
                      className="space-y-3"
                    >
                      <input type="hidden" name="variantId" value={v.id} />
                      <input
                        type="hidden"
                        name="productId"
                        value={product.id}
                      />
                      <div className="grid gap-4 md:grid-cols-6">
                        <FField
                          name="label"
                          label="Option name"
                          defaultValue={v.label}
                          required
                        />
                        <FField
                          name="sku"
                          label="SKU"
                          defaultValue={v.sku}
                          required
                        />
                        <FField
                          name="listPrice"
                          label={`Price now (${business.currency})`}
                          inputMode="decimal"
                          defaultValue={v.listPrice ?? ""}
                        />
                        <FField
                          name="comparePrice"
                          label="Original price"
                          inputMode="decimal"
                          defaultValue={v.comparePrice ?? ""}
                          hint="For a sale: the higher price it was."
                        />
                        <FField
                          name="stockQuantity"
                          label="In stock"
                          inputMode="numeric"
                          defaultValue={v.stockQuantity ?? ""}
                          hint="Leave empty if you do not count this."
                        />
                        <div className="flex items-end">
                          <FCheckbox
                            name="isActive"
                            label="Active"
                            defaultChecked={v.isActive}
                          />
                        </div>
                      </div>
                      <SubmitButton>Save option</SubmitButton>
                    </ActionForm>
                  </>
                ) : (
                  <p className="text-sm">
                    {v.label} · {v.sku}{" "}
                    {v.listPrice
                      ? `· ${formatMoney(v.listPrice, business.currency)}`
                      : ""}{" "}
                    {v.stockQuantity !== null ? `· ${v.stockQuantity} in stock ` : ""}
                    {!v.isActive ? <StatusBadge>Inactive</StatusBadge> : null}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <ActionForm
              action={addVariantAction}
              className="mt-6 border-t border-border pt-6"
            >
              <h3 className="text-sm font-semibold">Add an option</h3>
              <input type="hidden" name="productId" value={product.id} />
              <div className="grid gap-4 md:grid-cols-6">
                <FField
                  name="label"
                  label="Option name"
                  required
                  placeholder="e.g. 200 cm, dark finish"
                />
                <FField name="sku" label="SKU" required />
                <FField
                  name="listPrice"
                  label={`Price now (${business.currency})`}
                  inputMode="decimal"
                />
                <FField
                  name="comparePrice"
                  label="Original price"
                  inputMode="decimal"
                  hint="For a sale: the higher price it was."
                />
                <FField
                  name="stockQuantity"
                  label="In stock"
                  inputMode="numeric"
                  hint="Leave empty if you do not count this."
                />
                <div className="flex items-end">
                  <FCheckbox name="isActive" label="Active" defaultChecked />
                </div>
              </div>
              <SubmitButton>Add option</SubmitButton>
            </ActionForm>
          ) : null}
        </Panel>

        <Panel
          title="Photographs"
          description="The first photograph is the main image. JPEG, PNG or WebP up to 8 MB."
        >
          {images.length > 0 ? (
            <ul className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {images.map((img, i) => (
                <li key={img.id} className="space-y-2">
                  <div className="relative aspect-square overflow-hidden border border-border bg-linen">
                    <SiteImage
                      src={img.url}
                      alt={img.alt}
                      fill
                      sizes="240px"
                      className="object-cover"
                    />
                  </div>
                  <p className="text-xs text-text-muted">
                    {i === 0 ? (
                      <StatusBadge tone="info">Main image</StatusBadge>
                    ) : null}{" "}
                    {img.alt}
                  </p>
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      {i > 0 ? (
                        <ActionForm
                          action={mainImageAction}
                          className="space-y-0"
                        >
                          <input type="hidden" name="imageId" value={img.id} />
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <Button type="submit" variant="ghost" size="md">
                            Make main
                          </Button>
                        </ActionForm>
                      ) : null}
                      <ActionForm
                        action={removeImageAction}
                        className="space-y-0"
                      >
                        <input type="hidden" name="imageId" value={img.id} />
                        <input
                          type="hidden"
                          name="productId"
                          value={product.id}
                        />
                        <ConfirmSubmit
                          variant="ghost"
                          title="Remove this photograph?"
                          description="It is removed from the website and deleted from storage."
                          confirmLabel="Remove"
                        >
                          Remove
                        </ConfirmSubmit>
                      </ActionForm>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-6 text-sm text-text-muted">No photographs yet.</p>
          )}
          {canWrite ? (
            <ActionForm
              action={addImagesAction}
              className="border-t border-border pt-6"
            >
              <input type="hidden" name="productId" value={product.id} />
              <FileUploader
                purpose="catalogue"
                label="Add photographs"
                maxFiles={10}
              />
              <FField
                name="altText"
                label="Description of the photograph"
                required
                hint="Read out by screen readers, e.g. “Teak dining table, three-quarter view”."
              />
              <SubmitButton>Add photographs</SubmitButton>
            </ActionForm>
          ) : null}
        </Panel>

        {canWrite ? (
          <Panel
            title={product.archivedAt ? "Restore product" : "Archive product"}
          >
            <ActionForm action={archiveProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <input
                type="hidden"
                name="archive"
                value={product.archivedAt ? "false" : "true"}
              />
              <p className="text-sm text-text-muted">
                {product.archivedAt
                  ? "Restoring keeps it unpublished until you publish it."
                  : "Archiving hides it from the website. Records that refer to it are kept."}
              </p>
              <ConfirmSubmit
                title={
                  product.archivedAt
                    ? "Restore this product?"
                    : "Archive this product?"
                }
                description={
                  product.archivedAt
                    ? "It will become available again, unpublished."
                    : "It will be hidden from the website immediately."
                }
                confirmLabel={product.archivedAt ? "Restore" : "Archive"}
                destructive={!product.archivedAt}
              >
                {product.archivedAt ? "Restore product" : "Archive product"}
              </ConfirmSubmit>
            </ActionForm>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
