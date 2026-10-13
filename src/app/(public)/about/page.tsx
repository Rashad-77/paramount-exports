import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { PageIntro, Prose } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";
import { ButtonLink } from "@/components/ui/button";
import { DEFAULT_ABOUT } from "@/lib/default-pages";
import { getPageContent } from "@/lib/settings";

export const metadata: Metadata = { title: "About and craftsmanship", description: "The people, workshop and craft behind our furniture.", alternates: { canonical: "/about" } };
export const revalidate = 300;

const STEP = 80;

const WHAT_WE_DO = [
  { title: "Ready-made furniture", body: "Finished pieces on the showroom floor that you can see, sit at and take home.", href: "/products", cta: "Browse the collection", label: "Ready-made pieces in the showroom" },
  { title: "Made to measure", body: "Pieces built in our workshop to your dimensions, in the wood and finish you choose, quoted before we start.", href: "/custom", cta: "Start a custom enquiry", label: "A made-to-measure piece in the workshop" },
  { title: "The showroom", body: "A place to see the timber, the finishes and the joinery in person, and to talk your piece through with us.", href: "/contact", cta: "Plan a visit", label: "The showroom floor" },
];

const CRAFT = [
  { title: "Timber", body: "Choosing the wood is part of every conversation: its colour, grain and how it suits the piece and the room.", label: "Timber stock in the workshop" },
  { title: "Joinery", body: "Each piece is put together in our workshop, where you are welcome to ask how it is made.", label: "A joinery detail" },
  { title: "Finishing", body: "The finish is chosen with you, and samples can be seen in the showroom before work begins.", label: "Finish samples" },
];

export default async function AboutPage() {
  const pages = await getPageContent();
  return (
    <>
      <PageIntro eyebrow="About us" title="About and craftsmanship" lead="Who we are, what we make, and how a piece comes together in our workshop." />

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
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                    {w.cta} <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* The craft */}
      <section aria-labelledby="craft-title" className="section-y">
        <div className="container-page">
          <Reveal>
            <p className="eyebrow">The craft</p>
            <h2 id="craft-title" className="font-display mt-3 text-headline text-brand">
              From timber to finished piece.
            </h2>
          </Reveal>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {CRAFT.map((c, i) => (
              <Reveal as="li" key={c.title} delay={i * STEP} className="step !p-0">
                <div className="zoom-frame aspect-[3/2]">
                  <ImagePlaceholder label={c.label} className="size-full" />
                </div>
                <div className="p-5">
                  <span aria-hidden="true" className="num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-text">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* The workshop, in pictures */}
      <section aria-labelledby="pictures-title" className="border-t border-border bg-white section-y">
        <div className="container-page">
          <Reveal>
            <p className="eyebrow">The workshop</p>
            <h2 id="pictures-title" className="font-display mt-3 text-headline text-brand">
              Inside the workshop.
            </h2>
          </Reveal>
          <div className="mt-8 grid auto-rows-[11rem] grid-cols-2 gap-3 md:auto-rows-[14rem] md:grid-cols-4">
            {["Workshop — the bench", "Workshop — tools", "Workshop — a piece in progress", "Workshop — sanding", "Workshop — the finishing room"].map((l, i) => (
              <Reveal key={l} delay={(i % 4) * STEP} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                <div className="zoom-frame size-full">
                  <ImagePlaceholder label={l} className="size-full" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section aria-labelledby="about-cta" className="section-y">
        <div className="container-page">
          <Reveal className="ctaband">
            <h2 id="about-cta" className="font-display max-w-[20ch] text-headline text-white">
              Come and see it for yourself.
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-white/95">Visit the showroom, or tell us about the piece you have in mind.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/contact" size="cta" variant="light">
                Plan a visit
              </ButtonLink>
              <ButtonLink href="/custom" size="cta" variant="onDark">
                Start a custom enquiry
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
