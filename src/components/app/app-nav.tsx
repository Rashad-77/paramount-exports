"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { VisibleGroup } from "@/lib/nav";

/** Sidebar navigation. A client component only so it can highlight the current page from the URL. */
export function AppNav({ groups, previewPath }: { groups: VisibleGroup[]; previewPath?: string }) {
  const livePath = usePathname();
  const pathname = previewPath ?? livePath;
  return (
    <nav aria-label="Main" className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-text-muted">{g.label}</p>
          <ul className="mt-1 space-y-px">
            {g.modules.map((m) => {
              const current = m.pages.some((p) => (p.href === "/app" ? pathname === "/app" : pathname === p.href || pathname.startsWith(`${p.href}/`)));
              return (
                <li key={m.label}>
                  <Link
                    href={m.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      "flex min-h-9 items-center border-l-2 px-3 text-[0.8125rem] transition-colors duration-[var(--duration-fast)] " +
                      (current ? "border-green bg-walnut font-medium text-ivory" : "border-transparent text-text hover:bg-linen")
                    }
                  >
                    {m.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
