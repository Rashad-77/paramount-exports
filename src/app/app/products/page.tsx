import { EditToggle, ProductsEditProvider, ProductsTable } from "@/components/app/products-table";
import { ProductFilters } from "@/components/app/product-filters";
import { ButtonLink } from "@/components/ui/button";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { toCascadeGroups } from "@/lib/category-tree";
import { one, pageOf, type SP } from "@/lib/list-params";
import {
  listCategories,
  listProductsAdmin,
  PRODUCT_STATUSES,
  type ProductStatus,
} from "@/server/catalogue";
import { archiveProductsAction, deleteProductsAction } from "./actions";

export const metadata = { title: "Products" };
const PAGE_SIZE = 20;

/** Every ?status= in the address, once each, keeping only statuses that exist. */
const statusesOf = (v: string | string[] | undefined): ProductStatus[] => {
  const all = Array.isArray(v) ? v : v ? [v] : [];
  return PRODUCT_STATUSES.filter((s) => all.includes(s));
};

export default async function ProductsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const statuses = statusesOf(sp.status);
  const categoryIds = (Array.isArray(sp.category) ? sp.category : sp.category ? [sp.category] : []).filter((c) => /^[0-9a-f-]{36}$/i.test(c));
  const page = pageOf(sp);
  const [cats, result] = await Promise.all([
    listCategories(actor),
    listProductsAdmin(actor, {
      q,
      statuses,
      categoryIds,
      page,
      pageSize: PAGE_SIZE,
    }),
  ]);
  const href = (n: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    for (const c of categoryIds) u.append("category", c);
    for (const s of statuses) u.append("status", s);
    u.set("page", String(n));
    return `/app/products?${u.toString()}`;
  };
  const filtered = Boolean(q || statuses.length || categoryIds.length);
  const canWrite = can(actor, "products:write");

  return (
    <ProductsEditProvider>
      <ModuleHeader
        href="/app/products"
        actions={
          canWrite ? (
            <>
              {filtered ? (
                <ButtonLink href="/app/products" variant="ghost">
                  Clear filters
                </ButtonLink>
              ) : null}
              <EditToggle />
              <ButtonLink href="/app/products/new">Add product</ButtonLink>
            </>
          ) : null
        }
      />
      <ProductFilters
        q={q}
        categoryIds={categoryIds}
        statuses={statuses}
        categories={toCascadeGroups(cats.filter((c) => !c.archivedAt))}
      />
      {result.rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No products match" : "No products yet"}
          description={
            filtered
              ? "Try clearing a filter."
              : "Add a category, then your first product."
          }
          action={
            !filtered && canWrite ? (
              <ButtonLink href="/app/products/new">Add product</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ProductsTable
          rows={result.rows.map((p) => ({
            id: p.id,
            name: p.name,
            categoryName: p.categoryName,
            isPublished: p.isPublished,
            isFeatured: p.isFeatured,
            isPremium: p.isPremium,
            archived: p.archivedAt !== null,
            availability: p.availability,
          }))}
          startAt={(page - 1) * PAGE_SIZE}
          total={result.total}
          canWrite={canWrite}
          archiveAction={archiveProductsAction}
          deleteAction={deleteProductsAction}
        />
      )}
      <Pagination
        page={page}
        pageCount={result.pageCount}
        hrefFor={href}
      />
    </ProductsEditProvider>
  );
}
