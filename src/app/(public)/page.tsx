import { ArrowRight, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { ProductCard } from "@/components/public/product-card";
import { Reveal } from "@/components/public/reveal";
import { ButtonLink } from "@/components/ui/button";
import { whatsappLink } from "@/lib/contact";
import { CUSTOM_STEPS } from "@/lib/custom-steps";
import { hasDatabase } from "@/lib/env";
import { getBusinessSettings } from "@/lib/settings";
import { listFeaturedProducts, listPublicCategories, type PublicCard } from "@/server/catalogue-public";

// Settings and catalogue change rarely; refresh the static page at most every 5 minutes.
export const revalidate = 300;

const PLACEHOLDER_CATEGORIES = ["Category one", "Category two", "Category three", "Category four"];
const PLACEHOLDER_PIECES = ["Featured piece one", "Featured piece two", "Featured piece three", "Featured piece four"];

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("Homepage data unavailable", e instanceof Error ? e.message : "unknown");
    return fallback;
  }
}

function SectionHead({ id, eyebrow, title, link }: { id: string; eyebrow: string; title: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <Reveal>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="font-display mt-3 text-headline text-brand">
          {title}
        </h2>
      </Reveal>
      {link ? (
        <Reveal variant="fade">
          <Link href={link.href} className="link-draw inline-flex items-center gap-2 text-sm font-semibold text-brand">
            {link.label} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Reveal>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const [business, categories, featured] = await Promise.all([
    getBusinessSettings(),
    safe(() => listPublicCategories(), []),
    safe<PublicCard[]>(() => listFeaturedProducts(8), []),
  ]);
  const shown = categories.filter((c) => c.count > 0).slice(0, 4);

  return (
    <>
      {/* Hero: a short welcome beside a wall of photographs */}
      <section aria-labelledby="hero-title" className="border-b border-border bg-gradient-to-b from-white to-mint">
        <div className="container-page grid items-center gap-8 py-8 md:grid-cols-12 md:gap-10 md:py-12">
          <div className="md:col-span-5">
            <p className="eyebrow rise-in">Showroom and workshop</p>
            <h1 id="hero-title" className="font-display rise-in rise-in-2 mt-4 text-display text-brand">
              Wood furniture for the way you live.
            </h1>
            <p className="rise-in rise-in-3 mt-4 max-w-md text-base leading-relaxed text-text-muted">
              Choose from ready-made pieces in our showroom, or have something built to your measurements in our workshop.
            </p>
            <div className="rise-in rise-in-3 mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/products" size="cta">
                Browse the collection
              </ButtonLink>
              <ButtonLink href="/custom" size="cta" variant="secondary">
                Start a custom enquiry
              </ButtonLink>
            </div>
          </div>
          <div className="rise-in rise-in-3 grid h-[22rem] grid-cols-5 grid-rows-2 gap-3 sm:h-[28rem] md:col-span-7">
            <ImagePlaceholder label="Hero — a finished piece in a lived-in room" className="col-span-3 row-span-2" />
            <ImagePlaceholder label="Hero — detail of the joinery" className="col-span-2" />
            <ImagePlaceholder label="Hero — a second piece in the showroom" className="col-span-2" />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-title" className="section-y">
        <div className="container-page">
          <SectionHead id="categories-title" eyebrow="The collection" title="Shop by category" link={shown.length > 0 ? { href: "/products", label: "View everything" } : undefined} />
          <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {(shown.length > 0
              ? shown.map((c) => ({ key: c.id, name: c.name, href: `/products?category=${c.slug}`, sub: `${c.count} ${c.count === 1 ? "piece" : "pieces"}` }))
              : PLACEHOLDER_CATEGORIES.map((n) => ({ key: n, name: n, href: "", sub: "" }))
            ).map((c, i) => {
              const inner = (
                <>
                  <div className="zoom-frame relative aspect-[4/3]">
                    <ImagePlaceholder label={`${c.name} — category photograph`} className="absolute inset-0" />
                  </div>
                  <p className="mt-3 text-base font-semibold text-text">
                    <span className="link-draw-hover">{c.name}</span>
                  </p>
                  {c.sub ? <p className="text-[0.8125rem] text-text-muted">{c.sub}</p> : null}
                </>
              );
              return (
                <Reveal as="li" key={c.key} delay={i * 80}>
                  {c.href ? (
                    <Link href={c.href} className="group block">
                      {inner}
                    </Link>
                  ) : (
                    <div className="group">{inner}</div>
                  )}
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Featured pieces: the showroom floor */}
      <section aria-labelledby="featured-title" className="border-y border-border bg-white section-y">
        <div className="container-page">
          <SectionHead id="featured-title" eyebrow="On the showroom floor" title="Featured pieces" link={featured.length > 0 ? { href: "/products", label: "See the full collection" } : undefined} />
          <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-9 lg:grid-cols-4">
            {featured.length > 0
              ? featured.map((p, i) => (
                  <Reveal as="li" key={p.id} delay={(i % 4) * 80}>
                    <ProductCard product={p} currency={business.currency} />
                  </Reveal>
                ))
              : PLACEHOLDER_PIECES.map((n, i) => (
                  <Reveal as="li" key={n} delay={i * 80}>
                    <div className="aspect-[4/5]">
                      <ImagePlaceholder label={n} className="size-full" />
                    </div>
                    <p className="mt-3.5 text-base font-semibold text-text">{n}</p>
                    <p className="text-[0.8125rem] text-text-muted">Name and details appear once products are published.</p>
                  </Reveal>
                ))}
          </ul>
        </div>
      </section>

      {/* Made to measure */}
      <section id="custom" aria-labelledby="custom-title" className="scroll-mt-4 bg-mint/60 section-y">
        <div className="container-page grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <Reveal variant="zoom">
            <ImagePlaceholder label="Made to order — a piece in the workshop" className="aspect-[4/3] w-full" />
          </Reveal>
          <Reveal>
            <p className="eyebrow">Made to order</p>
            <h2 id="custom-title" className="font-display mt-3 text-headline text-brand">
              Made to your measurements.
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-text-muted">
              Have something specific in mind? Tell us the piece, the dimensions and the wood you prefer, and we will respond with a quotation.
            </p>
            <ol className="mt-6 space-y-4">
              {CUSTOM_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center border border-brand text-sm font-semibold text-brand">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-text">{s.title}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-7">
              <ButtonLink href="/custom" size="cta">
                Request a quotation
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Showroom */}
      <section id="showroom" aria-labelledby="showroom-title" className="scroll-mt-4 section-y">
        <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-12">
          <Reveal className="md:col-span-5">
            <p className="eyebrow">The showroom</p>
            <h2 id="showroom-title" className="font-display mt-3 text-headline text-brand">
              Visit the showroom.
            </h2>
            <dl className="mt-6 space-y-6 border-t border-border pt-6 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-[0.8125rem] font-semibold text-text">
                  <MapPin aria-hidden="true" className="size-4 text-brand" strokeWidth={1.75} />
                  Address
                </dt>
                <dd className="mt-1.5 whitespace-pre-line text-base text-text-muted">{business.address ?? "Showroom address to be added."}</dd>
                {business.address && business.mapUrl ? (
                  <dd className="mt-2">
                    <a href={business.mapUrl} className="link-draw text-brand" target="_blank" rel="noopener noreferrer">
                      View on map<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-[0.8125rem] font-semibold text-text">Opening hours</dt>
                <dd className="mt-1.5 whitespace-pre-line text-base text-text-muted">{business.openingHours ?? "Opening hours to be added."}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
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
          </Reveal>
          <Reveal variant="zoom" delay={100} className="md:col-span-7">
            <ImagePlaceholder label="Showroom interior" className="aspect-[16/11] w-full" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
