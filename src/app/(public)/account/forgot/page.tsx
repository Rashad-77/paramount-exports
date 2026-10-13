import type { Metadata } from "next";
import { ForgotForm } from "@/components/public/account-forms";
import { PageIntro } from "@/components/public/prose";
import { requireAccountsOn } from "../gate";

export const metadata: Metadata = { title: "Forgot your password", robots: { index: false, follow: false } };

export default async function ForgotPage() {
  await requireAccountsOn();
  return (
    <>
      <PageIntro plain eyebrow="Your account" title="Forgot your password?" lead="Enter your email address and we will send you a link to choose a new one." />
      <div className="container-page max-w-xl py-[var(--section-space)]">
        <div className="soft-card">
          <ForgotForm />
        </div>
      </div>
    </>
  );
}
