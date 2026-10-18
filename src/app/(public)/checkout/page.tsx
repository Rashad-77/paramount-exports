import type { Metadata } from "next";
import { CheckoutForm } from "@/components/public/checkout-form";
import { PageIntro } from "@/components/public/prose";
import { publicEnv } from "@/lib/env";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const revalidate = 300;

export default async function CheckoutPage() {
  const [business, accounts] = await Promise.all([getBusinessSettings(), getAccountSettings()]);
  return (
    <>
      <PageIntro back={{ href: "/cart", to: "your cart" }} plain title="Checkout" lead="Tell us where to reach you and how you would like it. No payment is taken on this website." eyebrow="Order" />
      <div className="container-page py-[var(--section-space)]">
        <CheckoutForm currency={business.currency} bankDetails={business.bankDetails} turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} requireAccount={accounts.enabled && accounts.requiredForCheckout} />
      </div>
    </>
  );
}
