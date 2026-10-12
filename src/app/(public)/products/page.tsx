import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/public/product-card";
import { PageIntro } from "@/components/public/prose";
import { ButtonLink, Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { getBusinessSettings } from "@/lib/settings";
import { listPublicCategories, listPublicMaterials, listPublicProducts } from "@/server/catalogue-public";

export const metadata: Metadata = {
  title: "Collection",
  description: "Browse our wood furniture by category, material and finish.",
  alternates: { canonical: "/products" },
};

// Search results are per-request; the underlying pages stay fast through the database indexes.
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const category = one(sp.category);
  const material = one(sp.material);
  const sort = one(sp.sort) === "name" ? "name" : "newest";
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const [business, categories, materials, result] = await Promise.all([
    getBusinessSettings(),
    listPublicCategories(),
    listPublicMaterials(),
    listPublicProducts({ q, category, material, sort, page }),
  ]);

  const params = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { q, category, material, sort: sort === "name" ? "name" : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/products?${s}` : "/products";
  };
  const filtered = Boolean(q || category || material);

  return (
    <>
      <PageIntro title="Collection" lead="Ready-made pieces from the showroom. Don't see what you need? We can make it to your measurements." />
      <div className="container-page pb-8">
        {categories.length > 0 ? (
          <nav aria-label="Categories" className="mb-6 flex flex-wrap gap-2">
            <Link href={params({ category: undefined, page: undefined })} aria-current={!category ? "page" : undefined} className={chip(!category)}>
              All
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={params({ category: c.slug, page: undefined })} aria-current={category === c.slug ? "page" : undefined} className={chip(category === c.slug)}>
                {c.name}
              </Link>
            ))}
          </nav>
        ) : null}

        <form method="get" action="/products" className="grid gap-4 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
          <TextField showOptional={false} label="Search" name="q" type="search" defaultValue={q} placeholder="Name, wood or code" />
          <SelectField
            showOptional={false}
            label="Wood / material"
            name="material"
            defaultValue={material ?? ""}
            options={materials.map((m) => ({ value: m, label: m }))}
            placeholder="Any"
          />
          <SelectField
            showOptional={false}
            label="Sort by"
            name="sort"
            defaultValue={sort}
            options={[
              { value: "newest", label: "Newest" },
              { value: "name", label: "Name (A–Z)" },
            ]}
          />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <div className="flex gap-2">
            <Button type="submit">Apply</Button>
            {filtered ? (
              <ButtonLink href="/products" variant="ghost">
                Clear
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </div>

      <section aria-label="Products" className="container-page pb-16">
        <p className="mb-6 text-sm text-text-muted" role="status">
          {result.total === 0 ? "No pieces to show" : `${result.total} ${result.total === 1 ? "piece" : "pieces"}`}
        </p>
        {result.items.length === 0 ? (
          <EmptyState
            title={filtered ? "No pieces match those filters" : "Our collection is being prepared"}
            description={filtered ? "Try removing a filter or searching for something broader." : "Check back soon, or tell us what you are looking for and we will help."}
            action={<ButtonLink href={filtered ? "/products" : "/custom"}>{filtered ? "Clear filters" : "Ask about custom furniture"}</ButtonLink>}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} currency={business.currency} priority={i < 4} />
              </li>
            ))}
          </ul>
        )}
        <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(n) => params({ page: String(n) })} />
      </section>
    </>
  );
}

function chip(active: boolean) {
  return (
    "inline-flex min-h-10 items-center rounded-[var(--radius-md)] border px-4 text-sm " +
    (active ? "border-walnut bg-walnut text-ivory" : "border-border-strong hover:bg-linen")
  );
}
