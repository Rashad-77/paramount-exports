import type { ReactNode } from "react";
import { PlaceholderNotice, SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { getBusinessSettings } from "@/lib/settings";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const business = await getBusinessSettings();
  return (
    <div className="ambient-page">
      <PlaceholderNotice business={business} />
      <SiteHeader business={business} />
      <main id="main">{children}</main>
      <SiteFooter business={business} />
    </div>
  );
}
