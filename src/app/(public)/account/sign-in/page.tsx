import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm, SignUpForm } from "@/components/public/account-forms";
import { PageIntro } from "@/components/public/prose";
import { Alert } from "@/components/ui/status";
import { customerAuthMode, getCustomer, googleSignInEnabled } from "@/lib/auth/customer";
import { GoogleButton } from "@/components/public/google-button";
import { one, type SP } from "@/lib/list-params";
import { safeNext } from "../actions";
import { getAccountSettings } from "@/lib/settings";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  const settings = await getAccountSettings();
  if (!settings.enabled || customerAuthMode() === "off") return <NotAvailable />;
  const sp = await searchParams;
  const next = await safeNext(one(sp.next), "");
  if (await getCustomer()) redirect(next || "/account");
  const google = googleSignInEnabled();
  const checkEmail = one(sp.notice) === "check-email";
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} plain eyebrow="Your account" title="Sign in" lead="See your orders, and keep your details ready for next time. You can still order without an account." />
      <div className="container-page grid gap-10 py-[var(--section-space)] lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="signin-title" className="soft-card space-y-5">
          <h2 id="signin-title" className="font-display text-[clamp(1.15rem,calc(1.15rem_+_(100vw_-_375px)_*_0.01425),1.5rem)] leading-tight text-brand">
            Sign in
          </h2>
          {one(sp.notice) === "not-customer" ? (
            <Alert tone="warning" title="Use a different email address">
              That email address cannot be used for a customer account. Please sign in or sign up with another one.
            </Alert>
          ) : null}
          {checkEmail ? (
            <Alert tone="success" title="Check your email">
              We have sent you a link to confirm your address. Open it, then sign in here.
            </Alert>
          ) : null}
          <SignInForm next={next || undefined} />
          {google ? <GoogleButton next={next || undefined} /> : null}
        </section>
        {settings.allowSignUp ? (
          <section aria-labelledby="signup-title" className="soft-card space-y-5">
            <h2 id="signup-title" className="font-display text-[clamp(1.15rem,calc(1.15rem_+_(100vw_-_375px)_*_0.01425),1.5rem)] leading-tight text-brand">
              Create an account
            </h2>
            <SignUpForm next={next || undefined} />
            {google ? <GoogleButton next={next || undefined} /> : null}
          </section>
        ) : null}
      </div>
    </>
  );
}

/** Shown while customer accounts are switched off, so the header's account button never leads nowhere. */
function NotAvailable() {
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} plain eyebrow="Your account" title="Accounts are coming soon" lead="You do not need an account to order from us or to follow an order." />
      <div className="container-page max-w-xl py-[var(--section-space)]">
        <div className="soft-card space-y-5">
          <p className="text-text-muted">Add pieces to your cart and place an order with your name and phone number. Afterwards you can follow it with the order number and the same phone number.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/products" size="cta">
              Browse the collection
            </ButtonLink>
            <ButtonLink href="/track" size="cta" variant="secondary">
              Track an order
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
