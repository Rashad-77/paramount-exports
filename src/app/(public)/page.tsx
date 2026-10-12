import { ArrowRight, MapPin, MessageCircle, Phone } from "lucide-react";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { ButtonLink } from "@/components/ui/button";
import { getBusinessSettings } from "@/lib/settings";

// Settings change rarely; refresh the static page at most every 5 minutes.
export const revalidate = 300;

const COLLECTIONS = ["Category one", "Category two", "Category three"];

export default async function HomePage() {
  const business = await getBusinessSettings();
  const whatsappHref = business.whatsapp ? `https://wa.me/${business.whatsapp.replace(/[^\d]/g, "")}` : null;

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="container-page grid items-center gap-10 py-14 md:grid-cols-12 md:gap-12 md:py-24">
        <div className="md:col-span-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">Furniture · Showroom · Workshop</p>
          <h1 id="hero-title" className="font-display mt-5 text-4xl leading-[1.08] text-walnut md:text-5xl lg:text-[3.5rem]">
            Wood furniture for the way you live.
          </h1>
          <p className="mt-6 max-w-md text-lg text-text-muted">
            Choose from ready-made pieces in our showroom, or have something built to your measurements in our workshop.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#custom" size="lg">
              Start a custom enquiry
            </ButtonLink>
            <ButtonLink href="#showroom" variant="secondary" size="lg">
              Visit the showroom
            </ButtonLink>
          </div>
        </div>
        <div className="md:col-span-6">
          <ImagePlaceholder label="Hero image — a finished piece in a lived-in room" className="aspect-[4/5] w-full md:aspect-[5/6]" />
        </div>
      </section>

      {/* Collections */}
      <section aria-labelledby="collections-title" className="border-t border-border">
        <div className="container-page py-16 md:py-24">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <h2 id="collections-title" className="font-display text-3xl text-walnut md:text-4xl">
              Browse by room
            </h2>
            <p className="max-w-sm text-sm text-text-muted">
              Placeholder categories. The catalogue is managed from the admin area once products are entered.
            </p>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-3">
            {COLLECTIONS.map((name) => (
              <li key={name}>
                <ImagePlaceholder label={name} className="aspect-[16/10] w-full sm:aspect-[4/5]" />
                <p className="mt-3 font-display text-xl text-walnut">{name}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Custom furniture */}
      <section id="custom" aria-labelledby="custom-title" className="scroll-mt-4 bg-walnut text-ivory">
        <div className="container-page grid gap-8 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7">
            <h2 id="custom-title" className="font-display text-3xl md:text-4xl">
              Made to your measurements
            </h2>
            <p className="mt-5 max-w-xl text-lg text-ivory/85">
              Have something specific in mind? Tell us the piece, the dimensions and the wood you prefer, and we will respond with
              a quotation.
            </p>
          </div>
          <div className="flex items-end md:col-span-5 md:justify-end">
            <ButtonLink href="#contact" size="lg" className="border-ivory bg-ivory text-walnut hover:bg-linen hover:border-linen">
              Request a quotation
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Workshop */}
      <section id="workshop" aria-labelledby="workshop-title" className="scroll-mt-4">
        <div className="container-page grid items-center gap-10 py-16 md:grid-cols-12 md:gap-16 md:py-24">
          <div className="md:order-2 md:col-span-6">
            <h2 id="workshop-title" className="font-display text-3xl text-walnut md:text-4xl">
              Craftsmanship, up close
            </h2>
            <p className="mt-5 max-w-lg text-text-muted">
              This section is for the story of the workshop: the people, the timber and the methods. Wording and photography will
              be supplied by the business.
            </p>
          </div>
          <div className="md:order-1 md:col-span-6">
            <ImagePlaceholder label="Workshop — joinery or finishing detail" className="aspect-[4/3] w-full" />
          </div>
        </div>
      </section>

      {/* Showroom */}
      <section id="showroom" aria-labelledby="showroom-title" className="scroll-mt-4 border-t border-border bg-linen/50">
        <div className="container-page grid gap-10 py-16 md:grid-cols-12 md:gap-16 md:py-24">
          <div className="md:col-span-5">
            <h2 id="showroom-title" className="font-display text-3xl text-walnut md:text-4xl">
              Visit the showroom
            </h2>
            <dl className="mt-8 space-y-6 text-sm">
              <div>
                <dt className="flex items-center gap-2 font-medium">
                  <MapPin aria-hidden="true" className="size-5 shrink-0 text-walnut" strokeWidth={1.5} />
                  Address
                </dt>
                <dd className="mt-1 whitespace-pre-line pl-7 text-text-muted">{business.address ?? "Showroom address to be added."}</dd>
                {business.address && business.mapUrl ? (
                  <dd className="mt-2 pl-7">
                    <a href={business.mapUrl} className="underline" target="_blank" rel="noopener noreferrer">
                      View on map<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="font-medium">Opening hours</dt>
                <dd className="mt-1 whitespace-pre-line text-text-muted">{business.openingHours ?? "Opening hours to be added."}</dd>
              </div>
            </dl>
          </div>
          <div className="md:col-span-7">
            <ImagePlaceholder label="Showroom interior" className="aspect-[16/10] w-full" />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" aria-labelledby="contact-title" className="scroll-mt-4">
        <div className="container-page py-16 md:py-24">
          <h2 id="contact-title" className="font-display text-3xl text-walnut md:text-4xl">
            Get in touch
          </h2>
          <p className="mt-4 max-w-xl text-text-muted">
            Ask about a piece, request a quotation, or arrange a visit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {business.phone ? (
              <ButtonLink href={`tel:${business.phone.replace(/\s+/g, "")}`} variant="secondary" size="lg">
                <Phone aria-hidden="true" className="size-4" />
                {business.phone}
              </ButtonLink>
            ) : null}
            {whatsappHref ? (
              <ButtonLink href={whatsappHref} variant="secondary" size="lg" target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" className="size-4" />
                WhatsApp
              </ButtonLink>
            ) : null}
          </div>
          {!business.phone && !whatsappHref ? (
            <p className="mt-2 text-sm text-text-muted">Telephone and WhatsApp details will appear here once they are added.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
