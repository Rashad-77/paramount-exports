import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { CatalogueBrowser } from "@/components/public/catalogue-browser";
import { PageIntro } from "@/components/public/prose";
import { customerAuthMode } from "@/lib/auth/customer";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { parseSort } from "@/lib/catalogue-sort";
import { toGroups } from "@/lib/category-tree";
import { PremiumBanner } from "@/components/public/premium";
import { listPremiumProducts, listPublicCategories, listPublicMaterials, listPublicProducts } from "@/server/catalogue-public";

const DESCRIPTION = "Browse solid wood furniture by category and material. Every piece is ready-made in our showroom, or can be made to your size.";

/** A search, a material filter or a sort order is only another way of looking at the same pieces: those are kept out of search results and point back. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);
  const variant = Boolean(one(sp.q) || one(sp.material) || (one(sp.sort) && parseSort(one(sp.sort)) !== "newest"));
  return {
    title: "Wood furniture collection" + (page > 1 ? ` (page ${page})` : ""),
    description: DESCRIPTION,
    alternates: { canonical: page > 1 && !variant ? `/products?page=${page}` : "/products" },
    robots: variant ? { index: false, follow: true } : undefined,
  };
}

// The page itself is built per request (it follows the search and filters in the address), but the catalogue reads it makes are shared and
// kept for a few minutes (see catalogue-public.ts), so a visitor rarely waits on the database. Searches are always read fresh.
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const category = one(sp.category);
  // The old address of a category (/products?category=dining-tables) now lives at /collections/dining-tables, for good.
  if (category) {
    const rest = new URLSearchParams();
    for (const k of ["q", "material", "sort", "page"]) {
      const v = one(sp[k]);
      if (v) rest.set(k, v);
    }
    const qs = rest.toString();
    permanentRedirect(`/collections/${encodeURIComponent(category)}${qs ? `?${qs}` : ""}`);
  }
  const material = one(sp.material);
  const sort = parseSort(one(sp.sort));
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const [business, accounts, categories, materials, result, premium] = await Promise.all([
    getBusinessSettings(),
    getAccountSettings(),
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
          wishlist={accounts.enabled && customerAuthMode() !== "off"}
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
