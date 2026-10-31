import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
// The staff area's typeface; the public site does not use it, so only this area downloads it.
import "@fontsource-variable/inter";
import { signOut } from "@/app/(auth)/login/actions";
import { AppShell } from "@/components/app/app-shell";
import { DashLanguage } from "@/components/app/dash-language";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/lang";
import { demoDeploymentEnabled } from "@/lib/auth/demo-deployment";
import { requireActor } from "@/lib/auth/session";
import { Alert } from "@/components/ui/status";
import { getBusinessSettings } from "@/lib/settings";
import { getUnseen, SEEN_COOKIE_PREFIX, SEEN_SECTIONS, type SeenTimes } from "@/server/unseen";

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
  const [actor, business, jar] = await Promise.all([
    requireActor(),
    getBusinessSettings(),
    cookies(),
  ]);
  // The language the owner last picked (English or Sinhala); the words are translated in the browser, see DashLanguage.
  const lang = parseLang(jar.get(LANG_COOKIE)?.value);
  // A red dot on a menu entry when something new arrived since the owner last opened that section.
  const seen = Object.fromEntries(
    (Object.keys(SEEN_SECTIONS) as (keyof SeenTimes)[]).map((k) => [k, Number(jar.get(SEEN_COOKIE_PREFIX + k)?.value) || 0]),
  ) as SeenTimes;
  const unseen = await getUnseen(seen);
  return (
    <DashLanguage initial={lang}>
    <AppShell
      actor={actor}
      businessName={business.name}
      unseen={unseen}
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
    </DashLanguage>
  );
}
