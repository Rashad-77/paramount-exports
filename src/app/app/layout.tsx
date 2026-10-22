import type { Metadata } from "next";
import type { ReactNode } from "react";
// The staff area's typeface; the public site does not use it, so only this area downloads it.
import "@fontsource-variable/inter";
import { signOut } from "@/app/(auth)/login/actions";
import { AppShell } from "@/components/app/app-shell";
import { demoDeploymentEnabled } from "@/lib/auth/demo-deployment";
import { requireActor } from "@/lib/auth/session";
import { Alert } from "@/components/ui/status";
import { getBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Staff area",
  robots: { index: false, follow: false },
};

// Everything under /app depends on the signed-in user: never statically cache it.
export const dynamic = "force-dynamic";

export default async function InternalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [actor, business] = await Promise.all([
    requireActor(),
    getBusinessSettings(),
  ]);
  return (
    <AppShell
      actor={actor}
      businessName={business.name}
      signOutAction={signOut}
    >
      {demoDeploymentEnabled() ? (
        <Alert tone="warning" title="Demo with sample data" className="mb-6">
          Anyone with this link can open this area, and there is no password. Do
          not enter real information. Signed in as{" "}
          <strong className="capitalize">{actor.roles.join(", ")}</strong> —{" "}
          <a className="underline" href="/demo/exit">
            switch role
          </a>
          .
        </Alert>
      ) : null}
      {children}
    </AppShell>
  );
}
