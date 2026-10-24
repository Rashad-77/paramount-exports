"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { VisibleGroup } from "@/lib/nav";

/** Sidebar navigation. A client component only so it can highlight the current page from the URL. */
export function AppNav({ groups, previewPath }: { groups: VisibleGroup[]; previewPath?: string }) {
  const livePath = usePathname();
  const router = useRouter();
  // The page behind a menu entry starts loading the moment the pointer is over it (or it is touched or focused), so the click lands on a page that is already on its way.
  const warm = (href: string) => router.prefetch(href);
  const pathname = previewPath ?? livePath;
  return (
    <nav aria-label="Main">
      {groups.map((g) => (
        <div key={g.label} className="app-nav-group">
          <ul aria-label={g.label}>
            {g.modules.map((m) => {
              const current = m.pages.some((p) => (p.href === "/app" ? pathname === "/app" : pathname === p.href || pathname.startsWith(`${p.href}/`)));
              return (
                <li key={m.label} className="border-b border-border">
                  <Link
                    href={m.href}
                    onPointerEnter={() => warm(m.href)}
                    onFocus={() => warm(m.href)}
                    onTouchStart={() => warm(m.href)}
                    aria-current={current ? "page" : undefined}
                    className={
                      "flex min-h-10 items-center border-l-2 px-3 text-[0.8125rem] transition-colors duration-[var(--duration-fast)] " +
                      (current ? "border-walnut bg-linen font-medium text-walnut" : "border-transparent text-text-muted hover:bg-paper-deep hover:text-text")
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
