import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Actor } from "@/lib/auth/permissions";
import { visibleNav } from "@/lib/nav";
import { AppNav } from "./app-nav";
import { LanguageSwitch } from "./dash-language";
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
  unseen,
}: {
  actor: Actor;
  currentPath?: string;
  unseen?: Record<string, boolean>;
}) {
  return <AppNav groups={visibleNav(actor)} previewPath={currentPath} unseen={unseen} />;
}

export function AppShell({
  actor,
  businessName,
  currentPath,
  signOutAction,
  unseen,
  children,
}: {
  actor: Actor;
  businessName: string;
  currentPath?: string;
  /** Server Action that signs out. Omitted in the sample preview, where no session exists. */
  signOutAction?: () => Promise<void>;
  /** Menu entries (by href) with something new since they were last opened. */
  unseen?: Record<string, boolean>;
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

  // Who is signed in; pressing it opens the account page (name, email, password).
  const account = (
    <Link href="/app/account" aria-label={`${actor.fullName}, ${roles}: your account`} className="block px-3 py-1.5 transition-colors hover:bg-linen">
      <span className="block text-sm font-medium">{actor.fullName}</span>
      <span className="block text-xs text-text-muted">{roles}</span>
    </Link>
  );

  return (
    <div className="app-ui min-h-dvh bg-white lg:grid lg:grid-cols-[14.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-surface text-text lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-[var(--header-height)] items-center border-b border-border px-5">
          <StaffBrand name={businessName} />
        </div>
        <div className="app-scroll flex-1 overflow-y-auto p-3">
          <NavList actor={actor} currentPath={currentPath} unseen={unseen} />
        </div>
        {/* Who is signed in, at the foot of the sidebar */}
        <div className="border-t border-border px-3 pt-3 pb-0">
          {account}
          <div className="mt-2">{signOut}</div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Desktop top bar */}
        <div className="hidden h-[var(--header-height)] items-center justify-between gap-4 border-b border-border px-[var(--gutter)] lg:flex">
          <p className="text-sm font-medium tracking-[0.02em] text-text">
            Administration dashboard
          </p>
          <LanguageSwitch />
        </div>
        {/* Mobile / tablet top bar */}
        <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center justify-between gap-3 border-b border-border bg-surface px-[var(--gutter)] text-text lg:hidden">
          <StaffBrand name={businessName} />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
          <AppNavMobile>
            <NavList actor={actor} currentPath={currentPath} unseen={unseen} />
            <div className="mt-6 border-t border-border pt-4">
              {account}
              <div className="mt-2">{signOut}</div>
            </div>
          </AppNavMobile>
          </div>
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
