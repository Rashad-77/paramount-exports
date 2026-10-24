import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/app/product-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { getBusinessSettings } from "@/lib/settings";
import { listSpecCatalogExtras } from "@/server/specs";
import { getProductAdmin, listCategories } from "@/server/catalogue";
import { updateProductAction } from "../actions";

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
  const [cats, business, saved] = await Promise.all([
    listCategories(actor),
    getBusinessSettings(),
    listSpecCatalogExtras(actor),
  ]);
  const canWrite = can(actor, "products:write");
  const { product, variants, images } = data;

  return (
    <>
      <PageHeader back={{ href: "/app/products", to: "products" }}
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
        <Panel>
          {canWrite ? (
            <ProductForm
              action={updateProductAction}
              currency={business.currency}
              savedTypes={saved.types}
              savedValues={saved.values}
              savedHidden={saved.hidden}
              categories={cats.filter(
                (c) => !c.archivedAt || c.id === product.categoryId,
              )}
              values={{
                id: product.id,
                name: product.name,
                categoryId: product.categoryId,
                kind: product.kind,
                description: product.description,
                shortDescription: product.shortDescription,
                specifications: product.specifications,
                visibility: product.archivedAt
                  ? "archived"
                  : product.isPublished
                    ? "published"
                    : "draft",
                isFeatured: product.isFeatured,
                isPremium: product.isPremium,
                availability: product.availability,
                stockQuantity: variants[0]?.stockQuantity ?? null,
                // With a discount the form shows the regular price (the price line's original price) and the discount on its own.
                listPrice: product.discountKind ? (variants[0]?.comparePrice ?? variants[0]?.listPrice ?? null) : (variants[0]?.listPrice ?? null),
                discountKind: product.discountKind,
                discountValue: product.discountValue,
                images,
              }}
              submitLabel="Save changes"
            />
          ) : (
            <p className="text-sm text-text-muted">
              You can view this product but not edit it.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
