import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/app/category-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { listCategories } from "@/server/catalogue";
import { updateCategoryAction } from "../actions";

export const metadata = { title: "Category" };

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireActor();
  const flat = await listCategories(actor);
  const category = flat.find((c) => c.id === id);
  if (!category) notFound();
  const canWrite = can(actor, "products:write");
  // A category can sit under a group, never under itself, and a group that has categories under it cannot go under another group.
  const hasChildren = flat.some((c) => c.parentId === id);
  const groups = hasChildren
    ? []
    : flat
        .filter((g) => !g.parentId && !g.archivedAt && g.id !== id)
        .map((g) => ({ id: g.id, name: g.name }));
  return (
    <>
      <PageHeader back={{ href: "/app/categories", to: "categories" }}
        title={category.name}
        description={`/${category.slug}`}
        actions={category.archivedAt ? <StatusBadge>Archived</StatusBadge> : undefined}
      />
      <Panel>
        {canWrite ? (
          <CategoryForm
            action={updateCategoryAction}
            groups={groups}
            values={{
              id: category.id,
              name: category.name,
              parentId: category.parentId,
              description: category.description,
              sortOrder: category.sortOrder,
              isActive: category.isActive,
            }}
            submitLabel="Save changes"
          />
        ) : (
          <p className="text-sm text-text-muted">
            You can view this category but not edit it.
          </p>
        )}
      </Panel>
    </>
  );
}
