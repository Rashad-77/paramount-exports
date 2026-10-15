"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CATALOGUE_SORTS, parseSort, type CatalogueSort } from "@/lib/catalogue-sort";
import { GlassCascade, type CascadeGroup } from "@/components/public/glass-cascade";
import { GlassSelect } from "@/components/public/glass-select";
import { ProductCard } from "@/components/public/product-card";
import type { PublicCard } from "@/server/catalogue-public";

export interface CatalogueResult {
  items: PublicCard[];
  total: number;
  page: number;
  pageCount: number;
}
export interface CatalogueFilters {
  q: string;
  category: string;
  material: string;
  sort: CatalogueSort;
  page: number;
}

/** The address that shows these filters; also what the page's own links use. */
function hrefFor(f: CatalogueFilters): string {
  const u = new URLSearchParams();
  if (f.q) u.set("q", f.q);
  if (f.category) u.set("category", f.category);
  if (f.material) u.set("material", f.material);
  if (f.sort !== "newest") u.set("sort", f.sort);
  if (f.page > 1) u.set("page", String(f.page));
  const s = u.toString();
  return s ? `/products?${s}` : "/products";
}

/**
 * The Collection page's filter bar and product list. Choosing a filter, or typing in the search box, narrows the list straight away:
 * only the products are fetched and swapped in (no page reload, no Enter key), the search waits a moment after the last key, and the
 * address bar follows so the result can be shared. Without scripting it is a plain form that reloads the page.
 */
export function CatalogueBrowser({
  categories,
  materials,
  initial,
  initialResult,
  currency,
  wishlist = false,
}: {
  categories: CascadeGroup[];
  materials: string[];
  initial: CatalogueFilters;
  initialResult: CatalogueResult;
  currency: string;
  /** Show the save-to-wishlist heart on each card (accounts are on). */
  wishlist?: boolean;
}) {
  const [f, setF] = useState<CatalogueFilters>(initial);
  /** The text in the search box right now; `f.q` follows it after a short pause. */
  const [typed, setTyped] = useState(initial.q);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const shown = useRef(JSON.stringify(initial));

  useEffect(() => {
    if (typed === f.q) return;
    const t = window.setTimeout(() => setF((cur) => ({ ...cur, q: typed.trim(), page: 1 })), 300);
    return () => window.clearTimeout(t);
  }, [typed, f.q]);

  useEffect(() => {
    const key = JSON.stringify(f);
    if (key === shown.current) return;
    const ctl = new AbortController();
    setLoading(true);
    const u = new URLSearchParams({ sort: f.sort, page: String(f.page) });
    if (f.q) u.set("q", f.q);
    if (f.category) u.set("category", f.category);
    if (f.material) u.set("material", f.material);
    fetch(`/api/catalogue?${u}`, { signal: ctl.signal, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<CatalogueResult>) : Promise.reject(new Error("failed"))))
      .then((data) => {
        shown.current = key;
        setResult(data);
        setFailed(false);
        setLoading(false);
        window.history.replaceState(null, "", hrefFor(f));
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFailed(true);
        setLoading(false);
      });
    return () => ctl.abort();
  }, [f]);

  const set = useCallback((patch: Partial<CatalogueFilters>) => setF((cur) => ({ ...cur, ...patch, page: patch.page ?? 1 })), []);
  const filtered = Boolean(f.q || f.category || f.material || typed);
  const clear = () => {
    setTyped("");
    setF((cur) => ({ ...cur, q: "", category: "", material: "", page: 1 }));
  };

  return (
    <>
      {/* The filter bar: a very light grey strip that runs the full width of the site, boxes aligned with the page content */}
      <div className="cat-strip">
        <div className="container-page">
          <form method="get" action="/products" className="cat-bar" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Filter the collection">
            <GlassCascade label="Category" allLabel="All categories" groups={categories} value={f.category} onChange={(category) => set({ category })} />
            <div className="cat-right">
              <GlassSelect label="Wood or material" value={f.material} onChange={(material) => set({ material })} options={[{ value: "", label: "All materials" }, ...materials.map((m) => ({ value: m, label: m }))]} />
              <GlassSelect
                label="Sort by"
                value={f.sort}
                onChange={(sort) => set({ sort: parseSort(sort) })}
                options={CATALOGUE_SORTS.map((s) => ({ value: s.value, label: s.label }))}
              />
              <div className="cat-searchwrap">
                <Search aria-hidden="true" className="cat-searchicon" strokeWidth={1.75} />
                <input
                  name="q"
                  type="search"
                  aria-label="Search products"
                  placeholder="Search name, wood or code"
                  className="cat-control cat-search"
                  maxLength={80}
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
              </div>
            </div>
            <noscript>
              <select name="category" aria-label="Category" defaultValue={f.category}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <optgroup key={c.slug} label={c.name}>
                    <option value={c.slug}>All {c.name}</option>
                    {c.children.map((k) => (
                      <option key={k.slug} value={k.slug}>
                        {k.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select name="material" aria-label="Wood or material" defaultValue={f.material}>
                <option value="">All materials</option>
                {materials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button type="submit" className="cat-clear">
                Show results
              </button>
            </noscript>
          </form>
        </div>
      </div>
      <div className="container-page">
        <div className="cat-meta">
          <p role="status" aria-live="polite" className="text-sm text-text-muted">
            {failed ? "The list could not be refreshed. Please try again." : result.total === 0 ? "No pieces to show" : `${result.total} ${result.total === 1 ? "piece" : "pieces"}`}
          </p>
          <button type="button" className="cat-clear" onClick={clear}>
            Clear filters
          </button>
        </div>

        <section aria-label="Products" aria-busy={loading} className={"mt-6 transition-opacity duration-200 " + (loading ? "opacity-50" : "")}>
          {result.items.length === 0 ? (
            <div className="border border-border bg-white px-6 py-14 text-center">
              <h2 className="font-display text-[1.5rem] text-text">{filtered ? "No pieces match those filters" : "Our collection is being prepared"}</h2>
              <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-text-muted">
                {filtered ? "Try removing a filter or searching for something broader." : "Check back soon, or tell us what you are looking for and we will help."}
              </p>
              {filtered ? (
                <button type="button" className="cat-clear mt-5" onClick={clear}>
                  Clear filters
                </button>
              ) : (
                <Link href="/custom#quotation" className="link-arrow mt-5 text-text">
                  Ask about custom furniture
                </Link>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
              {result.items.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} currency={currency} priority={i < 4} wishlist={wishlist} />
                </li>
              ))}
            </ul>
          )}

          {result.pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3 text-sm">
              {result.page > 1 ? (
                <a
                  href={hrefFor({ ...f, page: result.page - 1 })}
                  rel="prev"
                  className="cat-clear"
                  onClick={(e) => {
                    e.preventDefault();
                    set({ page: result.page - 1 });
                  }}
                >
                  Previous
                </a>
              ) : (
                <span aria-disabled="true" className="text-text-muted opacity-60">
                  Previous
                </span>
              )}
              <p className="text-text-muted">
                Page {result.page} of {result.pageCount}
              </p>
              {result.page < result.pageCount ? (
                <a
                  href={hrefFor({ ...f, page: result.page + 1 })}
                  rel="next"
                  className="cat-clear"
                  onClick={(e) => {
                    e.preventDefault();
                    set({ page: result.page + 1 });
                  }}
                >
                  Next
                </a>
              ) : (
                <span aria-disabled="true" className="text-text-muted opacity-60">
                  Next
                </span>
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </>
  );
}
