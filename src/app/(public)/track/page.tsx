import type { Metadata } from "next";
import { PageIntro } from "@/components/public/prose";
import { TrackOrder } from "@/components/public/track-order";
import { one, type SP } from "@/lib/list-params";
import { normaliseOrderRef } from "@/lib/schemas/tracking";
import { googleReviewLink } from "@/lib/google-reviews";
import { getBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Track your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ref = one(sp.ref);
  const business = await getBusinessSettings();
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} plain eyebrow="Order" title="Track your order" lead="Enter your order number and we will show you where your order is." />
      <div className="container-page max-w-3xl py-[var(--section-space)]">
        <TrackOrder initialReference={ref ? (normaliseOrderRef(ref) ?? undefined) : undefined} timezone={business.timezone} review={googleReviewLink(business) ? { url: googleReviewLink(business)!, name: business.name } : null} />
      </div>
    </>
  );
}
