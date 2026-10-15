"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ProductTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Tabs for the long content of a product page. Every panel is in the page (the inactive ones are only hidden), so nothing is lost to
 * search engines or to print. Left and Right move between tabs, Home and End jump to the first and last.
 */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const base = useId();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  if (tabs.length === 0) return null;

  const go = (id: string) => {
    setActive(id);
    refs.current[id]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    go(tabs[next]!.id);
  };

  return (
    <div className="ptabs">
      <div role="tablist" aria-label="About this piece" className="ptabs-list">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={t.id === active}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={t.id !== active} className="ptabs-panel" tabIndex={0}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
