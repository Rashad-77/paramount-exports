import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import {
  Pagination,
  Table,
  TableWrap,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { treeLabel, treeOrder } from "@/lib/category-tree";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { listCategories, listProductsAdmin } from "@/server/catalogue";

export const metadata = { title: "Products" };
const PAGE_SIZE = 20;

export default async function ProductsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const status = oneOf(one(sp.status), [
    "published",
    "draft",
    "archived",
  ] as const);
  const categoryId = one(sp.category);
  const page = pageOf(sp);
  const [cats, result] = await Promise.all([
    listCategories(actor),
    listProductsAdmin(actor, {
      q,
      status,
      categoryId,
      page,
      pageSize: PAGE_SIZE,
    }),
  ]);
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/products", { q, status, category: categoryId, ...over });
  const filtered = Boolean(q || status || categoryId);

  return (
    <>
      <ModuleHeader
        href="/app/products"
        actions={
          <>
            <ButtonLink href="/app/categories" variant="secondary">
              Categories
            </ButtonLink>
            {can(actor, "products:write") ? (
              <ButtonLink href="/app/products/new">Add product</ButtonLink>
            ) : null}
          </>
        }
      />
      <form
        method="get"
        className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <TextField
          showOptional={false}
          label="Search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name or SKU"
        />
        <SelectField
          showOptional={false}
          label="Category"
          name="category"
          defaultValue={categoryId ?? ""}
          placeholder="All"
          options={treeOrder(cats.filter((c) => !c.archivedAt)).map((c) => ({
            value: c.id,
            label: treeLabel(c),
          }))}
        />
        <SelectField
          showOptional={false}
          label="Status"
          name="status"
          defaultValue={status ?? ""}
          placeholder="Active (published and draft)"
          options={[
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {filtered ? (
            <ButtonLink href="/app/products" variant="ghost">
              Clear
            </ButtonLink>
          ) : null}
        </div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">
        {result.total} {result.total === 1 ? "product" : "products"}
      </p>
      {result.rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No products match" : "No products yet"}
          description={
            filtered
              ? "Try clearing a filter."
              : "Add a category, then your first product."
          }
          action={
            !filtered && can(actor, "products:write") ? (
              <ButtonLink href="/app/products/new">Add product</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <TableWrap label="Products">
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH>SKU</TH>
                <TH>Category</TH>
                <TH>Website</TH>
                <TH>Photos</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link
                      href={`/app/products/${p.id}`}
                      className="font-medium text-walnut underline"
                    >
                      {p.name}
                    </Link>
                    <div className="text-text-muted">
                      {p.kind === "made_to_order"
                        ? "Made to order"
                        : "Ready-made"}
                    </div>
                  </TD>
                  <TD className="tabular text-text-muted">{p.skus}</TD>
                  <TD>{p.categoryName}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {p.archivedAt ? (
                        <StatusBadge>Archived</StatusBadge>
                      ) : p.isPublished ? (
                        <StatusBadge tone="success">Published</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Draft</StatusBadge>
                      )}
                      {p.isFeatured && !p.archivedAt ? (
                        <StatusBadge tone="info">Featured</StatusBadge>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    {p.imageCount === 0 ? (
                      <StatusBadge tone="warning">None</StatusBadge>
                    ) : (
                      <span className="tabular">{p.imageCount}</span>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination
        page={page}
        pageCount={result.pageCount}
        hrefFor={(n) => href({ page: String(n) })}
      />
    </>
  );
}
