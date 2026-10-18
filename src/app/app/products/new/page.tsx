import { redirect } from "next/navigation";
import { ProductForm } from "@/components/app/product-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getBusinessSettings } from "@/lib/settings";
import { listCategories } from "@/server/catalogue";
import { createProductAction } from "../actions";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const actor = await requireActor();
  if (!can(actor, "products:write")) redirect("/app/products");
  const [allCats, business] = await Promise.all([listCategories(actor), getBusinessSettings()]);
  const cats = allCats.filter((c) => !c.archivedAt);
  return (
    <>
      <PageHeader title="Add product" />
      <Panel>
        {cats.length === 0 ? (
          <p className="text-sm">
            Create a category first on the{" "}
            <a className="underline" href="/app/categories">
              Categories
            </a>{" "}
            page.
          </p>
        ) : (
          <ProductForm
            action={createProductAction}
            categories={cats}
            currency={business.currency}
            submitLabel="Create product"
          />
        )}
      </Panel>
    </>
  );
}
