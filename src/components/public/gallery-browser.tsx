"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { GlassCascade, type CascadeGroup } from "./glass-cascade";
import { SiteImage } from "./site-image";

export type GalleryCategory = "showroom" | "workshop" | "projects";

export interface GalleryItem {
  id: string;
  category: GalleryCategory;
  /** Photograph URL, or null while a grey stand-in is shown. */
  src: string | null;
  alt: string;
  caption: string;
  /** Width ÷ height of the frame. Varied across items so the columns stagger. */
  ratio: number;
  /** The product category of the project, or null for stand-ins and uncategorised projects. */
  categorySlug: string | null;
  /** The group the category sits under, so choosing a group also shows its categories. */
  groupSlug?: string | null;
}

const CATEGORY_LABEL: Record<GalleryCategory, string> = { showroom: "Showroom", workshop: "Workshop", projects: "Project" };

/**
 * One gallery for everything: a staggered masonry of frames, and a full-screen viewer (native <dialog>: focus is
 * trapped, Esc closes, arrow keys move). Frames are grey stand-ins until real photographs are supplied.
 */
export function GalleryBrowser({ items, categories = [] }: { items: GalleryItem[]; categories?: CascadeGroup[] }) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const needle = query.trim().toLowerCase();
  const shown = items.filter((i) => (!category || i.categorySlug === category || i.groupSlug === category) && (!needle || i.caption.toLowerCase().includes(needle)));

  const show = (i: number) => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(i);
  };
  const step = useCallback(
    (d: 1 | -1) => setOpen((i) => (i === null ? i : (i + d + shown.length) % shown.length)),
    [shown.length],
  );

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const current = open !== null ? shown[open] : undefined;

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">The gallery</p>
          <h2 className="font-display mt-3 text-headline text-brand">Our work, up close.</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {categories.length > 0 ? (
            <GlassCascade label="Category" allLabel="All categories" groups={categories} value={category} onChange={setCategory} />
          ) : null}
          <div className="cat-searchwrap">
            <Search aria-hidden="true" className="cat-searchicon" strokeWidth={1.75} />
            <input
              type="search"
              aria-label="Search the gallery"
              placeholder="Search projects"
              className="cat-control cat-search"
              maxLength={80}
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {shown.length === 0 ? <p className="mt-10 text-text-muted">No projects match. Try another word, or choose a different category.</p> : null}

      <ul key={category + needle} className="gal-grid mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item, i) => (
          <li key={item.id}>
            <button type="button" className="gal-tile" style={{ aspectRatio: item.ratio }} onClick={() => show(i)} aria-label={`View larger: ${item.caption}`}>
              {item.src ? <SiteImage src={item.src} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" /> : null}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className="gal-dialog"
        aria-label="Gallery viewer"
        onClose={() => {
          setOpen(null);
          opener.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onClick={(e) => e.target === dialog.current && setOpen(null)}
      >
        {current ? (
          <div className="gal-stage">
            <button type="button" className="gal-btn gal-close" aria-label="Close viewer" onClick={() => setOpen(null)}>
              <X aria-hidden="true" className="size-6" strokeWidth={1.5} />
            </button>
            <button type="button" className="gal-btn gal-prev" aria-label="Previous photograph" onClick={() => step(-1)}>
              <ChevronLeft aria-hidden="true" className="size-9" strokeWidth={1.25} />
            </button>
            <figure className="gal-fig">
              <div className="gal-frame" style={{ aspectRatio: current.ratio, "--r": current.ratio } as CSSProperties}>
                {current.src ? (
                  <SiteImage src={current.src} alt={current.alt} fill sizes="90vw" className="object-contain" priority />
                ) : (
                  <span className="gal-ph">Photo to be supplied</span>
                )}
              </div>
              <figcaption>
                <span className="gal-cat">{CATEGORY_LABEL[current.category]}</span>
                <span className="gal-title">{current.caption}</span>
                <span className="gal-count" aria-live="polite">
                  {String((open ?? 0) + 1).padStart(2, "0")} / {String(shown.length).padStart(2, "0")}
                </span>
              </figcaption>
            </figure>
            <button type="button" className="gal-btn gal-next" aria-label="Next photograph" onClick={() => step(1)}>
              <ChevronRight aria-hidden="true" className="size-9" strokeWidth={1.25} />
            </button>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
