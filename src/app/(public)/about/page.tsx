import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { PageIntro, Prose } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";
import { WorkshopSection } from "@/components/public/photo-sections";
import { DEFAULT_ABOUT } from "@/lib/default-pages";
import { PROCESS } from "@/lib/process";
import { getBusinessSettings, getPageContent } from "@/lib/settings";

export const metadata: Metadata = { title: "About and craftsmanship", description: "The people, workshop and craft behind our furniture.", alternates: { canonical: "/about" } };
export const revalidate = 300;

const STEP = 80;

const WHAT_WE_DO = [
  { title: "Ready-made furniture", body: "Finished pieces on the showroom floor that you can see, sit at and take home.", href: "/products", label: "Ready-made pieces in the showroom" },
  { title: "Made to measure", body: "Pieces built in our workshop to your dimensions, in the wood and finish you choose, quoted before we start.", href: "/custom", label: "A made-to-measure piece in the workshop" },
  { title: "The showroom", body: "A place to see the timber, the finishes and the joinery in person, and to talk your piece through with us.", href: "/contact", label: "The showroom floor" },
];

export default async function AboutPage() {
  const [pages, business] = await Promise.all([getPageContent(), getBusinessSettings()]);
  return (
    <>
      <PageIntro eyebrow="About us" title="About and craftsmanship" lead="Who we are, what we make, and how a piece comes together in our workshop." brand={business.name} />

      {/* Our story: editable text beside a portrait photograph */}
      <section aria-labelledby="story-title" className="section-y">
        <div className="container-page grid items-center gap-8 md:grid-cols-12 md:gap-12">
          <Reveal className="md:col-span-6">
            <p className="eyebrow">Our story</p>
            <h2 id="story-title" className="font-display mt-3 text-headline text-brand">
              The people behind the furniture.
            </h2>
            <div className="mt-5">
              <Prose text={pages.about ?? DEFAULT_ABOUT} />
            </div>
          </Reveal>
          <Reveal delay={STEP} className="md:col-span-6">
            <div className="zoom-frame aspect-[4/5]">
              <ImagePlaceholder label="The workshop team at work" className="size-full" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* What we do */}
      <section aria-labelledby="do-title" className="border-y border-border bg-white section-y">
        <div className="container-page">
          <Reveal>
            <p className="eyebrow">What we do</p>
            <h2 id="do-title" className="font-display mt-3 text-headline text-brand">
              Three ways we can help.
            </h2>
          </Reveal>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {WHAT_WE_DO.map((w, i) => (
              <Reveal as="li" key={w.title} delay={i * STEP}>
                <Link href={w.href} className="group block">
                  <div className="zoom-frame aspect-[4/3]">
                    <ImagePlaceholder label={w.label} className="size-full" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-text">{w.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{w.body}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* The workshop, in pictures */}
      <WorkshopSection id="pictures-title" link={{ href: "/gallery#gallery", label: "See more in the gallery" }} />

      {/* The process in full: a picture and a proper explanation for every step (the homepage links here) */}
      <section id="process" aria-labelledby="process-title" className="scroll-mt-24 border-t border-border bg-white section-y">
        <div className="container-page">
          <Reveal variant="fade" className="max-w-2xl">
            <p className="eyebrow">Our process</p>
            <h2 id="process-title" className="font-display mt-4 text-headline text-text">
              From timber to finished piece, step by step.
            </h2>
            <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-text-muted">Every piece moves through the same sequence of hands and machines, from selecting the board to the final coat of finish. This is how it goes.</p>
          </Reveal>
          <ol className="mt-14 space-y-14 md:space-y-20">
            {PROCESS.map((st, i) => (
              <li key={st.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-14">
                <Reveal variant="wipe" className={i % 2 === 1 ? "md:order-2" : ""}>
                  <div className="zoom-frame aspect-[4/3]">
                    <ImagePlaceholder label={`Step ${i + 1} — ${st.photo}`} className="size-full" />
                  </div>
                </Reveal>
                <Reveal variant="fade" delay={STEP}>
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
            Come and see it for yourself
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { eyebrow: "Ready-made", title: "Come and see it for yourself.", body: "Visit the showroom and sit at the pieces.", href: "/contact", cta: "Plan a visit" },
              { eyebrow: "Made to measure", title: "Have something built for you.", body: "Tell us about the piece you have in mind.", href: "/custom#quotation", cta: "Start a custom enquiry" },
            ].map((c, i) => (
              <Reveal key={c.href} variant="fade" delay={i * 60}>
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
