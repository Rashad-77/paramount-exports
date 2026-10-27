import type { Metadata } from "next";
import { CatalogueBrowser } from "@/components/public/catalogue-browser";
import { PageIntro } from "@/components/public/prose";
import { customerAuthMode } from "@/lib/auth/customer";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { parseSort } from "@/lib/catalogue-sort";
import { toGroups } from "@/lib/category-tree";
import { PremiumBanner } from "@/components/public/premium";
import { listPremiumProducts, listPublicCategories, listPublicMaterials, listPublicProducts } from "@/server/catalogue-public";

const DESCRIPTION = "Browse solid wood furniture by category and material. Every piece is ready-made in our showroom, or can be made to your size.";

/**
 * Each category is its own page for search engines (its own title, description and address), so someone searching for it can land on it.
 * A search, a material filter or a sort order is only another way of looking at the same pieces: those are kept out of the results and point back.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const slug = one(sp.category);
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);
  const variant = Boolean(one(sp.q) || one(sp.material) || (one(sp.sort) && parseSort(one(sp.sort)) !== "newest"));
  const found = slug ? (await listPublicCategories()).find((c) => c.slug === slug) : undefined;
  const path = found ? `/products?category=${encodeURIComponent(found.slug)}` : "/products";
  const paged = page > 1 && !variant ? `${path}${found ? "&" : "?"}page=${page}` : path;
  return {
    title: (found ? `${found.name} · Collection` : "Wood furniture collection") + (page > 1 ? ` (page ${page})` : ""),
    description: found ? (found.description?.trim().slice(0, 155) || `Browse ${found.name} from our collection of solid wood furniture. Ready-made pieces, or made to your measurements.`) : DESCRIPTION,
    alternates: { canonical: paged },
    // A category that does not exist, or a search, material or sort: show to visitors, not in search results.
    robots: variant || (slug && !found) ? { index: false, follow: true } : undefined,
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
