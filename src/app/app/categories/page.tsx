import { CategoriesTable } from "@/components/app/categories-table";
import { CategoryFilters } from "@/components/app/category-filters";
import { EditProvider, EditToggle } from "@/components/app/edit-mode";
import { ButtonLink } from "@/components/ui/button";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { treeOrder } from "@/lib/category-tree";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { listCategories } from "@/server/catalogue";
import { archiveCategoriesAction, deleteCategoriesAction } from "./actions";

export const metadata = { title: "Categories" };

const STATUSES = ["visible", "hidden", "archived"] as const;

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const group = one(sp.group);
  const statuses = STATUSES.filter((s) =>
    (Array.isArray(sp.status) ? sp.status : sp.status ? [sp.status] : []).includes(s),
  );
  const flat = await listCategories(actor);
  const all = treeOrder(flat);
  const canWrite = can(actor, "products:write");

  // Visible, hidden and archived: any of those picked. Nothing picked: everything that is not archived.
  const wanted = (c: (typeof all)[number]) => {
    const state = c.archivedAt ? "archived" : c.isActive ? "visible" : "hidden";
    return statuses.length === 0 ? state !== "archived" : statuses.includes(state);
  };
  const needle = q?.toLowerCase();
  const rows = all.filter((c) => {
    if (!wanted(c)) return false;
    if (group && c.id !== group && c.parentId !== group) return false;
    return !needle || c.name.toLowerCase().includes(needle);
  });
  const filtered = Boolean(q || group || statuses.length);

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
  const subcategories = (id: string) => flat.filter((k) => k.parentId === id && !k.archivedAt);
  const productTotal = (c: (typeof all)[number]) => c.productCount + (c.depth === 0 ? subcategories(c.id).reduce((n, k) => n + k.productCount, 0) : 0);

  return (
    <EditProvider>
      <ModuleHeader
        href="/app/categories"
        actions={
          canWrite ? (
            <>
              {filtered ? (
                <ButtonLink href={clearHref} variant="ghost">
                  Clear filters
                </ButtonLink>
              ) : null}
              <EditToggle />
              <ButtonLink href="/app/categories/new">Add category</ButtonLink>
            </>
          ) : null
        }
      />
      <CategoryFilters
        q={q}
        group={group}
        statuses={statuses}
        groups={flat
          .filter((g) => !g.parentId && !g.archivedAt)
          .map((g) => ({ id: g.id, name: g.name }))}
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
              <ButtonLink href="/app/categories/new">Add category</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <CategoriesTable
          rows={rows.map((c, i) => ({
            id: c.id,
            name: c.name,
            number: numbers.get(c.id) ?? "",
            depth: c.depth,
            groupName: c.groupName,
            // The group is named on a subcategory only when the row above is not that group or one of its subcategories.
            showGroup: !(rows[i - 1] && (rows[i - 1]!.id === c.parentId || rows[i - 1]!.parentId === c.parentId)),
            productCount: productTotal(c),
            isActive: c.isActive,
            archived: c.archivedAt !== null,
          }))}
          total={rows.length}
          canWrite={canWrite}
          archiveAction={archiveCategoriesAction}
          deleteAction={deleteCategoriesAction}
        />
      )}
    </EditProvider>
  );
}
