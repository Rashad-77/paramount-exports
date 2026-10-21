import { DisplayOrderDialog } from "@/components/app/display-order-dialog";
import { AddCategoryDialog } from "@/components/app/add-category-dialog";
import { CategoriesTable } from "@/components/app/categories-table";
import { CategoryFilters } from "@/components/app/category-filters";
import { EditProvider, EditToggle } from "@/components/app/edit-mode";
import { ButtonLink } from "@/components/ui/button";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { toCascadeGroups, treeOrder } from "@/lib/category-tree";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { listCategories } from "@/server/catalogue";
import { archiveCategoriesAction, createCategoryAction, deleteCategoriesAction, reorderCategoriesAction } from "./actions";

export const metadata = { title: "Categories" };

const STATUSES = ["visible", "archived"] as const;

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const categoryIds = (
    Array.isArray(sp.category) ? sp.category : sp.category ? [sp.category] : []
  ).filter((c) => /^[0-9a-f-]{36}$/i.test(c));
  const statuses = STATUSES.filter((s) =>
    (Array.isArray(sp.status)
      ? sp.status
      : sp.status
        ? [sp.status]
        : []
    ).includes(s),
  );
  const flat = await listCategories(actor);
  const all = treeOrder(flat);
  const canWrite = can(actor, "products:write");
  const mainGroups = flat.filter((g) => !g.parentId && !g.archivedAt).map((g) => ({ id: g.id, name: g.name }));
  const orderItems = mainGroups.map((g) => ({ id: g.id, name: g.name, subcategories: flat.filter((k) => k.parentId === g.id && !k.archivedAt).length }));
  const add = canWrite && one(sp.add) === "1";

  // Visible and archived: either picked. Nothing picked: everything.
  // A subcategory follows the main category it sits under: archived there means archived here.
  const byId = new Map(flat.map((c) => [c.id, c]));
  const stateOf = (c: (typeof all)[number]) => {
    const own = c.archivedAt ? "archived" : "visible";
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    const state = own === "archived" || parent?.archivedAt ? "archived" : "visible";
    return { state, inherited: state !== own } as const;
  };
  const wanted = (c: (typeof all)[number]) => {
    const { state } = stateOf(c);
    return statuses.length === 0 || statuses.includes(state);
  };
  const needle = q?.toLowerCase();
  const rows = all.filter((c) => {
    if (!wanted(c)) return false;
    // A ticked main category stands for the subcategories under it.
    if (
      categoryIds.length &&
      !categoryIds.includes(c.id) &&
      !(c.parentId && categoryIds.includes(c.parentId))
    )
      return false;
    return !needle || c.name.toLowerCase().includes(needle);
  });
  const filtered = Boolean(q || categoryIds.length || statuses.length);

  const clearHref = "/app/categories";

  // Numbers follow the whole list, so a row keeps its number whatever the filters show: 1, 2, 3 and 1.1, 1.2 under 1.
  const numbers = new Map<string, string>();
  let main = 0;
  let sub = 0;
  for (const c of all) {
    if (c.depth === 0) {
      main++;
      sub = 0;
      numbers.set(c.id, String(main));
    } else {
      sub++;
      numbers.set(c.id, `${main}.${sub}`);
    }
  }
  // A main category's product count includes the products in its subcategories.
  const subcategories = (id: string) =>
    flat.filter((k) => k.parentId === id && !k.archivedAt);
  const productTotal = (c: (typeof all)[number]) =>
    c.productCount +
    (c.depth === 0
      ? subcategories(c.id).reduce((n, k) => n + k.productCount, 0)
      : 0);

  return (
    <EditProvider>
      <div className="max-w-6xl">
        <ModuleHeader
          href="/app/categories"
          actions={
            canWrite ? (
              <>
                {/* Always in place, so the buttons beside it do not move when it appears. */}
                <span
                  className={filtered ? undefined : "invisible"}
                  inert={!filtered}
                >
                  <ButtonLink href={clearHref} variant="ghost">
                    Clear filters
                  </ButtonLink>
                </span>
                <EditToggle />
              {orderItems.length > 1 ? <DisplayOrderDialog action={reorderCategoriesAction} items={orderItems} /> : null}
                <AddCategoryDialog action={createCategoryAction} groups={mainGroups} defaultOpen={add} />
              </>
            ) : null
          }
        />
        <CategoryFilters
          q={q}
          categoryIds={categoryIds}
          statuses={statuses}
          categories={toCascadeGroups(flat)}
        />
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No categories match" : "No categories yet"}
            description={
              filtered
                ? "Try clearing a filter."
                : "Add the first one to start building the catalogue."
            }
            action={
              !filtered && canWrite ? (
                <AddCategoryDialog action={createCategoryAction} groups={mainGroups} defaultOpen={add} />
              ) : undefined
            }
          />
        ) : (
          <CategoriesTable
            rows={rows.map((c, i) => ({
              id: c.id,
              name: c.name,
              number: numbers.get(c.id) ?? "",
              parentId: c.parentId,
              depth: c.depth,
              groupName: c.groupName,
              // The group is named on a subcategory only when the row above is not that group or one of its subcategories.
              showGroup: !(
                rows[i - 1] &&
                (rows[i - 1]!.id === c.parentId ||
                  rows[i - 1]!.parentId === c.parentId)
              ),
              productCount: productTotal(c),
              status: stateOf(c).state,
              inherited: stateOf(c).inherited,
              isActive: c.isActive,
              archived: c.archivedAt !== null,
            }))}
            total={rows.length}
            canWrite={canWrite}
            archiveAction={archiveCategoriesAction}
            deleteAction={deleteCategoriesAction}
          />
        )}
      </div>
    </EditProvider>
  );
}
