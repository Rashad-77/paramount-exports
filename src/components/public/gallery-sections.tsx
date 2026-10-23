"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "./reveal";
import { SiteImage } from "./site-image";

export interface GalleryPhoto {
  id: string;
  url: string;
  alt: string;
}

export interface GallerySectionData {
  /** Id of the heading (for aria-labelledby). */
  id: string;
  /** Id of the section itself, so other pages can link to it (#showroom, #workshop). */
  anchor: string;
  eyebrow: string;
  title: string;
  /** What the viewer calls a photograph of this section. */
  label: string;
  photos: GalleryPhoto[];
}

/** Every frame is the same shape, so the grid stays tidy. */
const RATIO = 4 / 3;
/** A section always shows at least this many frames; the ones with no photograph yet stay empty. */
const MIN_FRAMES = 6;

/**
 * The Gallery page's two sections, the showroom and the workshop: an even grid of frames each, and a full-screen viewer (native <dialog>:
 * focus is trapped, Esc closes, arrow keys move) that steps through the photographs of the section that was opened.
 */
export function GallerySections({ sections }: { sections: GallerySectionData[] }) {
  const [open, setOpen] = useState<{ s: number; i: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const section = open ? sections[open.s] : undefined;
  const list = section?.photos ?? [];

  const show = (s: number, i: number) => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen({ s, i });
  };
  const step = useCallback((d: 1 | -1) => setOpen((o) => (o ? { ...o, i: (o.i + d + (sections[o.s]?.photos.length || 1)) % (sections[o.s]?.photos.length || 1) } : o)), [sections]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const current = open ? list[open.i] : undefined;

  return (
    <>
      {sections.map((s, si) => (
        <section key={s.anchor} id={s.anchor} aria-labelledby={s.id} className={"scroll-mt-20 bg-white section-y" + (si > 0 ? " border-t border-border" : "")}>
          <div className="container-page">
            <Reveal variant="fade">
              <p className="eyebrow">{s.eyebrow}</p>
              <h2 id={s.id} className="font-display mt-3 text-headline text-brand">
                {s.title}
              </h2>
            </Reveal>
            <ul className="gal-grid mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.photos.map((p, i) => (
                <li key={p.id}>
                  <button type="button" className="gal-tile" style={{ aspectRatio: RATIO }} onClick={() => show(si, i)} aria-label={`View larger: ${s.label} ${i + 1} of ${s.photos.length}`}>
                    <SiteImage src={p.url} alt="" fill priority={si === 0 && i < 2} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                  </button>
                </li>
              ))}
              {Array.from({ length: Math.max(0, MIN_FRAMES - s.photos.length) }, (_, k) => (
                <li key={`empty-${k}`} aria-hidden="true">
                  <div className="gal-tile" style={{ aspectRatio: RATIO }} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

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
        {current && section && open ? (
          <div className="gal-stage">
            <button type="button" className="gal-btn gal-close" aria-label="Close viewer" onClick={() => setOpen(null)}>
              <X aria-hidden="true" className="size-6" strokeWidth={1.5} />
            </button>
            {list.length > 1 ? (
              <button type="button" className="gal-btn gal-prev" aria-label="Previous photograph" onClick={() => step(-1)}>
                <ChevronLeft aria-hidden="true" className="size-9" strokeWidth={1.25} />
              </button>
            ) : null}
            <figure className="gal-fig">
              <div className="gal-frame" style={{ aspectRatio: RATIO, "--r": RATIO } as CSSProperties}>
                <SiteImage src={current.url} alt={current.alt} fill sizes="90vw" className="object-contain" priority />
              </div>
              <figcaption>
                <span className="gal-cat">{section.eyebrow.replace(/^The /, "")}</span>
                <span className="gal-title">{section.title.replace(/\.$/, "")}</span>
                <span className="gal-count" aria-live="polite">
                  {String(open.i + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
                </span>
              </figcaption>
            </figure>
            {list.length > 1 ? (
              <button type="button" className="gal-btn gal-next" aria-label="Next photograph" onClick={() => step(1)}>
                <ChevronRight aria-hidden="true" className="size-9" strokeWidth={1.25} />
              </button>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
