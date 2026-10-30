import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs, type Crumb } from "@/components/public/breadcrumbs";
import { CatalogueBrowser } from "@/components/public/catalogue-browser";
import { PageIntro } from "@/components/public/prose";
import { customerAuthMode } from "@/lib/auth/customer";
import { parseSort } from "@/lib/catalogue-sort";
import { toGroups } from "@/lib/category-tree";
import { publicEnv } from "@/lib/env";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { breadcrumbLd, collectionLd, placeOf } from "@/lib/structured-data";
import { listPublicCategories, listPublicMaterials, listPublicProducts } from "@/server/catalogue-public";

// Like the Collection page: built per request (the filters are in the address), reading the catalogue from the shared, kept copies.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** The intro as a search result shows it: whole sentence(s) if they fit in 155 characters, otherwise cut at a word and ended with "…". */
function snippet(text: string | null | undefined): string | undefined {
  const t = text?.trim().replace(/\s+/g, " ");
  if (!t) return undefined;
  if (t.length <= 155) return t;
  const cut = t.slice(0, 154);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 100)).replace(/[\s,;:.-]+$/, "")}…`;
}

/**
 * A category's own page: its own address (/collections/dining-tables), title, description, heading and introduction, so that someone searching for
 * the category can land on it. A search, a material filter or a sort order inside it is only another view of the same pieces: those stay out of search results.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp, cats, business] = await Promise.all([params, searchParams, listPublicCategories(), getBusinessSettings()]);
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found", robots: { index: false, follow: false } };
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);
  const variant = Boolean(one(sp.q) || one(sp.material) || (one(sp.sort) && parseSort(one(sp.sort)) !== "newest"));
  const place = placeOf(business.address);
  const path = `/collections/${encodeURIComponent(cat.slug)}`;
  const description = snippet(cat.description) ||`${cat.name}: solid wood furniture${place ? ` made in ${place}` : ""}. Ready-made from our workshop, or built to your measurements.`;
  return {
    title: `${cat.name} · Solid wood furniture${page > 1 ? ` (page ${page})` : ""}`,
    description,
    alternates: { canonical: page > 1 && !variant ? `${path}?page=${page}` : path },
    openGraph: { title: cat.name, description, url: path, type: "website" },
    robots: variant ? { index: false, follow: true } : undefined,
  };
}

export default async function CollectionCategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const q = one(sp.q)?.slice(0, 80);
  const material = one(sp.material);
  const sort = parseSort(one(sp.sort));
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);

  const [business, accounts, categories, materials, result] = await Promise.all([
    getBusinessSettings(),
    getAccountSettings(),
    listPublicCategories(),
    listPublicMaterials(),
    listPublicProducts({ q, category: slug, material, sort, page }),
  ]);
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();

  const parent = cat.parentId ? categories.find((c) => c.id === cat.parentId) : undefined;
  const subs = categories.filter((c) => c.parentId === cat.id && c.count > 0);
  // Where else to go from here: the other main categories (and, on a subcategory, its neighbours).
  const others = categories.filter((c) => c.id !== cat.id && c.id !== parent?.id && c.count > 0 && (parent ? c.parentId === parent.id : !c.parentId));
  const trail: Crumb[] = [{ name: "Home", href: "/" }, { name: "Collection", href: "/products" }, ...(parent ? [{ name: parent.name, href: `/collections/${parent.slug}` }] : []), { name: cat.name, href: `/collections/${cat.slug}` }];
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const place = placeOf(business.address);
  const intro = cat.description?.trim();

  return (
    <>
      <JsonLd
        data={[
          collectionLd(site, { name: cat.name, path: `/collections/${cat.slug}`, description: intro || undefined, items: result.items.map((p) => ({ name: p.name, path: `/products/${p.slug}` })) }),
          breadcrumbLd(site, trail.map((c) => ({ name: c.name, path: c.href }))),
        ]}
      />
      <PageIntro back={{ href: "/", to: "home" }} plain title={cat.name} lead="Ready-made pieces from our workshop. Don't see what you need? We can make it to your measurements." eyebrow="Collection" action={{ href: "/custom#quotation", label: "Request quotation" }} />
      <div className="bg-white pt-8 pb-16">
        <Breadcrumbs trail={trail} className="container-page mb-6" />
        <CatalogueBrowser
          key={cat.slug}
          wishlist={accounts.enabled && customerAuthMode() !== "off"}
          categories={toGroups(categories)}
          materials={materials}
          initial={{ q: q ?? "", category: cat.slug, material: material ?? "", sort, page }}
          initialResult={result}
          currency={business.currency}
        />

        {/* About the category, and the other places to go from here: real links, so visitors and search engines can follow them. */}
        <section aria-labelledby="about-category" className="container-page mt-16 grid gap-10 border-t border-border pt-12 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 id="about-category" className="font-display text-[clamp(1.225rem,calc(1.225rem_+_(100vw_-_375px)_*_0.02137),1.75rem)] leading-tight text-walnut">
              About our {cat.name.toLowerCase()}
            </h2>
            <p className="mt-4 max-w-prose text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">
              {intro ?? `${cat.name} made from solid wood${place ? ` in ${place}` : ""}. Choose a ready-made piece from our workshop, or tell us the size, wood and finish you want and we will make it for you.`}
            </p>
            <p className="mt-4 text-sm">
              <Link href="/custom#quotation" className="link-arrow text-text">
                Have {cat.name.toLowerCase()} made to your measurements
              </Link>
            </p>
          </div>
          {subs.length > 0 || others.length > 0 ? (
            <div className="space-y-8">
              {subs.length > 0 ? (
                <nav aria-label={`Types of ${cat.name.toLowerCase()}`}>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Types of {cat.name.toLowerCase()}</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {subs.map((c) => (
                      <li key={c.id}>
                        <Link href={`/collections/${c.slug}`} className="underline-offset-2 hover:underline">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
              {others.length > 0 ? (
                <nav aria-label="More of the collection">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{parent ? `More ${parent.name.toLowerCase()}` : "More of the collection"}</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {others.map((c) => (
                      <li key={c.id}>
                        <Link href={`/collections/${c.slug}`} className="underline-offset-2 hover:underline">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
