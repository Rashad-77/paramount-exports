import { ArrowRight, ArrowUpRight, Clock, Hammer, Handshake, Mail, MapPin, Phone, Quote, Ruler, TreeDeciduous } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/public/whatsapp-icon";
import { CountUp } from "@/components/public/count-up";
import { HeroVideo } from "@/components/public/hero-video";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { Reveal } from "@/components/public/reveal";
import { ScrollRow } from "@/components/public/scroll-row";
import { ButtonLink } from "@/components/ui/button";
import { mapEmbedUrl, whatsappLink } from "@/lib/contact";
import { hasDatabase } from "@/lib/env";
import { HERO_VIDEO } from "@/lib/home-media";
import { PROCESS } from "@/lib/process";
import { getBusinessSettings, getPageContent } from "@/lib/settings";
import { parseTestimonials } from "@/lib/testimonials";
import { ProductCard } from "@/components/public/product-card";
import { listPublicCategories, listPublicProducts } from "@/server/catalogue-public";

// Settings and catalogue change rarely; refresh the static page at most every 5 minutes.
export const revalidate = 300;

/** One stagger step for every list on the page, so everything arrives with the same rhythm. */
const STEP = 90;
/** The product rows: always this many, with grey labelled placeholders making up the difference. */
const PRODUCT_ROWS = 7;
const PRODUCT_CARDS = 6;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("Homepage data unavailable", e instanceof Error ? e.message : "unknown");
    return fallback;
  }
}

/** Eyebrow, light display headline and optional intro: the head of every section. */
function Head({ id, eyebrow, title, intro, dark = false, center = false }: { id: string; eyebrow: string; title: ReactNode; intro?: string; dark?: boolean; center?: boolean }) {
  return (
    <Reveal variant="up" className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className={"eyebrow " + (dark ? "eyebrow-light" : "")}>{eyebrow}</p>
      <h2 id={id} className={"font-display mt-4 text-headline " + (dark ? "text-white" : "text-text")}>
        {title}
      </h2>
      {intro ? <p className={"mt-4 max-w-xl fl-a leading-relaxed " + (dark ? "text-white/70" : "text-text-muted")}>{intro}</p> : null}
    </Reveal>
  );
}

const WHY = [
  { icon: TreeDeciduous, title: "Honest materials", body: "Solid timber chosen for the job, with the wood and the finish named on every piece." },
  { icon: Ruler, title: "Made to measure", body: "Your dimensions, your wood and finish, agreed with you before we start." },
  { icon: Hammer, title: "Built in our workshop", body: "Ready-made and custom pieces are made by the people whose showroom you can visit." },
  { icon: Handshake, title: "Order your way", body: "Order online and pay on delivery, by bank transfer, or at the showroom." },
];

const SERVICES = [
  { title: "Ready-made pieces", body: "See and sit at them on the showroom floor." },
  { title: "Made to measure", body: "Built to your size, in your choice of wood." },
  { title: "Wood and finish", body: "Choose the timber, the stain and the sheen." },
  { title: "Delivery arranged", body: "We agree the charge and the day with you." },
  { title: "Showroom visits", body: "Come and see the timber in person." },
  { title: "Pay when it arrives", body: "Nothing is charged on this website." },
];

const CARD_W = "w-[78%] shrink-0 snap-start sm:w-[47%] lg:w-[31%]";

