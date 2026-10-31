import type { ReactNode } from "react";
import { PlaceholderNotice, SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { AccountSync } from "@/components/public/account-sync";
import { customerAuthMode } from "@/lib/auth/customer";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [business, accounts] = await Promise.all([getBusinessSettings(), getAccountSettings()]);
  const accountsOn = accounts.enabled && customerAuthMode() !== "off";
  return (
    <div className="page-body">
      <PlaceholderNotice business={business} />
      <SiteHeader business={business} accounts={accountsOn} />
      {accountsOn ? <AccountSync /> : null}
      <main id="main">{children}</main>
      <SiteFooter business={business} />
    </div>
  );
}
