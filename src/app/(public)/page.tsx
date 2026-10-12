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
      <section aria-labelledby="hero-title" className="container-page grid items-center gap-12 py-14 md:grid-cols-12 md:gap-16 md:py-[clamp(4rem,2rem+6vw,8rem)]">
        <div className="md:col-span-7">
          <p className="eyebrow rise-in">Furniture · Showroom · Workshop</p>
          <h1 id="hero-title" className="font-display rise-in rise-in-2 mt-7 text-display text-walnut">
            Wood furniture for the way you live.
          </h1>
          <p className="rise-in rise-in-3 mt-8 max-w-md text-lg leading-relaxed text-text-muted">
            Choose from ready-made pieces in our showroom, or have something built to your measurements in our workshop.
          </p>
          <div className="rise-in rise-in-3 mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/custom" size="cta">
              Start a custom enquiry
            </ButtonLink>
            <ButtonLink href="/products" variant="secondary" size="cta">
              Browse the collection
            </ButtonLink>
          </div>
        </div>
        <div className="md:col-span-5">
          <ImagePlaceholder label="Hero image — a finished piece in a lived-in room" className="aspect-[4/5] w-full md:aspect-[5/6]" />
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="collections-title" className="border-t border-border">
        <div className="container-page section-y">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">The collection</p>
              <h2 id="collections-title" className="font-display mt-5 text-headline text-walnut">
                Browse by category
              </h2>
            </div>
            {shownCategories.length === 0 ? (
              <p className="max-w-sm text-sm text-text-muted">Placeholder categories, replaced automatically once products are published.</p>
            ) : (
              <Link href="/products" className="link-draw inline-flex items-center gap-2 text-[0.8125rem] font-medium uppercase tracking-[0.14em]">
                View everything <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
          <ul className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-3">
            {shownCategories.length > 0
              ? shownCategories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/products?category=${c.slug}`} className="group block">
                      <div className="zoom-frame"><ImagePlaceholder label={`${c.name} — category photograph`} className="aspect-[16/10] w-full sm:aspect-[4/5]" /></div>
                      <p className="font-display mt-5 text-[1.75rem] leading-tight text-walnut"><span className="link-draw-hover">{c.name}</span></p>
                      <p className="mt-1 text-sm text-text-muted">
                        {c.count} {c.count === 1 ? "piece" : "pieces"}
                      </p>
                    </Link>
                  </li>
                ))
              : PLACEHOLDER_CATEGORIES.map((name) => (
                  <li key={name}>
                    <ImagePlaceholder label={name} className="aspect-[16/10] w-full sm:aspect-[4/5]" />
                    <p className="font-display mt-5 text-[1.75rem] leading-tight text-walnut">{name}</p>
                  </li>
                ))}
          </ul>
        </div>
      </section>

      {/* Featured pieces — only when the business has featured some */}
      {featured.length > 0 ? (
        <section aria-labelledby="featured-title" className="border-t border-border">
          <div className="container-page section-y">
            <p className="eyebrow">Selected work</p>
            <h2 id="featured-title" className="font-display mt-5 text-headline text-walnut">
              Featured pieces
            </h2>
            <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-3 lg:gap-x-10">
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
      <section id="custom" aria-labelledby="custom-title" className="scroll-mt-4 bg-walnut-dark text-ivory">
        <div className="container-page grid gap-8 section-y md:grid-cols-12 ">
          <div className="md:col-span-7">
            <p className="eyebrow !text-linen-dark">Made to order</p>
            <h2 id="custom-title" className="font-display mt-5 text-headline">
              Made to your measurements
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ivory/80">
              Have something specific in mind? Tell us the piece, the dimensions and the wood you prefer, and we will respond with a quotation.
            </p>
          </div>
          <div className="flex items-end md:col-span-5 md:justify-end">
            <ButtonLink href="/custom" size="cta" variant="light">
              Request a quotation
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Workshop */}
      <section id="workshop" aria-labelledby="workshop-title" className="scroll-mt-4">
        <div className="container-page grid items-center gap-10 section-y md:grid-cols-12 md:gap-16 ">
          <div className="md:order-2 md:col-span-6">
            <p className="eyebrow">The workshop</p>
            <h2 id="workshop-title" className="font-display mt-5 text-headline text-walnut">
              Craftsmanship, up close
            </h2>
            <p className="mt-6 max-w-lg leading-relaxed text-text-muted">
              This section is for the story of the workshop: the people, the timber and the methods. Wording and photography will be supplied by the business.
            </p>
            <p className="mt-6">
              <Link href="/about" className="link-draw inline-flex items-center gap-2 text-[0.8125rem] font-medium uppercase tracking-[0.14em]">
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
      <section id="showroom" aria-labelledby="showroom-title" className="scroll-mt-4 border-t border-border bg-paper-deep">
        <div className="container-page grid gap-10 section-y md:grid-cols-12 md:gap-16 ">
          <div className="md:col-span-5">
            <p className="eyebrow">The showroom</p>
            <h2 id="showroom-title" className="font-display mt-5 text-headline text-walnut">
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
                    <a href={business.mapUrl} className="link-draw" target="_blank" rel="noopener noreferrer">
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
        <div className="container-page section-y">
          <p className="eyebrow">Contact</p>
          <h2 id="contact-title" className="font-display mt-5 text-headline text-walnut">
            Get in touch
          </h2>
          <p className="mt-4 max-w-xl text-text-muted">Ask about a piece, request a quotation, or arrange a visit.</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/contact" size="cta">
              Send an enquiry
            </ButtonLink>
            {business.phone ? (
              <ButtonLink href={`tel:${business.phone.replace(/\s+/g, "")}`} variant="secondary" size="cta">
                <Phone aria-hidden="true" className="size-4" />
                {business.phone}
              </ButtonLink>
            ) : null}
            {business.whatsapp ? (
              <ButtonLink href={whatsappLink(business.whatsapp, business.phoneCountryCode)} variant="secondary" size="cta" target="_blank" rel="noopener noreferrer">
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
