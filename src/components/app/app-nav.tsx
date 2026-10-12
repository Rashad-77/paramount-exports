"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav";

/** Sidebar navigation. A client component only so it can highlight the current page from the URL. */
export function AppNav({ groups, previewPath }: { groups: NavGroup[]; previewPath?: string }) {
  const livePath = usePathname();
  const pathname = previewPath ?? livePath;
  return (
    <nav aria-label="Main" className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{g.label}</p>
          <ul className="mt-2.5 space-y-px">
            {g.items.map((i) => {
              const current = i.href === "/app" ? pathname === "/app" : pathname === i.href || pathname.startsWith(`${i.href}/`);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      "flex min-h-10 items-center border-l-2 px-3 text-sm transition-colors duration-[var(--duration-fast)] " +
                      (current ? "border-brass bg-paper-deep font-semibold text-walnut" : "border-transparent text-text hover:border-linen-dark hover:bg-paper-deep/70")
                    }
                  >
                    {i.label}
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
