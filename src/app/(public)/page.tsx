import { ArrowRight, ArrowUpRight, MapPin, MessageCircle, Phone } from "lucide-react";
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

const PLACEHOLDER_CATEGORIES = ["Category one", "Category two", "Category three"];
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

/** Splits a headline into words that rise out of a mask one after another (see .words in globals.css). */
function Words({ text }: { text: string }) {
  return (
    <span className="words">
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`} className="w" aria-hidden="true">
          <span style={{ ["--i" as string]: i }}>{w}</span>
        </span>
      ))}
    </span>
  );
}

const WAYS = [
  { n: "01", title: "Ready-made", body: "Pieces you can see and sit at in the showroom, and take home without the wait.", href: "/products", cta: "Browse the collection" },
  { n: "02", title: "Made to measure", body: "Tell us the piece, the dimensions and the wood. We build it in our workshop and quote before we start.", href: "/custom", cta: "Start an enquiry" },
  { n: "03", title: "Visit the showroom", body: "Come and see the timber, the finishes and the joinery for yourself, and talk it through with us.", href: "/contact", cta: "Plan a visit" },
];

export default async function HomePage() {
  const [business, categories, featured] = await Promise.all([
    getBusinessSettings(),
    safe(() => listPublicCategories(), []),
    safe<PublicCard[]>(() => listFeaturedProducts(3), []),
  ]);
  const shown = categories.filter((c) => c.count > 0).slice(0, 3);
  const marqueeItems = categories.length > 0 ? categories.map((c) => c.name) : MARQUEE_FALLBACK;

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="wood-dark-bg relative isolate overflow-hidden text-ivory">
        <div aria-hidden="true" className="hero-glow" />
        <div className="container-page relative grid items-center gap-14 py-[clamp(4.5rem,2rem+8vw,9rem)] md:grid-cols-12">
          <div className="md:col-span-7">
            <p className="eyebrow rise-in !text-linen-dark">Furniture · Showroom · Workshop</p>
            <h1 id="hero-title" aria-label="Wood furniture for the way you live." className="font-display mt-8 text-display text-ivory">
              <Words text="Wood furniture for the way you live." />
            </h1>
            <p className="rise-in rise-in-3 mt-9 max-w-md text-lg leading-relaxed text-ivory/80">
              Choose from ready-made pieces in our showroom, or have something built to your measurements in our workshop.
            </p>
            <div className="rise-in rise-in-3 mt-11 flex flex-wrap gap-4">
              <ButtonLink href="/custom" size="cta" variant="light">
                Start a custom enquiry
              </ButtonLink>
              <ButtonLink href="/products" size="cta" className="!border-ivory/40 !bg-ivory/10 !text-ivory backdrop-blur-md hover:!bg-ivory hover:!text-walnut">
                Browse the collection
              </ButtonLink>
            </div>
          </div>
          <div className="rise-in rise-in-3 md:col-span-5">
            <div className="float-slow">
              <div className="frame-offset">
                <div className="relative">
                  <ImagePlaceholder label="Hero — a finished piece in a lived-in room" tone="wood-a" className="aspect-[4/5] w-full" />
                  <div className="glass-dark absolute inset-x-5 top-5 z-10 !bg-walnut-dark/55 px-5 py-4 text-ivory sm:-left-10 sm:right-auto sm:top-10 sm:w-[17rem]">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-linen">Made to measure</p>
                    <p className="font-display mt-2 text-xl leading-snug">Quoted before we start.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative border-t border-ivory/15 py-6 text-ivory/80">
          <Marquee items={marqueeItems} />
        </div>
      </section>

      {/* Three ways in: hairline container grid */}
      <section aria-labelledby="ways-title" className="orbs section-y">
        <div className="container-page">
          <Reveal>
            <p className="eyebrow">How we work</p>
            <h2 id="ways-title" className="font-display mt-5 max-w-2xl text-headline text-walnut">
              Three ways to find the right piece.
            </h2>
          </Reveal>
          <div className="bento mt-14 md:grid-cols-3">
            {WAYS.map((w, i) => (
              <Reveal key={w.n} delay={i * 120}>
                <Link href={w.href} className="bento-cell group h-full min-h-[22rem]">
                  <span className="bento-num numeral text-[4.5rem] md:text-[5.5rem]">{w.n}</span>
                  <h3 className="font-display mt-auto pt-16 text-[2rem] leading-tight">{w.title}</h3>
                  <p className="bento-muted mt-3 max-w-xs text-sm leading-relaxed text-text-muted">{w.body}</p>
                  <span className="mt-8 inline-flex items-center gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.14em]">
                    {w.cta}
                    <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:translate-x-1.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Collections: staggered full-bleed tiles */}
      <section aria-labelledby="collections-title" className="bg-paper-deep/55 section-y">
        <div className="container-page">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Reveal>
              <p className="eyebrow">The collection</p>
              <h2 id="collections-title" className="font-display mt-5 text-headline text-walnut">
                Browse by category
              </h2>
            </Reveal>
            {shown.length > 0 ? (
              <Reveal variant="fade">
                <Link href="/products" className="link-draw inline-flex items-center gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.14em]">
                  View everything <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Reveal>
            ) : (
              <p className="max-w-sm text-sm text-text-muted">Placeholder categories, replaced automatically once products are published.</p>
            )}
          </div>
          <ul className="mt-14 grid gap-6 sm:grid-cols-3 md:gap-8">
            {(shown.length > 0 ? shown.map((c) => ({ key: c.id, name: c.name, href: `/products?category=${c.slug}`, sub: `${c.count} ${c.count === 1 ? "piece" : "pieces"}` })) : PLACEHOLDER_CATEGORIES.map((n) => ({ key: n, name: n, href: "", sub: "" }))).map((c, i) => {
              const inner = (
                <>
                  <div className="tile-media">
                    <ImagePlaceholder label={`${c.name} — category photograph`} className="size-full" compact />
                  </div>
                  {c.href ? (
                    <span className="tile-arrow" aria-hidden="true">
                      <ArrowUpRight className="size-5" strokeWidth={1.5} />
                    </span>
                  ) : null}
                  <span className="tile-body">
                    <span className="font-display block text-[2rem] leading-tight">{c.name}</span>
                    {c.sub ? <span className="mt-1 block text-sm text-ivory/80">{c.sub}</span> : null}
                  </span>
                </>
              );
              return (
                <Reveal as="li" key={c.key} delay={i * 130} className={i === 1 ? "sm:mt-14" : i === 2 ? "sm:mt-28" : undefined}>
                  {c.href ? (
                    <Link href={c.href} className="tile group aspect-[3/4]">
                      {inner}
                    </Link>
                  ) : (
                    <div className="tile aspect-[3/4]">{inner}</div>
                  )}
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Featured pieces */}
      {featured.length > 0 ? (
        <section aria-labelledby="featured-title" className="orbs section-y">
          <div className="container-page">
            <Reveal>
              <p className="eyebrow">Selected work</p>
              <h2 id="featured-title" className="font-display mt-5 text-headline text-walnut">
                Featured pieces
              </h2>
            </Reveal>
            <ul className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p, i) => (
                <Reveal as="li" key={p.id} delay={i * 120}>
                  <ProductCard product={p} currency={business.currency} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Process: four steps joined by a line that draws itself */}
      <section id="custom" aria-labelledby="custom-title" className="wood-dark-bg relative isolate scroll-mt-4 overflow-hidden text-ivory">
        <div aria-hidden="true" className="hero-glow" />
        <div className="container-page relative section-y">
          <div className="grid gap-8 md:grid-cols-12 md:items-end">
            <Reveal className="md:col-span-8">
              <p className="eyebrow !text-linen-dark">Made to order</p>
              <h2 id="custom-title" className="font-display mt-5 text-headline">
                Made to your measurements.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ivory/80">
                Have something specific in mind? Tell us the piece, the dimensions and the wood you prefer, and we will respond with a quotation.
              </p>
            </Reveal>
            <Reveal variant="fade" className="md:col-span-4 md:text-right">
              <ButtonLink href="/custom" size="cta" variant="light">
                Request a quotation
                <ArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
            </Reveal>
          </div>
          <div className="relative mt-20">
          <Reveal variant="fade" delay={200} className="rule-line absolute inset-x-0 top-[1.1rem] hidden h-px md:block" />
          <ol className="relative grid gap-10 md:grid-cols-4 md:gap-8">
            {CUSTOM_STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={250 + i * 160} className="glass-dark relative p-6">
                <span aria-hidden="true" className="relative z-10 mb-8 grid size-9 place-items-center border border-brass bg-walnut-dark text-sm font-semibold text-linen-dark">
                  {i + 1}
                </span>
                <h3 className="font-display text-[1.625rem] leading-tight">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ivory/75">{s.body}</p>
              </Reveal>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* Workshop */}
      {/* overflow-x-clip: the slide-in reveals start 40px off to the side and must not widen the page */}
      <section id="workshop" aria-labelledby="workshop-title" className="section-y scroll-mt-4 overflow-x-clip">
        <div className="container-page grid items-center gap-16 md:grid-cols-12 md:gap-20">
          <Reveal variant="right" className="md:order-2 md:col-span-6">
            <p className="eyebrow">The workshop</p>
            <h2 id="workshop-title" className="font-display mt-5 text-headline text-walnut">
              Craftsmanship, up close.
            </h2>
            <p className="mt-6 max-w-lg leading-relaxed text-text-muted">
              This section is for the story of the workshop: the people, the timber and the methods. Wording and photography will be supplied by the business.
            </p>
            <p className="mt-8">
              <Link href="/about" className="link-draw inline-flex items-center gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.14em]">
                About the workshop <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </p>
          </Reveal>
          <Reveal variant="left" className="md:order-1 md:col-span-6">
            <div className="frame-offset frame-offset-left">
              <ImagePlaceholder label="Workshop — joinery or finishing detail" tone="wood-b" className="aspect-[4/3] w-full" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Showroom */}
      <section id="showroom" aria-labelledby="showroom-title" className="bg-paper-deep/55 section-y scroll-mt-4">
        <div className="container-page grid gap-14 md:grid-cols-12 md:gap-16">
          <Reveal className="md:col-span-5">
            <p className="eyebrow">The showroom</p>
            <h2 id="showroom-title" className="font-display mt-5 text-headline text-walnut">
              Visit the showroom.
            </h2>
            <dl className="mt-10 space-y-8 border-t border-border pt-8 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.16em]">
                  <MapPin aria-hidden="true" className="size-4 text-walnut" strokeWidth={1.5} />
                  Address
                </dt>
                <dd className="mt-2 whitespace-pre-line text-base text-text-muted">{business.address ?? "Showroom address to be added."}</dd>
                {business.address && business.mapUrl ? (
                  <dd className="mt-3">
                    <a href={business.mapUrl} className="link-draw" target="_blank" rel="noopener noreferrer">
                      View on map<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.16em]">Opening hours</dt>
                <dd className="mt-2 whitespace-pre-line text-base text-text-muted">{business.openingHours ?? "Opening hours to be added."}</dd>
              </div>
            </dl>
          </Reveal>
          <Reveal variant="zoom" delay={100} className="md:col-span-7">
            <ImagePlaceholder label="Showroom interior" tone="wood-c" className="aspect-[16/11] w-full" />
          </Reveal>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" aria-labelledby="contact-title" className="orbs section-y text-center">
        <Reveal className="container-page">
          <p className="eyebrow justify-center">Contact</p>
          <h2 id="contact-title" className="font-display mx-auto mt-6 max-w-3xl text-display text-walnut">
            Let&rsquo;s talk about your piece.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-text-muted">Ask about a piece, request a quotation, or arrange a visit.</p>
          <div className="mt-11 flex flex-wrap justify-center gap-4">
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
      </section>
    </>
  );
}
