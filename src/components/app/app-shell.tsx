import Link from "next/link";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { Actor } from "@/lib/auth/permissions";
import { visibleNav } from "@/lib/nav";
import { AppNav } from "./app-nav";
import { AppNavMobile } from "./app-nav-mobile";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", sales: "Sales", workshop: "Workshop", finance: "Finance" };

function NavList({ actor, currentPath }: { actor: Actor; currentPath?: string }) {
  return <AppNav groups={visibleNav(actor)} previewPath={currentPath} />;
}

export function AppShell({
  actor,
  businessName,
  currentPath,
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
      <button type="submit" className="inline-flex min-h-10 items-center gap-2 border border-transparent px-3 text-sm transition-colors hover:border-border-strong">
        <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Sign out
      </button>
    </form>
  ) : null;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-[var(--header-height)] items-center border-b border-border px-5">
          <Link href="/app" className="font-display text-[1.5rem] leading-none text-walnut">
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
          <Link href="/app" className="font-display truncate text-[1.5rem] leading-none text-walnut">
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

        <main id="main" className="mx-auto w-full max-w-[84rem] px-[var(--gutter)] py-8 md:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
