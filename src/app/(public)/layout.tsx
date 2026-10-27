import type { ReactNode } from "react";
import { PlaceholderNotice, SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { AccountSync } from "@/components/public/account-sync";
import { customerAuthMode } from "@/lib/auth/customer";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { listPublicCategories } from "@/server/catalogue-public";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [business, accounts, categories] = await Promise.all([getBusinessSettings(), getAccountSettings(), listPublicCategories().catch(() => [])]);
  // The main categories that have pieces in them, linked from the footer on every page.
  const collection = categories.filter((c) => !c.parentId && c.count > 0).map((c) => ({ name: c.name, slug: c.slug }));
  const accountsOn = accounts.enabled && customerAuthMode() !== "off";
  return (
    <div className="page-body">
      <PlaceholderNotice business={business} />
      <SiteHeader business={business} accounts={accountsOn} />
      {accountsOn ? <AccountSync /> : null}
      <main id="main">{children}</main>
      <SiteFooter business={business} collection={collection} />
    </div>
  );
}
