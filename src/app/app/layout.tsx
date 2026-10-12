import type { Metadata } from "next";
import type { ReactNode } from "react";
import { signOut } from "@/app/(auth)/login/actions";
import { AppShell } from "@/components/app/app-shell";
import { requireActor } from "@/lib/auth/session";
import { getBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Staff area", robots: { index: false, follow: false } };

// Everything under /app depends on the signed-in user: never statically cache it.
export const dynamic = "force-dynamic";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  const [actor, business] = await Promise.all([requireActor(), getBusinessSettings()]);
  return (
    <AppShell actor={actor} businessName={business.name} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
