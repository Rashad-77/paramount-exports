import { ArrowRight, ArrowUpRight, Hammer, MapPin, MessageCircle, Phone, Ruler, Store } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { Marquee } from "@/components/public/marquee";
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
const MARQUEE_FALLBACK = ["Dining", "Seating", "Storage", "Made to measure", "Showroom", "Workshop"];

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
  const marqueeItems = categories.length > 0 ? categories.map((c) => c.name) : MARQUEE_FALLBACK;

  return (
    <>
      {/* Hero: polished wood, a short welcome and a drifting wall of photographs */}
      <section aria-labelledby="hero-title" className="wood-band phero on-wood relative">
        <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-6">
            <p className="eyebrow rise-in">Showroom and workshop</p>
            <h1 id="hero-title" className="font-display rise-in rise-in-2 mt-4">
              Wood furniture for the way <em>you live.</em>
            </h1>
            <p className="rise-in rise-in-3 mt-5 max-w-md text-base leading-relaxed on-wood-muted sm:text-lg">
              Choose from ready-made pieces in our showroom, or have something built to your measurements in our workshop.
            </p>
            <div className="rise-in rise-in-3 mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/products" size="cta" variant="light">
                Browse the collection
                <ArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
              <ButtonLink href="/custom" size="cta" variant="onDark">
                Start a custom enquiry
              </ButtonLink>
            </div>
            <div className="proof rise-in rise-in-3">
              <div>
                <Store aria-hidden="true" className="size-6 text-[var(--leaf)]" strokeWidth={1.5} />
                <span>
                  <b>Ready-made</b>
                  Pieces to see in the showroom
                </span>
              </div>
              <div>
                <Ruler aria-hidden="true" className="size-6 text-[var(--leaf)]" strokeWidth={1.5} />
                <span>
                  <b>Made to measure</b>
                  Quoted before we start
                </span>
              </div>
              <div>
                <Hammer aria-hidden="true" className="size-6 text-[var(--leaf)]" strokeWidth={1.5} />
                <span>
                  <b>Built in our workshop</b>
                  By people you can visit
                </span>
              </div>
            </div>
          </div>
          <div className="collage rise-in rise-in-3 md:col-span-6">
            <ImagePlaceholder label="Hero — a finished piece in a lived-in room" className="c1" />
            <ImagePlaceholder label="Hero — detail of the joinery" className="c2" />
            <ImagePlaceholder label="Hero — a second piece in the showroom" className="c3" />
          </div>
        </div>
        <span aria-hidden="true" className="scrollcue" />
      </section>

      <Marquee items={marqueeItems} />

      {/* Categories */}
      <section aria-labelledby="categories-title" className="section-y pt-[calc(var(--section-space)-1.5rem)]">
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
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-text">
                        <span className="link-draw-hover">{c.name}</span>
                      </p>
                      {c.sub ? <p className="text-[0.8125rem] text-text-muted">{c.sub}</p> : null}
                    </div>
                    {c.href ? (
                      <span aria-hidden="true" className="arrow grid size-8 shrink-0 place-items-center border border-border text-brand">
                        <ArrowUpRight className="size-4" strokeWidth={1.75} />
                      </span>
                    ) : null}
                  </div>
                </>
              );
              return (
                <Reveal as="li" key={c.key} delay={i * 90}>
                  {c.href ? (
                    <Link href={c.href} className="cat group">
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
                  <Reveal as="li" key={p.id} delay={(i % 4) * 90}>
                    <ProductCard product={p} currency={business.currency} />
                  </Reveal>
                ))
              : PLACEHOLDER_PIECES.map((n, i) => (
                  <Reveal as="li" key={n} delay={i * 90}>
                    <div className="zoom-frame aspect-[4/5]">
                      <ImagePlaceholder label={n} className="size-full" />
                    </div>
                    <p className="mt-3.5 text-base font-semibold text-text">{n}</p>
                    <p className="text-[0.8125rem] text-text-muted">Name and details appear once products are published.</p>
                  </Reveal>
                ))}
          </ul>
        </div>
      </section>

      {/* Three ways in */}
      <section aria-labelledby="ways-title" className="section-y">
        <div className="container-page">
          <SectionHead id="ways-title" eyebrow="How we work" title="Three ways to find the right piece." />
          <div className="bento mt-7">
            <Reveal className="half">
              <Link href="/products" className="bcard group h-full">
                <span className="ico">
                  <Store aria-hidden="true" className="size-6" strokeWidth={1.5} />
                </span>
                <h3 className="text-xl font-bold text-text">Ready-made</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">Pieces you can see and sit at in the showroom, and take home without the wait.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                  Browse the collection <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </span>
              </Link>
            </Reveal>
            <Reveal className="big" delay={100}>
              <Link href="/custom" className="bcard wood wood-band on-wood gloss group h-full">
                <span className="ico">
                  <Ruler aria-hidden="true" className="size-6" strokeWidth={1.5} />
                </span>
                <h3 className="text-2xl font-bold text-white">Made to measure</h3>
                <p className="mt-2 max-w-md text-base leading-relaxed on-wood-muted">Tell us the piece, the dimensions and the wood. We build it in our workshop and quote before we start.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--leaf)]">
                  Start an enquiry <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </span>
              </Link>
            </Reveal>
            <Reveal className="wide" delay={150}>
              <Link href="/contact" className="bcard group flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <span className="ico !mb-0 shrink-0">
                    <MapPin aria-hidden="true" className="size-6" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-text">Visit the showroom</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">Come and see the timber, the finishes and the joinery for yourself, and talk it through with us.</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
                  Plan a visit <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Made to order: four steps */}
      <section id="custom" aria-labelledby="custom-title" className="scroll-mt-4 border-y border-border bg-mint/70 section-y">
        <div className="container-page">
          <div className="grid items-end gap-6 md:grid-cols-12">
            <Reveal className="md:col-span-8">
              <p className="eyebrow">Made to order</p>
              <h2 id="custom-title" className="font-display mt-3 text-headline text-brand">
                Made to your measurements.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-text-muted">Have something specific in mind? Tell us the piece, the dimensions and the wood you prefer, and we will respond with a quotation.</p>
            </Reveal>
            <Reveal variant="fade" className="md:col-span-4 md:text-right">
              <ButtonLink href="/custom" size="cta">
                Request a quotation
              </ButtonLink>
            </Reveal>
          </div>
          <ol className="steps mt-10">
            {CUSTOM_STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 130} className="step">
                <span aria-hidden="true" className="num">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold text-text">{s.title}</h3>
                <p className="mt-1.5 max-w-[30ch] text-sm leading-relaxed text-text-muted">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Showroom visit, on wood */}
      <section id="showroom" aria-labelledby="showroom-title" className="wood-band on-wood scroll-mt-4 section-y">
        <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-12">
          <Reveal className="md:col-span-5">
            <p className="eyebrow">The showroom</p>
            <h2 id="showroom-title" className="font-display mt-3 text-headline text-white">
              Visit the showroom.
            </h2>
            <div className="mt-6 grid gap-3">
              <div className="vcard">
                <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--leaf)]">
                  <MapPin aria-hidden="true" className="size-4" strokeWidth={1.75} />
                  Address
                </p>
                <p className="mt-1.5 whitespace-pre-line text-base text-white">{business.address ?? "Showroom address to be added."}</p>
                {business.address && business.mapUrl ? (
                  <a href={business.mapUrl} className="link-draw mt-2 inline-block text-sm text-[var(--leaf)]" target="_blank" rel="noopener noreferrer">
                    View on map<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : null}
              </div>
              <div className="vcard">
                <p className="text-[0.8125rem] font-semibold text-[var(--leaf)]">Opening hours</p>
                <p className="mt-1.5 whitespace-pre-line text-base text-white">{business.openingHours ?? "Opening hours to be added."}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/contact" size="cta" variant="light">
                Send an enquiry
              </ButtonLink>
              {business.phone ? (
                <ButtonLink href={`tel:${business.phone.replace(/\s+/g, "")}`} variant="onDark" size="cta">
                  <Phone aria-hidden="true" className="size-4" />
                  {business.phone}
                </ButtonLink>
              ) : null}
              {business.whatsapp ? (
                <ButtonLink href={whatsappLink(business.whatsapp, business.phoneCountryCode)} variant="onDark" size="cta" target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" className="size-4" />
                  WhatsApp
                  <span className="sr-only"> (opens in a new tab)</span>
                </ButtonLink>
              ) : null}
            </div>
          </Reveal>
          <Reveal variant="zoom" delay={100} className="md:col-span-7">
            <ImagePlaceholder label="Showroom interior" className="aspect-[16/11] w-full border border-ivory/20" />
          </Reveal>
        </div>
      </section>

      {/* Closing band */}
      <section aria-labelledby="cta-title" className="section-y">
        <div className="container-page">
          <Reveal className="ctaband gloss gloss-loop">
            <h2 id="cta-title" className="font-display max-w-[18ch] text-headline text-white">
              Let&rsquo;s talk about your piece.
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-white/90">Ask about a piece, request a quotation, or arrange a visit.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/contact" size="cta" variant="light">
                Send an enquiry
              </ButtonLink>
              <ButtonLink href="/products" size="cta" variant="onDark">
                Browse the collection
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
