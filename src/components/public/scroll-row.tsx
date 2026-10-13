"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * An endless row of cards: the cards are laid out three times and, whenever the row drifts out of the middle copy, it is moved
 * back by exactly one copy's width (invisibly, because the copies are identical), so it never reaches an end. Previous / next
 * buttons are always visible, black, and centred on the photographs; each press moves about one card. The row also scrolls by
 * touch, trackpad and keyboard. The two extra copies are hidden from assistive technology and cannot be tabbed to.
 *
 * `photoRatio` is the photograph's height ÷ width and `cardWidth` the card's CSS width, used to centre the buttons on the photos.
 */
export function ScrollRow({ label, children, cardWidth, photoRatio }: { label: string; children: ReactNode; cardWidth: string; photoRatio: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  /** Width of one copy of the cards, measured as the distance between the first card of copy 1 and of copy 2. */
  const setWidth = useCallback(() => {
    const el = ref.current;
    const a = el?.querySelector<HTMLElement>('[data-copy="0"] > :first-child');
    const b = el?.querySelector<HTMLElement>('[data-copy="1"] > :first-child');
    return a && b ? b.offsetLeft - a.offsetLeft : 0;
  }, []);

  const normalize = useCallback(() => {
    const el = ref.current;
    const w = setWidth();
    if (!el || w <= 0) return;
    if (el.scrollLeft < w * 0.5) el.scrollTo({ left: el.scrollLeft + w, behavior: "instant" });
    else if (el.scrollLeft > w * 1.5) el.scrollTo({ left: el.scrollLeft - w, behavior: "instant" });
  }, [setWidth]);

  // Start on the middle copy so there is room to go either way.
  useLayoutEffect(() => {
    const el = ref.current;
    const w = setWidth();
    if (el && w > 0) el.scrollTo({ left: w, behavior: "instant" });
  }, [setWidth]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const settle = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(normalize, 140);
    };
    el.addEventListener("scroll", settle, { passive: true });
    window.addEventListener("resize", normalize);
    return () => {
      el.removeEventListener("scroll", settle);
      window.removeEventListener("resize", normalize);
      window.clearTimeout(timer.current);
    };
  }, [normalize]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-copy="0"] > :first-child');
    const step = (card?.getBoundingClientRect().width ?? el.clientWidth * 0.8) + 16;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? "auto" : "smooth" });
    // The scroll listener re-centres the row once it settles; this covers a scroll event that never fires.
    window.setTimeout(normalize, reduce ? 50 : 700);
  };

  const btn =
    "absolute z-10 grid size-14 -translate-y-1/2 place-items-center text-black transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
  // Vertical centre of the photograph: half its height, from the top of the row.
  const top = `calc(${cardWidth} * ${photoRatio / 2})`;

  return (
    <div className="relative">
      <div
        ref={ref}
        role="group"
        aria-label={label}
        tabIndex={0}
        className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingInline: "var(--gutter)", scrollPaddingInline: "var(--gutter)" }}
      >
        {[0, 1, 2].map((copy) => (
          // The two extra copies are only there to make the row endless.
          <div key={copy} data-copy={copy} className="contents" aria-hidden={copy === 0 ? undefined : true} inert={copy === 0 ? undefined : true}>
            {children}
          </div>
        ))}
      </div>
      <button type="button" className={btn + " left-1 sm:left-3"} style={{ top }} onClick={() => go(-1)} aria-label="Previous projects">
        <ChevronLeft aria-hidden="true" className="size-12" strokeWidth={1.5} />
      </button>
      <button type="button" className={btn + " right-1 sm:right-3"} style={{ top }} onClick={() => go(1)} aria-label="Next projects">
        <ChevronRight aria-hidden="true" className="size-12" strokeWidth={1.5} />
      </button>
    </div>
  );
}
