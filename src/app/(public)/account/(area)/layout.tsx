import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountNav } from "@/components/public/account-forms";
import { PageIntro } from "@/components/public/prose";
import { getCustomer } from "@/lib/auth/customer";
import { requireAccountsOn } from "../gate";

export const metadata: Metadata = { title: { default: "Your account", template: "%s · Your account" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountAreaLayout({ children }: { children: ReactNode }) {
  await requireAccountsOn();
  // Each page asks for the sign-in itself (so the visitor comes back to the page they asked for); this only decorates the signed-in view.
  const customer = await getCustomer();
  if (!customer) return <>{children}</>;
  const first = customer.fullName.trim().split(/\s+/)[0] ?? "";
  return (
    <>
      <PageIntro plain eyebrow="Your account" title={first ? `Hello, ${first}` : "Your account"} />
      <div className="container-page pb-16 pt-8">
        <div className="acct-shell">
          <AccountNav />
          <div className="acct-main">{children}</div>
        </div>
      </div>
    </>
  );
}
