import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm, SignUpForm } from "@/components/public/account-forms";
import { PageIntro } from "@/components/public/prose";
import { Alert } from "@/components/ui/status";
import { getCustomer } from "@/lib/auth/customer";
import { one, type SP } from "@/lib/list-params";
import { safeNext } from "../actions";
import { requireAccountsOn } from "../gate";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  const settings = await requireAccountsOn();
  const sp = await searchParams;
  const next = await safeNext(one(sp.next), "");
  if (await getCustomer()) redirect(next || "/account");
  const checkEmail = one(sp.notice) === "check-email";
  return (
    <>
      <PageIntro plain eyebrow="Your account" title="Sign in" lead="See your orders and quotations, and keep your details ready for next time. You can still order without an account." />
      <div className="container-page grid gap-10 py-[var(--section-space)] lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="signin-title" className="soft-card space-y-5">
          <h2 id="signin-title" className="font-display text-[1.5rem] leading-tight text-brand">
            I have an account
          </h2>
          {checkEmail ? (
            <Alert tone="success" title="Check your email">
              We have sent you a link to confirm your address. Open it, then sign in here.
            </Alert>
          ) : null}
          <SignInForm next={next || undefined} />
        </section>
        {settings.allowSignUp ? (
          <section aria-labelledby="signup-title" className="soft-card space-y-5">
            <h2 id="signup-title" className="font-display text-[1.5rem] leading-tight text-brand">
              Create an account
            </h2>
            <SignUpForm next={next || undefined} />
          </section>
        ) : null}
      </div>
    </>
  );
}
