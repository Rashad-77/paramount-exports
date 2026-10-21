import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { Actor } from "@/lib/auth/permissions";
import { visibleNav } from "@/lib/nav";
import { AppNav } from "./app-nav";
import { StaffBrand } from "./staff-brand";
import { AppNavMobile } from "./app-nav-mobile";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  sales: "Sales",
  workshop: "Workshop",
  finance: "Finance",
};

function NavList({
  actor,
  currentPath,
}: {
  actor: Actor;
  currentPath?: string;
}) {
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
      <button
        type="submit"
        className="inline-flex min-h-10 items-center gap-2 border border-transparent px-3 text-sm text-text transition-colors hover:bg-linen"
      >
        <LogOut aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Sign out
      </button>
    </form>
  ) : null;

  return (
    <div className="app-ui min-h-dvh bg-white lg:grid lg:grid-cols-[14.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-surface text-text lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-[var(--header-height)] items-center border-b border-border px-5">
          <StaffBrand name={businessName} />
        </div>
        <div className="app-scroll flex-1 overflow-y-auto p-3">
          <NavList actor={actor} currentPath={currentPath} />
        </div>
        {/* Who is signed in, at the foot of the sidebar */}
        <div className="border-t border-border px-3 pt-3 pb-0">
          <p className="px-3 text-sm font-medium">{actor.fullName}</p>
          <p className="px-3 text-xs text-text-muted">{roles}</p>
          <div className="mt-2">{signOut}</div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Desktop top bar */}
        <div className="hidden h-[var(--header-height)] items-center border-b border-border px-[var(--gutter)] lg:flex">
          <p className="text-sm font-medium tracking-[0.02em] text-text">
            Administration dashboard
          </p>
        </div>
        {/* Mobile / tablet top bar */}
        <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center justify-between gap-3 border-b border-border bg-surface px-[var(--gutter)] text-text lg:hidden">
          <StaffBrand name={businessName} />
          <AppNavMobile>
            <NavList actor={actor} currentPath={currentPath} />
            <div className="mt-6 border-t border-border pt-4">
              <p className="px-3 text-sm font-medium">{actor.fullName}</p>
              <p className="px-3 text-xs text-text-muted">{roles}</p>
              <div className="mt-2">{signOut}</div>
            </div>
          </AppNavMobile>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[84rem] px-[var(--gutter)] py-5 md:py-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
