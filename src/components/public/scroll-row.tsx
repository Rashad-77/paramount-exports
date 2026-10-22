"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * An endless row of cards: the cards are laid out three times (the real copy in the middle, in the page, and a read-only copy either
 * side, added once the page has loaded) and, whenever the row drifts out of the middle copy, it is moved
 * back by exactly one copy's width (invisibly, because the copies are identical), so it never reaches an end. The row runs edge to
 * edge under the heading (`header`). Black previous / next arrowheads are always visible, centred on the cards; each press moves
 * about one card. The row also scrolls by touch, trackpad and keyboard. The two extra copies are hidden from assistive
 * technology and cannot be tabbed to.
 *
 * With `autoplay` it also drifts along by itself, slowly and continuously (no stepping, so nothing jumps). It stops while the pointer or
 * keyboard focus is on it, while it is off screen or the tab is hidden, and for visitors who prefer reduced motion, and picks up
 * again from wherever it was left.
 */
export function ScrollRow({ label, children, header, autoplay = false, pxPerSecond = 42, onDark = false, centered = false }: { label: string; children: ReactNode; header: ReactNode; autoplay?: boolean; pxPerSecond?: number; onDark?: boolean; centered?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [reduced, setReduced] = useState(false);
  const held = useRef(false);
  const visible = useRef(false);
  /** After an arrow press in a centred row, the drift waits until this time so the photo stays where it was centred. */
  const resumeAt = useRef(0);

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

  // The page carries one copy of the cards (the real one, in the middle). Once the page has loaded, a read-only copy is made before it and
  // another after it, so the row can run endlessly without the page having to carry and start up three copies. The view is moved along
  // by one copy's width, so the same cards stay in front of the visitor.
  useEffect(() => {
    const el = ref.current;
    const real = main.current;
    if (!el || !real) return;
    const made: HTMLElement[] = [];
    const build = () => {
      const copy = (n: number) => {
        const c = real.cloneNode(true) as HTMLElement;
        c.dataset.copy = String(n);
        c.setAttribute("aria-hidden", "true");
        c.setAttribute("inert", "");
        c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        made.push(c);
        return c;
      };
      const left = el.scrollLeft;
      el.insertBefore(copy(0), real);
      el.appendChild(copy(2));
      const w = setWidth();
      if (w > 0) el.scrollTo({ left: left + w, behavior: "instant" });
    };
    // Safari has no idle callback: a short wait does the same job there.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle ? window.requestIdleCallback(build, { timeout: 1200 }) : window.setTimeout(build, 300);
    return () => {
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      if (made.length) el.scrollTo({ left: 0, behavior: "instant" });
      made.forEach((c) => c.remove());
    };
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
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduce ? "auto" : "smooth";
    if (centered) {
      // Glide to the next card in that direction and land with it exactly in the middle of the row, whatever the drift left it at.
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-copy] > *"));
      const middle = el.scrollLeft + el.clientWidth / 2;
      const centreOf = (c: HTMLElement) => c.offsetLeft + c.offsetWidth / 2;
      const target = dir === 1 ? cards.find((c) => centreOf(c) > middle + 2) : [...cards].reverse().find((c) => centreOf(c) < middle - 2);
      if (target) el.scrollTo({ left: centreOf(target) - el.clientWidth / 2, behavior });
      resumeAt.current = Date.now() + 4500;
      return;
    }
    const card = el.querySelector<HTMLElement>('[data-copy="0"] > :first-child');
    const step = (card?.getBoundingClientRect().width ?? el.clientWidth * 0.8) + 20;
    el.scrollBy({ left: dir * step, behavior });
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

  const auto = autoplay && !reduced;
  useEffect(() => {
    if (!auto) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    let pos: number | null = null; // our own fractional position, so slow drift is not lost to rounding
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last);
      last = now;
      if (held.current || Date.now() < resumeAt.current || !visible.current || document.hidden || dt <= 0) {
        pos = null; // whoever moved it meanwhile (a press, a swipe) decides where we carry on from
        return;
      }
      const w = setWidth();
      if (w <= 0) return;
      if (pos === null) pos = el.scrollLeft;
      pos += (pxPerSecond * dt) / 1000;
      if (pos > w * 1.5) pos -= w; // back one copy: identical cards, so the eye sees nothing
      el.scrollLeft = pos;
    };
    raf = requestAnimationFrame((t) => {
      last = t;
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [auto, pxPerSecond, setWidth]);

  const btn =
    "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center shadow-none transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 " +
    (onDark ? "text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)] focus-visible:outline-white" : "text-black focus-visible:outline-black");

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
          className={"relative flex gap-5 overflow-x-auto pb-2 [overflow-anchor:none] " + (auto ? "" : "snap-x snap-mandatory ") + " [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}
        >
          <div ref={main} data-copy="1" className="contents">
            {children}
          </div>
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
