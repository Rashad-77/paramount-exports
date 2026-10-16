"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

type Variant = "up" | "fade" | "left" | "right" | "zoom" | "wipe";

/**
 * Reveals its content as it scrolls into view (see `[data-reveal]` in globals.css). The element is only hidden once the page has
 * marked <html class="js">, and this component un-hides it, so without scripting the content is simply visible. Direct DOM class
 * change (no React state): one observer per element, disconnected after it fires. Honours reduced motion in CSS.
 */
export function Reveal({
  as = "div",
  variant: _variant = "up",
  delay = 0,
  className,
  children,
}: {
  as?: "div" | "li" | "section" | "p" | "h2" | "span" | "article" | "ul" | "header";
  variant?: Variant;
  /** Milliseconds, for staggering siblings. */
  delay?: number;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as unknown as ElementType;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = delay ? ({ "--d": `${delay}ms` } as CSSProperties) : undefined;
  return (
    <Tag ref={ref} data-reveal="up" className={className} style={style}>
      {children}
    </Tag>
  );
}
