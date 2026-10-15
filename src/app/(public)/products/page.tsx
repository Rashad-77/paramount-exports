import type { Metadata } from "next";
import { CatalogueBrowser } from "@/components/public/catalogue-browser";
import { PageIntro } from "@/components/public/prose";
import { customerAuthMode } from "@/lib/auth/customer";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { parseSort } from "@/lib/catalogue-sort";
import { toGroups } from "@/lib/category-tree";
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
  const sort = parseSort(one(sp.sort));
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const [business, categories, materials, result] = await Promise.all([
    getBusinessSettings(),
    listPublicCategories(),
    listPublicMaterials(),
    listPublicProducts({ q, category, material, sort, page }),
  ]);

  // The wood types of the timber group come first, then any other material already used on a product.
  const timber = categories.find((c) => c.slug === "timber-and-wood-planks");
  const woodNames = timber ? categories.filter((c) => c.parentId === timber.id).map((c) => c.name) : [];
  const woods = [...woodNames, ...materials.filter((m) => !woodNames.some((w) => w.toLowerCase() === m.toLowerCase()))];

  return (
    <>
      <PageIntro
        plain
        title="Collection"
        lead="Ready-made pieces from the showroom. Don't see what you need? We can make it to your measurements."
        action={{ href: "/custom#quotation", label: "Request quotation" }}
      />
      <div className="bg-white pt-10 pb-16">
        <CatalogueBrowser
          wishlist={(await getAccountSettings()).enabled && customerAuthMode() !== "off"}
          categories={toGroups(categories)}
          materials={woods}
          initial={{ q: q ?? "", category: category ?? "", material: material ?? "", sort, page }}
          initialResult={result}
          currency={business.currency}
        />
      </div>
    </>
  );
}
