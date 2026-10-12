import type { Metadata } from "next";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { PageIntro } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";
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
      <PageIntro
        title="Showroom & contact"
        lead="Ask about a piece, request a quotation, or arrange a visit."
      />
      <div className="orbs">
        <div className="container-page grid gap-10 py-[var(--section-space)] lg:grid-cols-[1fr_1.25fr] lg:gap-0">
          <Reveal
            as="section"
            aria-labelledby="visit-title"
            className="wood-dark-bg relative isolate p-8 text-ivory md:p-12"
          >
            <h2
              id="visit-title"
              className="font-display text-[2.25rem] leading-tight"
            >
              Visit or call
            </h2>
            <dl className="mt-10 space-y-8 border-t border-ivory/20 pt-8 text-sm">
              <div>
                <dt className="flex items-center gap-2 font-medium">
                  <MapPin
                    aria-hidden="true"
                    className="size-5 text-linen-dark"
                    strokeWidth={1.5}
                  />{" "}
                  Address
                </dt>
                <dd className="mt-1 whitespace-pre-line pl-7 text-ivory/80">
                  {b.address ?? "Showroom address to be added."}
                </dd>
                {b.address && b.mapUrl ? (
                  <dd className="mt-2 pl-7">
                    <a
                      className="link-draw"
                      href={b.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on map
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="font-medium">Opening hours</dt>
                <dd className="mt-1 whitespace-pre-line text-ivory/80">
                  {b.openingHours ?? "Opening hours to be added."}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Telephone &amp; email</dt>
                <dd className="mt-2 flex flex-wrap gap-3">
                  {b.phone ? (
                    <ButtonLink
                      href={`tel:${b.phone.replace(/\s+/g, "")}`}
                      variant="light"
                    >
                      <Phone aria-hidden="true" className="size-4" /> {b.phone}
                    </ButtonLink>
                  ) : null}
                  {b.whatsapp ? (
                    <ButtonLink
                      href={whatsappLink(b.whatsapp, b.phoneCountryCode)}
                      variant="light"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle aria-hidden="true" className="size-4" />{" "}
                      WhatsApp
                      <span className="sr-only"> (opens in a new tab)</span>
                    </ButtonLink>
                  ) : null}
                  {b.email ? (
                    <a
                      className="link-draw inline-flex min-h-10 items-center"
                      href={`mailto:${b.email}`}
                    >
                      {b.email}
                    </a>
                  ) : null}
                  {!b.phone && !b.whatsapp && !b.email ? (
                    <span className="text-ivory/80">
                      Contact details to be added.
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </Reveal>

          <Reveal
            as="section"
            aria-labelledby="send-title"
            delay={120}
            className="glass p-6 md:p-12"
          >
            <h2
              id="send-title"
              className="font-display text-[2.25rem] leading-tight text-walnut"
            >
              Send an enquiry
            </h2>
            <div className="mt-6">
              <EnquiryForm
                kind="general"
                turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              />
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}
