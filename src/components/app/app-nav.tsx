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
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{g.label}</p>
          <ul className="mt-2 space-y-0.5">
            {g.items.map((i) => {
              const current = i.href === "/app" ? pathname === "/app" : pathname === i.href || pathname.startsWith(`${i.href}/`);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      "flex min-h-10 items-center rounded-[var(--radius-md)] px-3 text-sm " +
                      (current ? "bg-walnut font-medium text-ivory" : "text-text hover:bg-linen")
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
