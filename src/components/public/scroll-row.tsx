"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * An endless row of cards: the cards are laid out three times and, whenever the row drifts out of the middle copy, it is moved
 * back by exactly one copy's width (invisibly, because the copies are identical), so it never reaches an end. The row runs edge to
 * edge under the heading (`header`). Black previous / next arrowheads are always visible, centred on the cards; each press moves
 * about one card. The row also scrolls by touch, trackpad and keyboard. The two extra copies are hidden from assistive
 * technology and cannot be tabbed to.
 *
 * With `autoplayMs` it also moves on by itself every so often. It stops while the pointer or keyboard focus is on it, while it is
 * off screen or the tab is hidden, and for visitors who prefer reduced motion.
 */
export function ScrollRow({ label, children, header, autoplayMs }: { label: string; children: ReactNode; header: ReactNode; autoplayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [reduced, setReduced] = useState(false);
  const held = useRef(false);
  const visible = useRef(false);

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
    // Make sure there is room to move in either direction first (an invisible jump), then glide by one card.
    normalize();
    const card = el.querySelector<HTMLElement>('[data-copy="0"] > :first-child');
    const step = (card?.getBoundingClientRect().width ?? el.clientWidth * 0.8) + 20;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? "auto" : "smooth" });
  };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => (visible.current = Boolean(e?.isIntersecting)), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const auto = Boolean(autoplayMs) && !reduced;
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (!held.current && visible.current && !document.hidden) go(1);
    }, autoplayMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, autoplayMs]);

  const btn =
    "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black shadow-none transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

  return (
    <>
      <div className="container-page">{header}</div>
      <div
        ref={box}
        className="relative mt-10"
        onPointerEnter={() => (held.current = true)}
        onPointerLeave={() => (held.current = false)}
        onFocus={() => (held.current = true)}
        onBlur={() => (held.current = false)}
      >
        <div
          ref={ref}
          role="group"
          aria-label={label}
          tabIndex={0}
          className="relative flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[0, 1, 2].map((copy) => (
            // The two extra copies are only there to make the row endless.
            <div key={copy} data-copy={copy} className="contents" aria-hidden={copy === 0 ? undefined : true} inert={copy === 0 ? undefined : true}>
              {children}
            </div>
          ))}
        </div>
        <button type="button" className={btn + " left-2"} onClick={() => go(-1)} aria-label={`Previous: ${label}`}>
          <ChevronLeft aria-hidden="true" className="size-7" strokeWidth={1.75} />
        </button>
        <button type="button" className={btn + " right-2"} onClick={() => go(1)} aria-label={`Next: ${label}`}>
          <ChevronRight aria-hidden="true" className="size-7" strokeWidth={1.75} />
        </button>
      </div>
    </>
  );
}
