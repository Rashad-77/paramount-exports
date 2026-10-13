import type { Metadata } from "next";
import { CatalogueBrowser } from "@/components/public/catalogue-browser";
import { PageIntro } from "@/components/public/prose";
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

  return (
    <>
      <PageIntro plain title="Collection" lead="Ready-made pieces from the showroom. Don't see what you need? We can make it to your measurements." />
      <div className="container-page py-10 pb-16">
        <CatalogueBrowser
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          materials={materials}
          initial={{ q: q ?? "", category: category ?? "", material: material ?? "", sort, page }}
          initialResult={result}
          currency={business.currency}
        />
      </div>
    </>
  );
}
