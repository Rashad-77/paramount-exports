import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountNav } from "@/components/public/account-forms";
import { PageIntro } from "@/components/public/prose";
import { requireCustomer } from "@/lib/auth/customer";
import { requireAccountsOn } from "../gate";

export const metadata: Metadata = { title: { default: "Your account", template: "%s · Your account" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountAreaLayout({ children }: { children: ReactNode }) {
  await requireAccountsOn();
  const customer = await requireCustomer("/account");
  const first = customer.fullName.trim().split(/\s+/)[0] ?? "";
  return (
    <>
      <PageIntro plain eyebrow="Your account" title={first ? `Hello, ${first}` : "Your account"} lead="Your quotations, your orders and your saved details, in one place." />
      <div className="container-page py-[var(--section-space)]">
        <div className="acct-shell">
          <AccountNav />
          <div className="acct-main">{children}</div>
        </div>
      </div>
    </>
  );
}
