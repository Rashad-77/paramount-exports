import type { Metadata } from "next";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { PageIntro } from "@/components/public/prose";
import { ButtonLink } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { getBusinessSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Showroom & contact",
  description: "Visit the showroom, call us, or send an enquiry.",
  alternates: { canonical: "/contact" },
};
export const revalidate = 300;

export default async function ContactPage() {
  const b = await getBusinessSettings();
  return (
    <>
      <PageIntro title="Showroom & contact" lead="Ask about a piece, request a quotation, or arrange a visit." />
      <div className="container-page grid gap-12 pb-20 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <section aria-labelledby="visit-title">
          <h2 id="visit-title" className="font-display text-2xl text-walnut">
            Visit or call
          </h2>
          <dl className="mt-6 space-y-6 text-sm">
            <div>
              <dt className="flex items-center gap-2 font-medium">
                <MapPin aria-hidden="true" className="size-5 text-walnut" strokeWidth={1.5} /> Address
              </dt>
              <dd className="mt-1 whitespace-pre-line pl-7 text-text-muted">{b.address ?? "Showroom address to be added."}</dd>
              {b.address && b.mapUrl ? (
                <dd className="mt-2 pl-7">
                  <a className="underline" href={b.mapUrl} target="_blank" rel="noopener noreferrer">
                    View on map<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="font-medium">Opening hours</dt>
              <dd className="mt-1 whitespace-pre-line text-text-muted">{b.openingHours ?? "Opening hours to be added."}</dd>
            </div>
            <div>
              <dt className="font-medium">Telephone &amp; email</dt>
              <dd className="mt-2 flex flex-wrap gap-3">
                {b.phone ? (
                  <ButtonLink href={`tel:${b.phone.replace(/\s+/g, "")}`} variant="secondary">
                    <Phone aria-hidden="true" className="size-4" /> {b.phone}
                  </ButtonLink>
                ) : null}
                {b.whatsapp ? (
                  <ButtonLink href={whatsappLink(b.whatsapp, b.phoneCountryCode)} variant="secondary" target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp
                    <span className="sr-only"> (opens in a new tab)</span>
                  </ButtonLink>
                ) : null}
                {b.email ? <a className="inline-flex min-h-10 items-center underline" href={`mailto:${b.email}`}>{b.email}</a> : null}
                {!b.phone && !b.whatsapp && !b.email ? <span className="text-text-muted">Contact details to be added.</span> : null}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="send-title" className=" border border-border bg-surface p-6 md:p-8">
          <h2 id="send-title" className="font-display text-2xl text-walnut">
            Send an enquiry
          </h2>
          <div className="mt-6">
            <EnquiryForm kind="general" turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
          </div>
        </section>
      </div>
    </>
  );
}
