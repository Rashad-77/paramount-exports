"use client";

import { ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { ReviewAvatar } from "@/components/public/review-avatar";
import { SiteImage } from "@/components/public/site-image";
import { Dialog } from "@/components/ui/dialog";
import type { ViewerReview } from "./reviews-viewer";

/**
 * The pop-up that lists every review in full, and the larger view of a review's photographs. It drops in from the top of the screen.
 * Loaded only when someone opens it (see ReviewsViewer), so the long list is not part of the page until it is wanted.
 */
export function ReviewsDialog({ reviews, open, focusId, onClose }: { reviews: ViewerReview[]; open: boolean; focusId: string | null; onClose: () => void }) {
  // The photo being looked at larger: the review's photos (null is a stand-in tile) and which one.
  const [box, setBox] = useState<{ name: string; items: (string | null)[]; index: number } | null>(null);

  // Once the pop-up is on screen, bring the chosen review into view (or start from the top when none was chosen).
  useEffect(() => {
    if (!open) return;
    if (!focusId) {
      const top = document.querySelector<HTMLElement>(".rv-all");
      if (top) top.scrollTop = 0;
      return;
    }
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`.rv-all [data-review="${CSS.escape(focusId)}"]`);
      // A jump, not a glide: the pop-up is still dropping in, and the review should already be in place when it lands.
      el?.scrollIntoView({ block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, focusId]);

  const rated = reviews.filter((r) => r.stars);
  const average = rated.length ? rated.reduce((sum, r) => sum + (r.stars ?? 0), 0) / rated.length : 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="What our customers say"
        description={`${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}${average ? `, rated ${average.toFixed(1)} out of 5 on average` : ""}`}
        wide
        className="rv-all"
      >
        <ul className="space-y-5">
          {reviews.map((r) => (
            <li key={r.id} data-review={r.id} data-focus={r.id === focusId ? "true" : undefined} className="border border-border p-4">
              {r.date ? <time className="rv-date">{r.date}</time> : null}
              <div className="mt-2 flex items-center gap-3">
                <ReviewAvatar src={r.avatar} />
                <div className="min-w-0">
                  <p className="rv-name">{r.name ?? "A customer"}</p>
                  {r.city ? <p className="rv-city">{r.city}</p> : null}
                </div>
              </div>
              {r.stars ? (
                <div role="img" aria-label={`${r.stars} out of 5 stars`} className="mt-3 flex gap-0.5 text-[#e8a200]">
                  {Array.from({ length: 5 }, (_, n) => (
                    <Star key={n} aria-hidden="true" className="size-4" strokeWidth={1.25} fill={n < r.stars! ? "#fbbc04" : "none"} />
                  ))}
                </div>
              ) : null}
              {r.quote.trim() ? <p className="rv-quote mt-3 whitespace-pre-line">{r.quote}</p> : null}
              {r.photos.length > 0 || r.samplePhotos > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Photos from ${r.name ?? "this customer"}`}>
                  {[...r.photos, ...Array.from({ length: r.samplePhotos }, () => null)].map((src, k, all) => (
                    <li key={src ?? `sample-${k}`} className="relative size-20 overflow-hidden border border-border">
                      {src ? <SiteImage src={src} alt="" fill sizes="80px" className="object-cover" /> : <ImagePlaceholder label="Sample customer photo" className="absolute inset-0" />}
                      <button
                        type="button"
                        onClick={() => setBox({ name: r.name ?? "a customer", items: all, index: k })}
                        aria-haspopup="dialog"
                        aria-label={`View photo ${k + 1} of ${all.length} from ${r.name ?? "a customer"} larger`}
                        className="rv-thumb absolute inset-0 cursor-zoom-in"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </Dialog>
      {box ? <Lightbox name={box.name} items={box.items} start={box.index} onClose={() => setBox(null)} /> : null}
    </>
  );
}

/** One review photo at a large size on a dark backdrop: arrows (or the arrow keys) step through that review's photos, Escape or a click outside closes it. */
function Lightbox({ name, items, start, onClose }: { name: string; items: (string | null)[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(start);
  const n = items.length;
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const go = (d: number) => setI((v) => (v + d + n) % n);
  const src = items[i];
  const arrow = "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.8)]";
  return (
    <dialog
      ref={ref}
      aria-label={`Photos from ${name}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="rv-lightbox"
    >
      <div className="relative h-[min(78vh,46rem)] w-[min(92vw,64rem)]">
        {src ? <SiteImage src={src} alt={`Photo ${i + 1} of ${n} from ${name}`} fill sizes="92vw" className="object-contain" /> : <ImagePlaceholder label="Sample customer photo" className="absolute inset-0" />}
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close photo" className="absolute -top-12 right-0 grid size-11 place-items-center text-white">
          <X aria-hidden="true" className="size-6" />
        </button>
        {n > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={arrow + " left-2"}>
              <ChevronLeft aria-hidden="true" className="size-8" strokeWidth={1.75} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={arrow + " right-2"}>
              <ChevronRight aria-hidden="true" className="size-8" strokeWidth={1.75} />
            </button>
            <p className="absolute -bottom-9 left-0 right-0 text-center text-xs tracking-[0.2em] text-white" aria-live="polite">
              {i + 1} / {n}
            </p>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
