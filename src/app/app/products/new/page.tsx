import { redirect } from "next/navigation";
import { ProductForm } from "@/components/app/product-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { listCategories } from "@/server/catalogue";
import { createProductAction } from "../actions";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const actor = await requireActor();
  if (!can(actor, "products:write")) redirect("/app/products");
  const cats = (await listCategories(actor)).filter((c) => !c.archivedAt);
  return (
    <>
      <PageHeader title="Add product" description="You can add photographs and more options after saving." />
      <Panel>
        {cats.length === 0 ? (
          <p className="text-sm">
            Create a category first on the <a className="underline" href="/app/categories">Categories</a> page.
          </p>
        ) : (
          <ProductForm action={createProductAction} categories={cats} creating submitLabel="Create product" />
        )}
      </Panel>
    </>
  );
}
