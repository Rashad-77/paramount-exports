import { ArrowRight, Hammer, MapPin, MessageCircle, Phone, Ruler, Store } from "lucide-react";
import Link from "next/link";
import { HeroVideo } from "@/components/public/hero-video";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { ProductCard } from "@/components/public/product-card";
import { Reveal } from "@/components/public/reveal";
import { SiteImage } from "@/components/public/site-image";
import { ButtonLink } from "@/components/ui/button";
import { whatsappLink } from "@/lib/contact";
import { CUSTOM_STEPS } from "@/lib/custom-steps";
import { hasDatabase } from "@/lib/env";
import { HERO_VIDEO } from "@/lib/home-media";
import { getBusinessSettings } from "@/lib/settings";
import { listFeaturedProducts, listGalleryProjects, listPublicCategories, type PublicCard } from "@/server/catalogue-public";

// Settings and catalogue change rarely; refresh the static page at most every 5 minutes.
export const revalidate = 300;

/** One stagger step for every list on the page, so everything arrives with the same rhythm. */
const STEP = 80;

const PLACEHOLDER_CATEGORIES = ["Category one", "Category two", "Category three", "Category four", "Category five", "Category six"];
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

function SectionHead({ id, eyebrow, title, link, onWood = false }: { id: string; eyebrow: string; title: string; link?: { href: string; label: string }; onWood?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <Reveal>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className={"font-display mt-3 text-headline " + (onWood ? "text-white" : "text-brand")}>
          {title}
        </h2>
      </Reveal>
      {link ? (
        <Reveal>
          <Link href={link.href} className={"fill-hover -mx-1 inline-flex items-center gap-2 px-1 text-sm font-semibold " + (onWood ? "text-[var(--leaf)]" : "text-brand")}>
            {link.label} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Reveal>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const [business, categories, featured, projects] = await Promise.all([
    getBusinessSettings(),
    safe(() => listPublicCategories(), []),
    safe<PublicCard[]>(() => listFeaturedProducts(8), []),
    safe(() => listGalleryProjects(), []),
  ]);
  const shown = categories.filter((c) => c.count > 0).slice(0, 6);
  const projectImages: { id: string; url: string; alt: string; project: string }[] = projects.flatMap((p) => p.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt, project: p.title }))).slice(0, 5);
  const mosaic = projectImages.length > 0 ? projectImages : Array.from({ length: 5 }, (_, i) => ({ id: `ph-${i}`, url: "", alt: "", project: `Project ${i + 1}` }));

  return (
    <>
      {/* 1. Hero: full-screen video */}
      <section aria-labelledby="hero-title" className="vhero on-wood">
        <HeroVideo desktop={HERO_VIDEO.desktop} mobile={HERO_VIDEO.mobile} poster={HERO_VIDEO.poster} />
        <div className="container-page w-full pt-24 pb-[clamp(3rem,7vw,5.5rem)]">
          <div className="max-w-2xl">
            <p className="eyebrow rise-in">Showroom and workshop</p>
            <h1 id="hero-title" className="rise-in rise-in-2 mt-4">
              Wood furniture for the way <em>you live.</em>
            </h1>
            <p className="rise-in rise-in-3 mt-5 max-w-lg text-base leading-relaxed text-white/90 sm:text-lg">
              Choose from ready-made pieces in our showroom, or have something built to your measurements in our workshop.
            </p>
            <div className="rise-in rise-in-3 mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/products" size="cta" variant="light">
                Browse the collection
              </ButtonLink>
              <ButtonLink href="/custom" size="cta" variant="onDark">
                Start a custom enquiry
              </ButtonLink>
            </div>
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
              <MapPin aria-hidden="true" className="size-6 text-[var(--leaf)]" strokeWidth={1.5} />
              <span>
                <b>Showroom visits</b>
                See the timber in person
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Categories */}
      <section aria-labelledby="categories-title" className="section-y">
        <div className="container-page">
          <SectionHead id="categories-title" eyebrow="The collection" title="Shop by category" link={shown.length > 0 ? { href: "/products", label: "View everything" } : undefined} />
          <ul className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(shown.length > 0
              ? shown.map((c) => ({ key: c.id, name: c.name, href: `/products?category=${c.slug}`, sub: `${c.count} ${c.count === 1 ? "piece" : "pieces"}` }))
              : PLACEHOLDER_CATEGORIES.map((n) => ({ key: n, name: n, href: "", sub: "Photographs to be supplied" }))
            ).map((c, i) => {
              const inner = (
                <>
                  <div className="thumb zoom-frame">
                    <ImagePlaceholder label={`${c.name} — category photograph`} className="size-full" compact />
                  </div>
                  <div className="body">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-text">{c.name}</p>
                      <p className="text-[0.8125rem] text-text-muted">{c.sub}</p>
                    </div>
                    {c.href ? (
                      <span aria-hidden="true" className="go">
                        <ArrowRight className="size-4" strokeWidth={1.75} />
                      </span>
                    ) : null}
                  </div>
                </>
              );
              return (
                <Reveal as="li" key={c.key} delay={(i % 3) * STEP}>
                  {c.href ? (
                    <Link href={c.href} className="catrow group">
                      {inner}
                    </Link>
                  ) : (
                    <div className="catrow">{inner}</div>
                  )}
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 3. Featured pieces */}
      <section aria-labelledby="featured-title" className="border-y border-border bg-white section-y">
        <div className="container-page">
          <SectionHead id="featured-title" eyebrow="On the showroom floor" title="Featured pieces" link={featured.length > 0 ? { href: "/products", label: "See the full collection" } : undefined} />
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {featured.length > 0
              ? featured.map((p, i) => (
                  <Reveal as="li" key={p.id} delay={(i % 4) * STEP}>
                    <ProductCard product={p} currency={business.currency} />
                  </Reveal>
                ))
              : PLACEHOLDER_PIECES.map((n, i) => (
                  <Reveal as="li" key={n} delay={i * STEP}>
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

      {/* 4. Two ways to buy */}
      <section aria-labelledby="ways-title" className="section-y">
        <div className="container-page">
          <SectionHead id="ways-title" eyebrow="Two ways to buy" title="Take it home, or have it made." />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {[
              { title: "Ready-made", body: "Pieces you can see and sit at in the showroom, and take home without the wait.", href: "/products", cta: "Browse the collection", label: "Ready-made — a piece on the showroom floor" },
              { title: "Made to measure", body: "Your dimensions, your choice of wood and finish. We quote before we start and build it in our workshop.", href: "/custom", cta: "Start a custom enquiry", label: "Made to measure — a piece being built" },
            ].map((w, i) => (
              <Reveal key={w.title} delay={i * STEP}>
                <Link href={w.href} className="group block border border-border bg-white">
                  <div className="zoom-frame aspect-[16/10]">
                    <ImagePlaceholder label={w.label} className="size-full" />
                  </div>
                  <div className="p-6 md:p-8">
                    <h3 className="text-2xl font-bold tracking-tight text-brand">{w.title}</h3>
                    <p className="mt-2 max-w-md text-base leading-relaxed text-text-muted">{w.body}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                      {w.cta} <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How custom works */}
      <section id="custom" aria-labelledby="custom-title" className="scroll-mt-24 border-y border-border bg-mint/70 section-y">
        <div className="container-page">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <Reveal>
              <p className="eyebrow">Made to order</p>
              <h2 id="custom-title" className="font-display mt-3 text-headline text-brand">
                How a custom piece is made.
              </h2>
            </Reveal>
            <Reveal>
              <ButtonLink href="/custom" size="cta">
                Request a quotation
              </ButtonLink>
            </Reveal>
          </div>
          <ol className="steps mt-10">
            {CUSTOM_STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * STEP} className="step">
                <span aria-hidden="true" className="num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-base font-semibold text-text">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. From the workshop */}
      <section aria-labelledby="workshop-title" className="section-y">
        <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-12">
          <Reveal className="md:col-span-7">
            <div className="zoom-frame aspect-[4/3]">
              <ImagePlaceholder label="Workshop — joinery or finishing detail" className="size-full" />
            </div>
          </Reveal>
          <Reveal delay={STEP} className="md:col-span-5">
            <p className="eyebrow">The workshop</p>
            <h2 id="workshop-title" className="font-display mt-3 text-headline text-brand">
              Made in our own workshop.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-text-muted">
              Ready-made and made-to-order pieces are built in our workshop. Read about the people, the timber and the methods behind them.
            </p>
            <Link href="/about" className="fill-hover -mx-1 px-1 mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              About the workshop <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* 7. Recent projects */}
      <section aria-labelledby="projects-title" className="border-t border-border bg-white section-y">
        <div className="container-page">
          <SectionHead id="projects-title" eyebrow="Gallery" title="Recent projects" link={{ href: "/gallery", label: "See the gallery" }} />
          <ul className="mt-8 grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[14rem] md:grid-cols-4">
            {mosaic.map((img, i) => (
              <Reveal as="li" key={img.id} delay={i * STEP} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                <Link href="/gallery" className="group zoom-frame relative block size-full">
                  {img.url ? (
                    <SiteImage src={img.url} alt={img.alt || img.project} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                  ) : (
                    <ImagePlaceholder label={`${img.project} — photograph`} className="size-full" />
                  )}
                  <span className="sr-only">{img.project}</span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 8. Visit the showroom */}
      <section id="showroom" aria-labelledby="showroom-title" className="wood-band on-wood scroll-mt-24 section-y">
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
                  <a href={business.mapUrl} className="fill-hover -mx-1 px-1 mt-2 inline-block text-sm text-[var(--leaf)]" target="_blank" rel="noopener noreferrer">
                    View on map<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : null}
              </div>
              <div className="vcard">
                <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--leaf)]">
                  <Hammer aria-hidden="true" className="size-4" strokeWidth={1.75} />
                  Opening hours
                </p>
                <p className="mt-1.5 whitespace-pre-line text-base text-white">{business.openingHours ?? "Opening hours to be added."}</p>
              </div>
            </div>
            {business.phone || business.whatsapp ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {business.phone ? (
                  <ButtonLink href={`tel:${business.phone.replace(/\s+/g, "")}`} variant="light" size="cta">
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
            ) : null}
          </Reveal>
          <Reveal delay={STEP} className="md:col-span-7">
            <div className="zoom-frame aspect-[16/11] border border-white/20">
              <ImagePlaceholder label="Showroom interior" className="size-full" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 9. Closing enquiry band */}
      <section aria-labelledby="cta-title" className="section-y">
        <div className="container-page">
          <Reveal className="ctaband">
            <h2 id="cta-title" className="font-display max-w-[18ch] text-headline text-white">
              Let&rsquo;s talk about your piece.
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-white/95">Ask about a piece, request a quotation, or arrange a visit.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/contact" size="cta" variant="light">
                Enquire
              </ButtonLink>
              {business.whatsapp ? (
                <ButtonLink href={whatsappLink(business.whatsapp, business.phoneCountryCode)} variant="onDark" size="cta" target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" className="size-4" />
                  WhatsApp
                  <span className="sr-only"> (opens in a new tab)</span>
                </ButtonLink>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
