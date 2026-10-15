import Link from "next/link";

/** Tabs for the screens of a module. The caller passes only what the person may open; nothing renders for a single screen. */
export function ModuleTabs({ label, pages, current }: { label: string; pages: { label: string; href: string }[]; current: string }) {
  if (pages.length < 2) return null;
  return (
    <nav aria-label={`${label} sections`} className="-mt-1 mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {pages.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.href === current ? "page" : undefined}
          className={
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[0.8125rem] transition-colors duration-[var(--duration-fast)] " +
            (p.href === current ? "border-walnut font-semibold text-walnut" : "border-transparent text-text-muted hover:text-text")
          }
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
