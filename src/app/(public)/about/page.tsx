import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { PageIntro, Prose } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";
import { DEFAULT_ABOUT } from "@/lib/default-pages";
import { SAMPLE_OWNER } from "@/lib/history";
import { PROCESS } from "@/lib/process";
import { getBusinessSettings, getPageContent } from "@/lib/settings";

export const metadata: Metadata = { title: "About our workshop and process", description: "Who we are, how we work, and the craft behind our ready-made and made-to-measure wood furniture, from timber selection to the final coat.", alternates: { canonical: "/about" } };
export const revalidate = 300;

const STEP = 80;


export default async function AboutPage() {
  const [pages, business] = await Promise.all([getPageContent(), getBusinessSettings()]);
  // The owner's name and introduction are written in src/lib/history.ts (SAMPLE_OWNER); the dashboard no longer edits them.
  const ownerName = pages.ownerName?.trim() || SAMPLE_OWNER.name;
  const ownerRole = pages.ownerRole?.trim() || null;
  const ownerBio = pages.ownerBio?.trim() || SAMPLE_OWNER.bio;
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} eyebrow={null} title="About us" lead="A woodworking business making ready-made and custom-built furniture. Here is who we are, how we work, and what you can expect from us." brand={business.name} />

      {/* Who we are: editable text beside a portrait photograph */}
      <section aria-labelledby="story-title" className="section-y">
        <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-12">
          <Reveal variant="left" className="md:col-span-6">
            <p className="eyebrow">Who we are</p>
            <h2 id="story-title" className="font-display mt-3 text-headline text-brand">
              Furniture made with care, in our own workshop.
            </h2>
            <div className="mt-5">
              <Prose text={pages.about ?? DEFAULT_ABOUT} />
            </div>
          </Reveal>
          <Reveal variant="right" delay={STEP} className="md:col-span-6">
            <div className="zoom-frame aspect-[4/5]">
              <ImagePlaceholder label="The workshop team at work" className="size-full" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* The owner */}
      {ownerName && ownerBio ? (
        <section id="owner" aria-labelledby="owner-title" className="scroll-mt-24 bg-[var(--color-ivory,#faf8f4)] section-y">
          <div className="container-page grid items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
            <Reveal variant="left">
              <div className="relative aspect-[4/5] w-full">
                <Image src="/about/owner.jpg" alt={`${ownerName}, owner of ${business.name}`} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" style={{ objectPosition: "50% 30%" }} />
              </div>
            </Reveal>
            <Reveal variant="right" delay={STEP}>
              <p className="eyebrow">Meet the owner</p>
              <h2 id="owner-title" className="font-display mt-3 text-headline text-brand">
                {ownerName}
              </h2>
              {ownerRole ? <p className="mt-3 text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00254),0.75rem)] font-semibold uppercase tracking-[0.2em] text-text-muted">{ownerRole}</p> : null}
              <div className="mt-6 max-w-xl space-y-4 text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">
                {ownerBio.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para.trim()}</p>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* The process in full: a picture and a proper explanation for every step (the homepage links here) */}
      <section id="process" aria-labelledby="process-title" className="scroll-mt-24 border-t border-border bg-white section-y">
        <div className="container-page">
          <Reveal variant="left" className="max-w-2xl">
            <p className="eyebrow">Our process</p>
            <h2 id="process-title" className="font-display mt-4 text-headline text-text">
              From timber to finished piece, step by step.
            </h2>
            <p className="mt-4 max-w-xl text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">Every piece follows the same careful sequence, from choosing the boards to the final coat of finish. Here is how it comes together.</p>
          </Reveal>
          <ol className="mt-14 space-y-14 md:space-y-20">
            {PROCESS.map((st, i) => (
              <li key={st.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-14">
                {/* On a phone the explanation comes first and the picture under it; from tablet width they sit side by side, alternating. */}
                <Reveal variant={i % 2 === 0 ? "left" : "right"} className={"order-2 " + (i % 2 === 1 ? "md:order-2" : "md:order-1")}>
                  <div className="zoom-frame relative mx-auto aspect-[4/5] w-full max-w-md">
                    {st.image ? (
                      <Image src={st.image} alt={`Step ${i + 1}: ${st.title}`} fill sizes="(min-width: 768px) 28rem, 100vw" className="object-cover" style={st.imagePosition ? { objectPosition: st.imagePosition } : undefined} />
                    ) : (
                      <ImagePlaceholder label={`Step ${i + 1} — ${st.photo}`} className="size-full" />
                    )}
                  </div>
                </Reveal>
                <Reveal variant={i % 2 === 0 ? "right" : "left"} delay={STEP} className={"order-1 " + (i % 2 === 1 ? "md:order-1" : "md:order-2")}>
                  <span aria-hidden="true" className="font-display text-[clamp(1.375rem,calc(1.375rem_+_(100vw_-_375px)_*_0.03562),2.25rem)] leading-none text-timber">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display mt-4 text-[clamp(1.1813rem,calc(1.1813rem_+_(100vw_-_375px)_*_0.01705),1.6rem)] leading-tight text-text">{st.title}</h3>
                  <p className="mt-4 max-w-md text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">{st.details}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing: two frosted cards on a soft gradient, one for each way forward */}
      <section aria-labelledby="about-cta" className="glassband">
        <div className="container-page">
          <h2 id="about-cta" className="sr-only">
            Visit us or ask for a quotation
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { eyebrow: "Ready-made", title: "Visit the workshop.", body: "Come and see the timber, the finishes and the joinery in person, and the pieces themselves.", href: "/contact", cta: "Plan a visit" },
              { eyebrow: "Made to measure", title: "Have something built for you.", body: "Tell us the piece you have in mind, with its size and wood, and we will quote before we start.", href: "/custom#quotation", cta: "Request quotation" },
            ].map((c, i) => (
              <Reveal key={c.href} variant={i === 0 ? "left" : "right"} delay={i * 60}>
                <Link href={c.href} className="glasscard group">
                  <span className="eyebrow">{c.eyebrow}</span>
                  <span className="font-display mt-3 block text-[clamp(1.2688rem,calc(1.2688rem_+_(100vw_-_375px)_*_0.0257),1.9rem)] font-semibold leading-tight text-brand">{c.title}</span>
                  <span className="mt-2 block max-w-sm text-base leading-relaxed text-text-muted">{c.body}</span>
                  <span className="go mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                    {c.cta}
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
