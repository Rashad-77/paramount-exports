import type { Metadata } from "next";
import { CartView } from "@/components/public/cart-view";
import { PageIntro } from "@/components/public/prose";
import { getBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };
export const revalidate = 300;

export default async function CartPage() {
  const business = await getBusinessSettings();
  return (
    <>
      <PageIntro plain title="Your cart" lead="Check what you have chosen." eyebrow="Cart" />
      <div className="container-page py-[var(--section-space)]">
        <CartView currency={business.currency} />
      </div>
    </>
  );
}