export default async function HomePage() {
  const [business, pages, categories, products] = await Promise.all([
    getBusinessSettings(),
    getPageContent(),
    safe(() => listPublicCategories(), []),
    safe(async () => (await listPublicProducts({ page: 1 })).items.slice(0, PRODUCT_CARDS), []),
  ]);
  const reviews = parseTestimonials(pages.testimonials);
  // One band per group, with the categories under it as the note.
  const groups = categories.filter((c) => !c.parentId);
  const rows = groups.slice(0, PRODUCT_ROWS).map((g) => {
    const kids = categories.filter((c) => c.parentId === g.id).map((c) => c.name);
    return { key: g.id, name: g.name, href: `/products?category=${g.slug}`, all: kids.join(" · "), lines: kids.length > 6 ? [kids.slice(0, 5).join(" · "), kids.slice(5).join(" · ")] : [], note: kids.length > 0 ? kids.slice(0, 4).join(" · ") + (kids.length > 4 ? " · …" : "") : g.count > 0 ? `${g.count} ${g.count === 1 ? "piece" : "pieces"}` : "Made to order" };
  });
  const reach = [
    business.phone ? { icon: Phone, label: "Call us", value: business.phone, href: `tel:${business.phone.replace(/\s+/g, "")}` } : null,
    business.phoneAlt ? { icon: Phone, label: "Call us", value: business.phoneAlt, href: `tel:${business.phoneAlt.replace(/\s+/g, "")}` } : null,
    business.email ? { icon: Mail, label: "Email", value: business.email, href: `mailto:${business.email}` } : null,
    business.whatsapp ? { icon: WhatsAppIcon, label: "WhatsApp", value: "WhatsApp", href: whatsappLink(business.whatsapp, business.phoneCountryCode) } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
      {/* 1. Hero */}
      <section aria-labelledby="hero-title" className="vhero on-wood">
        <HeroVideo desktop={HERO_VIDEO.desktop} mobile={HERO_VIDEO.mobile} poster={HERO_VIDEO.poster} />
        <div className="container-page w-full pt-28 pb-16">
          <div className="max-w-xl">
            <h1 id="hero-title" className="font-display rise-in mt-4">
              Expertise in woodworking, readymade or custom-built
            </h1>
            <p className="rise-in rise-in-2 mt-5 max-w-md text-[1.0625rem] leading-relaxed text-white/80">Visit our showroom or order online.</p>
            <div className="rise-in rise-in-3 mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/products" size="cta" variant="light">
                Browse collection
              </ButtonLink>
              <ButtonLink href="/contact#enquiry" size="cta" variant="onDark">
                Make enquiry
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Why choose us */}
      <section aria-labelledby="why-title" className="sec sec-white">
        <div className="container-page">
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <Head id="why-title" eyebrow="Our approach" title={`Why Choose ${business.name}`} />
            <Reveal variant="up" delay={STEP} className="years-mark shrink-0 md:text-right">
              <p className="font-display text-[clamp(3.5rem,2.4rem+4vw,5.5rem)] font-light leading-none tracking-[-0.03em] text-brand">
                <CountUp to={20} suffix="+" />
              </p>
              <p className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-text">Years of woodwork</p>
              <p className="mt-1.5 text-[0.8125rem] text-text-muted">Since 2006, in Kuruwita</p>
            </Reveal>
          </div>
          <ul className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w, i) => (
              <Reveal as="li" key={w.title} variant="up" delay={i * STEP} className="why-cell">
                <w.icon aria-hidden="true" className="size-5 text-timber" strokeWidth={1.25} />
                <h3 className="font-display mt-6 text-[1.05rem] leading-tight text-text">{w.title}</h3>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-text-muted">{w.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Our products: one wide grey band per type of furniture, stacked with no gaps */}
      <section aria-labelledby="products-title" className="sec sec-cream">
        <div className="container-page">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <Head id="products-title" eyebrow="What we make" title="Our Products" />
            <Reveal variant="up" className="shrink-0 pb-1">
              <Link href="/products" className="link-arrow text-text">
                See the full collection <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </Reveal>
          </div>
        </div>
        <div>
          <ul className="mt-12">
            {rows.map((r, i) => (
              <Reveal as="li" key={r.key} variant="up" delay={i * 60}>
                <Link href={r.href} className="prow group">
                  <ImagePlaceholder label={`${r.name} — photograph`} className="absolute inset-0" compact />
                  <span className="container-page relative flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <span className="font-display block fl-b leading-tight text-text">{r.name}</span>
                      <span className="mt-2.5 grid max-w-[34rem] gap-1.5 fl-g font-semibold uppercase leading-snug tracking-[0.1em] text-text/70 sm:tracking-[0.16em]">{r.lines.length > 0 ? r.lines.map((l) => <span key={l}>{l}</span>) : r.all || r.note}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-text transition-transform duration-300 group-hover:translate-x-1.5" strokeWidth={1.5} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Craft: dark band with a collage and the process */}
      <section aria-labelledby="craft-title" className="sec sec-bark">
        <div className="container-page">
          <Head
            id="craft-title"
            eyebrow="Our craftsmanship"
            title={
              <>
                Made With Care.
                <br />
                Crafted From Wood.
              </>
            }
            intro="Every piece moves through the same sequence of hands and machines, from selecting the board to the final coat of finish."
            dark
          />
          <div className="mt-12">
            <Reveal variant="up">
              <div className="process-box">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-white/60">Process</p>
                <ol>
                  {PROCESS.map((st, i) => (
                    <li key={st.title}>
                      <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1">
                        <span className="block fl-a text-white">{st.title}</span>
                        <span className="mt-1 block fl-c leading-snug text-white/65 sm:leading-relaxed">{st.summary}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <Link href="/about#process" className="link-arrow mt-6 self-start text-[var(--leaf)]">
                  See the full process <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5. Made for your space */}
      <section aria-labelledby="space-title" className="sec sec-white">
        <div className="container-page grid items-center gap-12 lg:grid-cols-[0.9fr_1fr] lg:gap-20">
          <Reveal variant="up">
            <div className="zoom-frame mx-auto aspect-[4/5] w-full max-w-sm lg:max-w-none">
              <ImagePlaceholder label="A finished piece in place" className="size-full" compact />
            </div>
          </Reveal>
          <div>
            <Reveal variant="up">
              <p className="eyebrow">Custom woodwork</p>
              <h2 id="space-title" className="font-display mt-4 text-headline text-text">
                Made for Your Space
              </h2>
              <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-text-muted">Choose something from the showroom floor, or tell us the size of the room and we will build to fit.</p>
            </Reveal>
            <ul className="mt-10 grid gap-x-8 sm:grid-cols-2">
              {SERVICES.map((s, i) => (
                <Reveal as="li" key={s.title} variant="up" delay={(i % 2) * 70} className="svc">
                  <h3 className="font-display text-[0.95rem] text-text">{s.title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-text-muted">{s.body}</p>
                </Reveal>
              ))}
            </ul>
            <Reveal variant="up" className="mt-8">
              <ButtonLink href="/custom#quotation" size="cta">
                Plan a custom piece
              </ButtonLink>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 6. Browse the category: product cards, newest first */}
      <section aria-labelledby="projects-title" className="sec sec-white">
        <div className="container-page">
          <Head id="projects-title" eyebrow="Our collection" title="Browse the collection" />
          <ul className="mt-12 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4">
            {products.map((p) => (
              <Reveal as="li" key={p.id} variant="up">
                <ProductCard product={p} currency={business.currency} />
              </Reveal>
            ))}
          </ul>
          <div className="mt-10">
            <Link href="/products" className="link-arrow text-text">
              See the full collection <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. About */}
      <section aria-labelledby="about-title" className="sec sec-white border-t border-border">
        <div className="container-page">
          <div>
            <Reveal variant="up">
              <p className="eyebrow">About us</p>
              <h2 id="about-title" className="font-display mt-4 text-headline text-text">
                About {business.name}
              </h2>
              <p className="mt-5 max-w-lg fl-a leading-relaxed text-text-muted sm:mt-6">{business.tagline ?? "A showroom and workshop making ready-made and made-to-order wood furniture, from the choice of timber to the final finish."}</p>
              <p className="mt-3 max-w-lg fl-a leading-relaxed text-text-muted sm:mt-4">Come to the showroom to see the timber and the joinery in person, or order from home and have it delivered. Whether the job is a single piece or a whole room, the aim is the same: sound material, careful work and a straightforward service.</p>
              <Link href="/about" className="link-arrow mt-6 text-text">
                Read our story <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </Reveal>
            <dl className="mt-12 grid sm:grid-cols-3">
              {[
                ["Range", "Ready-made pieces on the showroom floor"],
                ["Made to order", "Built to your size in our workshop"],
                ["Supply", "Delivered to you, or collect it yourself"],
              ].map(([k, v], i) => (
                <Reveal key={k} variant="up" delay={i * 80} className="fact">
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-3 text-[0.8125rem] leading-relaxed text-text">{v}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 8. Customer reviews: only real ones, entered in Website content; grey placeholders until then */}
      <section aria-labelledby="reviews-title" className="sec sec-cream border-t border-border">
        <ScrollRow label="Customer reviews" autoplay header={<Head id="reviews-title" eyebrow="Feedback" title="What Our Customers Say" />}>
          {/* A few reviews are repeated to fill the endless row; the repeats are hidden from screen readers */}
          {Array.from({ length: Math.max(reviews.length, 6) }, (_, i) => (reviews.length > 0 ? reviews[i % reviews.length]! : null)).map((t, i) => (
            <figure key={i} aria-hidden={reviews.length > 0 && i >= reviews.length ? true : undefined} className={CARD_W + " soft-card flex flex-col !px-14"}>
              <Quote aria-hidden="true" className="size-6 text-timber" strokeWidth={1.25} />
              {t ? (
                <>
                  <blockquote className="mt-5 flex-1 text-[0.9375rem] leading-relaxed text-text">{t.quote}</blockquote>
                  {t.name ? (
                    <figcaption className="mt-6 border-t border-border pt-4">
                      <span className="block text-[0.875rem] font-medium text-text">{t.name}</span>
                      {t.place ? <span className="mt-0.5 block text-[0.8125rem] text-text-muted">{t.place}</span> : null}
                    </figcaption>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="mt-5 flex-1 text-[0.9375rem] leading-relaxed text-text-muted">Customer review to be supplied.</p>
                  <figcaption className="mt-6 border-t border-border pt-4 text-[0.8125rem] text-text-muted">Name and town</figcaption>
                </>
              )}
            </figure>
          ))}
        </ScrollRow>
      </section>

      {/* 9. Contact: dark call to action */}
      <section aria-labelledby="cta-title" className="sec sec-cta">
        <div className="container-page">
          <Reveal variant="up" className="mx-auto max-w-2xl text-center">
            <h2 id="cta-title" className="font-display text-headline text-white">
              Let&rsquo;s Build Something Beautiful in Wood.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[0.9375rem] leading-relaxed text-white/70">Ask about a piece, request a quotation, or arrange a visit to the showroom.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/contact" size="cta" variant="light">
                Contact us
              </ButtonLink>
              <ButtonLink href="/custom#quotation" size="cta" variant="onDark">
                Request a quotation
              </ButtonLink>
            </div>
          </Reveal>

          {/* The showroom: one warm-white card on the dark band, details on the left and the map on the right */}
          <Reveal variant="up" className="mx-auto mt-14 max-w-4xl">
            <div className="grid gap-8 rounded-3xl bg-[var(--color-ivory)] p-6 text-text sm:p-8 md:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="eyebrow">Visit the showroom</p>
                <h3 className="font-display mt-3 fl-b leading-tight text-text">Come and see it in person.</h3>
                <ul className="mt-5 space-y-4 fl-d sm:mt-6 sm:space-y-5">
                  <li className="flex gap-4">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-timber" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium">Address</p>
                      <div className="mt-0.5 whitespace-pre-line text-text-muted">{business.address ?? "Showroom address to be added."}</div>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-timber" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium">Opening hours</p>
                      <div className="mt-0.5 whitespace-pre-line text-text-muted">{business.openingHours ?? "Opening hours to be added."}</div>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-timber" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium">Get in touch</p>
                      <div className="mt-0.5 text-text-muted">
                        {reach.length > 0 ? (
                          <ul className="space-y-1">
                            {reach.map((r) => (
                              <li key={r.href}>
                                <a href={r.href} className="transition-colors hover:text-text" {...(r.label === "WhatsApp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                                  {r.value}
                                  {r.label === "WhatsApp" ? <span className="sr-only"> (opens in a new tab)</span> : null}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "Contact details to be added."
                        )}
                      </div>
                    </div>
                  </li>
                </ul>
                <div className="mt-7">
                  {business.address && business.mapUrl ? (
                    <ButtonLink href={business.mapUrl} size="cta" target="_blank" rel="noopener noreferrer">
                      Get directions
                      <span className="sr-only"> (opens in a new tab)</span>
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/contact#enquiry" size="cta">
                      Send an enquiry
                    </ButtonLink>
                  )}
                </div>
              </div>
              <div className="relative min-h-[14rem] overflow-hidden rounded-2xl bg-[#e4e4e2]">
                {mapEmbedUrl(business.mapUrl) ? <iframe title="Map showing the showroom" src={mapEmbedUrl(business.mapUrl)!} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 size-full border-0" /> : null}
                {business.address && business.mapUrl ? (
                  <a href={business.mapUrl} target="_blank" rel="noopener noreferrer" className="pill absolute left-3 top-3">
                    Open in maps <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="pill absolute left-3 top-3">Map to be added</span>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
