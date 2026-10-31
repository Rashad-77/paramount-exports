"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { VisibleGroup } from "@/lib/nav";

/** Sidebar navigation. A client component only so it can highlight the current page from the URL. */
export function AppNav({ groups, previewPath, unseen = {} }: { groups: VisibleGroup[]; previewPath?: string; unseen?: Record<string, boolean> }) {
  const livePath = usePathname();
  const router = useRouter();
  // The page behind a menu entry starts loading the moment the pointer is over it (or it is touched or focused), so the click lands on a page that is already on its way.
  const warm = (href: string) => router.prefetch(href);
  const pathname = previewPath ?? livePath;
  // Sections opened in this visit: their dot goes at once, and the time is kept in a cookie so the server knows what has been seen.
  // Remembered against the flags it was seen with: fresh flags from the server already account for the cookie.
  const [seenNow, setSeenNow] = useState<{ flags: typeof unseen; hrefs: string[] }>({ flags: unseen, hrefs: [] });
  const opened = seenNow.flags === unseen ? seenNow.hrefs : [];
  const section = Object.keys(unseen).find((h) => pathname === h || pathname.startsWith(`${h}/`));
  useEffect(() => {
    if (!section) return;
    document.cookie = `seen_${section.split("/").pop()}=${Date.now()}; path=/app; max-age=31536000; samesite=lax`;
  }, [section]);
  // Anything new arriving while the dashboard stays open shows up within a minute.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);
  const showDot = (href: string) => unseen[href] && !opened.includes(href) && href !== section;
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
                    onClick={() => setSeenNow((o) => ({ flags: unseen, hrefs: [...(o.flags === unseen ? o.hrefs : []), m.href] }))}
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
                    {showDot(m.href) ? (
                      <span role="img" aria-label="New" className="ml-auto size-2 shrink-0 rounded-full bg-red-600" />
                    ) : null}
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
