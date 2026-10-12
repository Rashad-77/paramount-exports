import Link from "next/link";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { Actor } from "@/lib/auth/permissions";
import { visibleNav } from "@/lib/nav";
import { AppNavMobile } from "./app-nav-mobile";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", sales: "Sales", workshop: "Workshop", finance: "Finance" };

function NavList({ actor, currentPath }: { actor: Actor; currentPath: string }) {
  const groups = visibleNav(actor);
  return (
    <nav aria-label="Main" className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{g.label}</p>
          <ul className="mt-2 space-y-0.5">
            {g.items.map((i) => {
              const current = i.href === "/app" ? currentPath === "/app" : currentPath.startsWith(i.href);
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

export function AppShell({
  actor,
  businessName,
  currentPath = "/app",
  signOutAction,
  children,
}: {
  actor: Actor;
  businessName: string;
  currentPath?: string;
  /** Server Action that signs out. Omitted in the sample preview, where no session exists. */
  signOutAction?: () => Promise<void>;
  children: ReactNode;
}) {
  const roles = actor.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ");
  const signOut = signOutAction ? (
    <form action={signOutAction}>
      <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm hover:bg-linen">
        <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Sign out
      </button>
    </form>
  ) : null;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-[var(--header-height)] items-center border-b border-border px-5">
          <Link href="/app" className="font-display text-lg text-walnut">
            {businessName}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3 py-5">
          <NavList actor={actor} currentPath={currentPath} />
        </div>
        <div className="border-t border-border p-3">
          <p className="truncate px-3 text-sm font-medium">{actor.fullName}</p>
          <p className="truncate px-3 text-xs text-text-muted">{roles}</p>
          <div className="mt-2">{signOut}</div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile / tablet top bar */}
        <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center justify-between gap-3 border-b border-border bg-surface px-[var(--gutter)] lg:hidden">
          <Link href="/app" className="font-display truncate text-lg text-walnut">
            {businessName}
          </Link>
          <AppNavMobile>
            <NavList actor={actor} currentPath={currentPath} />
            <div className="mt-6 border-t border-border pt-4">
              <p className="px-3 text-sm font-medium">{actor.fullName}</p>
              <p className="px-3 text-xs text-text-muted">{roles}</p>
              <div className="mt-2">{signOut}</div>
            </div>
          </AppNavMobile>
        </header>

        <main id="main" className="mx-auto w-full max-w-[84rem] px-[var(--gutter)] py-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
