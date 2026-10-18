import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { PageIntro, Prose } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";
import { DEFAULT_ABOUT } from "@/lib/default-pages";
import { PROCESS } from "@/lib/process";
import { getBusinessSettings, getPageContent } from "@/lib/settings";

export const metadata: Metadata = { title: "About us", description: "Who we are, how we work, and the craft behind our ready-made and made-to-measure wood furniture.", alternates: { canonical: "/about" } };
export const revalidate = 300;

const STEP = 80;


export default async function AboutPage() {
  const [pages, business] = await Promise.all([getPageContent(), getBusinessSettings()]);
  // The owner section appears once the owner has written their name and introduction in Website content; nothing is made up before then.
  const ownerName = pages.ownerName?.trim() || null;
  const ownerRole = pages.ownerRole?.trim() || null;
  const ownerBio = pages.ownerBio?.trim() || null;
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} eyebrow="About us" title="About us" lead="A woodworking business making ready-made and custom-built furniture. Here is who we are, how we work, and what you can expect from us." brand={business.name} />

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
              <ImagePlaceholder label={`${ownerName}, photograph`} className="aspect-[4/5] w-full" />
            </Reveal>
            <Reveal variant="right" delay={STEP}>
              <p className="eyebrow">Meet the owner</p>
              <h2 id="owner-title" className="font-display mt-3 text-headline text-brand">
                {ownerName}
              </h2>
              {ownerRole ? <p className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-text-muted">{ownerRole}</p> : null}
              <div className="mt-6 max-w-xl space-y-4 text-[0.9375rem] leading-relaxed text-text-muted">
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
            <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-text-muted">Every piece follows the same careful sequence, from choosing the boards to the final coat of finish. Here is how it comes together.</p>
          </Reveal>
          <ol className="mt-14 space-y-14 md:space-y-20">
            {PROCESS.map((st, i) => (
              <li key={st.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-14">
                <Reveal variant={i % 2 === 0 ? "left" : "right"} className={i % 2 === 1 ? "md:order-2" : ""}>
                  <div className="zoom-frame aspect-[4/3]">
                    <ImagePlaceholder label={`Step ${i + 1} — ${st.photo}`} className="size-full" />
                  </div>
                </Reveal>
                <Reveal variant={i % 2 === 0 ? "right" : "left"} delay={STEP}>
                  <span aria-hidden="true" className="font-display text-[2.25rem] leading-none text-timber">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display mt-4 text-[1.6rem] leading-tight text-text">{st.title}</h3>
                  <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-text-muted">{st.details}</p>
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
              { eyebrow: "Ready-made", title: "Visit the showroom.", body: "Come and see the timber, the finishes and the joinery in person, and sit at the pieces.", href: "/contact", cta: "Plan a visit" },
              { eyebrow: "Made to measure", title: "Have something built for you.", body: "Tell us the piece you have in mind, with its size and wood, and we will quote before we start.", href: "/custom#quotation", cta: "Request quotation" },
            ].map((c, i) => (
              <Reveal key={c.href} variant={i === 0 ? "left" : "right"} delay={i * 60}>
                <Link href={c.href} className="glasscard group">
                  <span className="eyebrow">{c.eyebrow}</span>
                  <span className="font-display mt-3 block text-[clamp(1.4rem,2.2vw,1.9rem)] font-semibold leading-tight text-brand">{c.title}</span>
                  <span className="mt-2 block max-w-sm text-base leading-relaxed text-text-muted">{c.body}</span>
                  <span className="go mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                    {c.cta} <ArrowRight aria-hidden="true" className="size-4" />
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
