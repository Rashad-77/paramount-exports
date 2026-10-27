import type { Metadata } from "next";
import { CatalogueBrowser } from "@/components/public/catalogue-browser";
import { PageIntro } from "@/components/public/prose";
import { customerAuthMode } from "@/lib/auth/customer";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { parseSort } from "@/lib/catalogue-sort";
import { toGroups } from "@/lib/category-tree";
import { PremiumBanner } from "@/components/public/premium";
import { listPremiumProducts, listPublicCategories, listPublicMaterials, listPublicProducts } from "@/server/catalogue-public";

export const metadata: Metadata = {
  title: "Collection",
  description: "Browse our wood furniture by category, material and finish.",
  alternates: { canonical: "/products" },
};

// The page itself is built per request (it follows the search and filters in the address), but the catalogue reads it makes are shared and
// kept for a few minutes (see catalogue-public.ts), so a visitor rarely waits on the database. Searches are always read fresh.
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const category = one(sp.category);
  const material = one(sp.material);
  const sort = parseSort(one(sp.sort));
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const [business, categories, materials, result, premium] = await Promise.all([
    getBusinessSettings(),
    listPublicCategories(),
    listPublicMaterials(),
    listPublicProducts({ q, category, material, sort, page }),
    listPremiumProducts(1),
  ]);

  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }}
        plain
        title="Collection"
        lead="Ready-made pieces from the showroom. Don't see what you need? We can make it to your measurements."
        action={{ href: "/custom#quotation", label: "Request quotation" }}
      />
      <div className="bg-white pt-10 pb-16">
        {premium[0] ? <PremiumBanner /> : null}
        <CatalogueBrowser
          wishlist={(await getAccountSettings()).enabled && customerAuthMode() !== "off"}
          categories={toGroups(categories)}
          materials={materials}
          initial={{ q: q ?? "", category: category ?? "", material: material ?? "", sort, page }}
          initialResult={result}
          currency={business.currency}
        />
      </div>
    </>
  );
}
