import { ArrowRight, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { ProductCard } from "@/components/public/product-card";
import { ButtonLink } from "@/components/ui/button";
import { whatsappLink } from "@/lib/contact";
import { hasDatabase } from "@/lib/env";
import { getBusinessSettings } from "@/lib/settings";
import { listFeaturedProducts, listPublicCategories, type PublicCard } from "@/server/catalogue-public";

// Settings and catalogue change rarely; refresh the static page at most every 5 minutes.
export const revalidate = 300;

const PLACEHOLDER_CATEGORIES = ["Category one", "Category two", "Category three"];

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("Homepage data unavailable", e instanceof Error ? e.message : "unknown");
    return fallback;
  }
}

export default async function HomePage() {
  const [business, categories, featured] = await Promise.all([
    getBusinessSettings(),
    safe(() => listPublicCategories(), []),
    safe<PublicCard[]>(() => listFeaturedProducts(3), []),
  ]);
  const shownCategories = categories.filter((c) => c.count > 0).slice(0, 3);

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
            <ButtonLink href="/custom" size="lg">
              Start a custom enquiry
            </ButtonLink>
            <ButtonLink href="/products" variant="secondary" size="lg">
              Browse the collection
            </ButtonLink>
          </div>
        </div>
        <div className="md:col-span-6">
          <ImagePlaceholder label="Hero image — a finished piece in a lived-in room" className="aspect-[4/5] w-full md:aspect-[5/6]" />
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="collections-title" className="border-t border-border">
        <div className="container-page py-16 md:py-24">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <h2 id="collections-title" className="font-display text-3xl text-walnut md:text-4xl">
              Browse by category
            </h2>
            {shownCategories.length === 0 ? (
              <p className="max-w-sm text-sm text-text-muted">Placeholder categories, replaced automatically once products are published.</p>
            ) : (
              <Link href="/products" className="inline-flex items-center gap-1 text-sm underline">
                View everything <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-3">
            {shownCategories.length > 0
              ? shownCategories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/products?category=${c.slug}`} className="group block">
                      <ImagePlaceholder label={`${c.name} — category photograph`} className="aspect-[16/10] w-full sm:aspect-[4/5]" />
                      <p className="font-display mt-3 text-xl text-walnut group-hover:underline underline-offset-4">{c.name}</p>
                      <p className="text-sm text-text-muted">
                        {c.count} {c.count === 1 ? "piece" : "pieces"}
                      </p>
                    </Link>
                  </li>
                ))
              : PLACEHOLDER_CATEGORIES.map((name) => (
                  <li key={name}>
                    <ImagePlaceholder label={name} className="aspect-[16/10] w-full sm:aspect-[4/5]" />
                    <p className="font-display mt-3 text-xl text-walnut">{name}</p>
                  </li>
                ))}
          </ul>
        </div>
      </section>

      {/* Featured pieces — only when the business has featured some */}
      {featured.length > 0 ? (
        <section aria-labelledby="featured-title" className="border-t border-border">
          <div className="container-page py-16 md:py-24">
            <h2 id="featured-title" className="font-display text-3xl text-walnut md:text-4xl">
              Featured pieces
            </h2>
            <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
              {featured.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} currency={business.currency} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Custom furniture */}
      <section id="custom" aria-labelledby="custom-title" className="scroll-mt-4 bg-walnut text-ivory">
        <div className="container-page grid gap-8 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7">
            <h2 id="custom-title" className="font-display text-3xl md:text-4xl">
              Made to your measurements
            </h2>
            <p className="mt-5 max-w-xl text-lg text-ivory/85">
              Have something specific in mind? Tell us the piece, the dimensions and the wood you prefer, and we will respond with a quotation.
            </p>
          </div>
          <div className="flex items-end md:col-span-5 md:justify-end">
            <ButtonLink href="/custom" size="lg" className="border-ivory bg-ivory text-walnut hover:border-linen hover:bg-linen">
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
              This section is for the story of the workshop: the people, the timber and the methods. Wording and photography will be supplied by the business.
            </p>
            <p className="mt-6">
              <Link href="/about" className="inline-flex items-center gap-1 underline">
                About the workshop <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
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
          <p className="mt-4 max-w-xl text-text-muted">Ask about a piece, request a quotation, or arrange a visit.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/contact" size="lg">
              Send an enquiry
            </ButtonLink>
            {business.phone ? (
              <ButtonLink href={`tel:${business.phone.replace(/\s+/g, "")}`} variant="secondary" size="lg">
                <Phone aria-hidden="true" className="size-4" />
                {business.phone}
              </ButtonLink>
            ) : null}
            {business.whatsapp ? (
              <ButtonLink href={whatsappLink(business.whatsapp, business.phoneCountryCode)} variant="secondary" size="lg" target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" className="size-4" />
                WhatsApp
                <span className="sr-only"> (opens in a new tab)</span>
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
