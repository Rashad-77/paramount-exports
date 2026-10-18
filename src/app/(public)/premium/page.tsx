import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackBar } from "@/components/public/back-link";
import { HeroVideo } from "@/components/public/hero-video";
import { PremiumList } from "@/components/public/premium-list";
import { Reveal } from "@/components/public/reveal";
import { ButtonLink } from "@/components/ui/button";
import { PREMIUM_VIDEO } from "@/lib/home-media";
import { listPremiumProducts } from "@/server/catalogue-public";

export const metadata: Metadata = {
  title: "Premium range",
  description: "Our finest pieces, shown one by one: the timber, the joinery and the finish.",
  alternates: { canonical: "/premium" },
};
export const revalidate = 300;


export default async function PremiumPage() {
  const pieces = await listPremiumProducts(24);
  // With no premium pieces there is nothing to show here (the homepage section and the collection banner are hidden too): go to the collection.
  if (pieces.length === 0) redirect("/products");
  return (
    <div className="prem-page">
      {/* Video banner, like the homepage and the gallery: a silent looping clip under a dark gradient */}
      <section aria-labelledby="premium-page-title" className="vhero vhero-short on-wood">
        <BackBar href="/" to="home" />
        <HeroVideo desktop={PREMIUM_VIDEO.desktop} mobile={PREMIUM_VIDEO.mobile} poster={PREMIUM_VIDEO.poster} />
        <div className="container-page w-full pt-24 pb-[clamp(2.5rem,6vw,4.5rem)]">
          <h1 id="premium-page-title" className="prem-title prem-title-xl rise-in">
            Premium range
          </h1>
        </div>
      </section>

      <PremiumList pieces={pieces} />

      <section aria-labelledby="premium-cta" className="prem-close">
        <div className="container-page">
          <Reveal variant="up" className="mx-auto max-w-2xl text-center">
            <p className="prem-eyebrow justify-center">Made to measure</p>
            <h2 id="premium-cta" className="prem-title mt-4">
              Something of <em>your own</em>?
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/custom#quotation" size="cta" variant="light">
                Request a quotation
              </ButtonLink>
              <ButtonLink href="/contact" size="cta" variant="onDark">
                Plan a visit
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
