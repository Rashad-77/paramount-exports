import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/public/account-forms";
import { PageIntro } from "@/components/public/prose";
import { Alert } from "@/components/ui/status";
import { getCustomer } from "@/lib/auth/customer";
import { requireAccountsOn } from "../gate";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPage() {
  await requireAccountsOn();
  // The emailed link signs the person in for this one step; without it there is nothing to reset.
  const customer = await getCustomer();
  return (
    <>
      <PageIntro plain eyebrow="Your account" title="Choose a new password" />
      <div className="container-page max-w-xl py-[var(--section-space)]">
        {customer ? (
          <div className="soft-card">
            <ResetForm />
          </div>
        ) : (
          <Alert tone="warning" title="This link has expired">
            Ask for a new one on the{" "}
            <Link href="/account/forgot" className="underline">
              forgot password page
            </Link>
            .
          </Alert>
        )}
      </div>
    </>
  );
}
