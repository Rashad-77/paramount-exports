import Link from "next/link";

export interface FilterTab {
  label: string;
  href: string;
  count?: number;
  active: boolean;
}

/** Plain underlined tabs for filtering a list by state. Real links, so every view can be bookmarked and works without JavaScript. */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="app-tabs mb-5">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} aria-current={t.active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined ? <span>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
