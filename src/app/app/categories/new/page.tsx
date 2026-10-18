import { redirect } from "next/navigation";
import { CategoryForm } from "@/components/app/category-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { listCategories } from "@/server/catalogue";
import { createCategoryAction } from "../actions";

export const metadata = { title: "Add category" };

export default async function NewCategoryPage() {
  const actor = await requireActor();
  if (!can(actor, "products:write")) redirect("/app/categories");
  const groups = (await listCategories(actor))
    .filter((g) => !g.parentId && !g.archivedAt)
    .map((g) => ({ id: g.id, name: g.name }));
  return (
    <>
      <PageHeader title="Add category" />
      <Panel>
        <CategoryForm
          action={createCategoryAction}
          groups={groups}
          submitLabel="Add category"
        />
      </Panel>
    </>
  );
}
