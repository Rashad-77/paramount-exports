"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

export interface FilterTab {
  label: string;
  href: string;
  count?: number;
  active: boolean;
}

/**
 * Plain underlined tabs for filtering a list by state. When the tabs do not fit on one line they become a single dropdown,
 * so nothing ever needs a scrollbar. Both are real navigation to a real address, so every view can be bookmarked.
 */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const router = useRouter();

  useLayoutEffect(() => {
    const measure = () => {
      if (wrap.current && row.current) setCompact(row.current.scrollWidth > wrap.current.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [tabs]);

  const current = tabs.find((t) => t.active) ?? tabs[0];

  return (
    <div ref={wrap} className="app-tabs-wrap mb-5">
      <nav ref={row} aria-label={label} className="app-tabs" data-compact={compact ? "" : undefined} aria-hidden={compact ? true : undefined}>
        {tabs.map((t) => (
          <Link key={t.label} href={t.href} aria-current={t.active ? "page" : undefined} tabIndex={compact ? -1 : undefined}>
            {t.label}
            {t.count !== undefined ? <span>{t.count}</span> : null}
          </Link>
        ))}
      </nav>
      {compact && current ? (
        <select aria-label={label} className="app-tabs-select" value={current.href} onChange={(e) => router.push(e.target.value)}>
          {tabs.map((t) => (
            <option key={t.label} value={t.href}>
              {t.label}
              {t.count !== undefined ? ` (${t.count})` : ""}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
