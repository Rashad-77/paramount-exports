import type { Metadata } from "next";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { PageIntro } from "@/components/public/prose";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { Reveal } from "@/components/public/reveal";
import { publicEnv } from "@/lib/env";
import { CUSTOM_STEPS } from "@/lib/custom-steps";

export const metadata: Metadata = {
  title: "Custom furniture",
  description:
    "Have a piece made to your measurements. Tell us what you need and we will respond with a quotation.",
  alternates: { canonical: "/custom" },
};

export default function CustomPage() {
  return (
    <>
      <PageIntro
        back={{ href: "/", to: "home" }}
        title="Made to your measurements"
        eyebrow="Made to order"
        lead="Send us the details of what you have in mind. There is no obligation, and an enquiry does not create an order."
        action={{ href: "#examples", label: "See examples" }}
      />
      <div>
        <div id="quotation" className="container-page scroll-mt-20 grid gap-10 py-[var(--section-space)] lg:grid-cols-[1fr_1.25fr] lg:gap-0">
          <Reveal
            as="section"
            aria-labelledby="process-title"
            className="relative isolate bg-walnut p-8 text-ivory md:p-12 lg:-mr-px"
          >
            <h2
              id="process-title"
              className="font-display text-[1.625rem] leading-tight"
            >
              How it works
            </h2>
            <ol className="mt-7 space-y-9">
              {CUSTOM_STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4">
                  <span
                    aria-hidden="true"
                    className="text-[2rem] font-bold leading-none text-ivory/95"
                  >
                    {i + 1}
                  </span>
                  <div className="border-t border-ivory/20 pt-4">
                    <h3 className="font-display text-[1.25rem] leading-tight">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ivory/95">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-7 text-sm text-ivory/95">
              Timescales and prices depend on the piece and are confirmed in
              your quotation.
            </p>
          </Reveal>

          <Reveal
            as="section"
            aria-labelledby="request-title"
            delay={120}
            className="border border-border bg-white p-6 md:p-10"
          >
            <h2
              id="request-title"
              className="font-display text-[1.625rem] leading-tight text-walnut"
            >
              Request a quotation
            </h2>
            <div className="mt-8">
              <EnquiryForm
                kind="custom"
                turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                submitLabel="Request quotation"
              />
            </div>
          </Reveal>
        </div>
      </div>

      <section id="examples" aria-labelledby="examples-title" className="scroll-mt-20 border-t border-border bg-white section-y">
        <div className="container-page">
          <Reveal>
            <p className="eyebrow">Examples</p>
            <h2 id="examples-title" className="font-display mt-3 text-headline text-brand">
              Custom pieces, made to measure
            </h2>
          </Reveal>
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map((e, i) => (
              <Reveal as="li" key={e.title} delay={(i % 3) * 80}>
                <div className="zoom-frame aspect-[4/3]">
                  <ImagePlaceholder label={`Custom example — ${e.title}`} className="size-full" compact />
                </div>
                <h3 className="mt-4 text-center text-[0.75rem] font-medium uppercase leading-snug tracking-[0.16em] text-text">{e.title}</h3>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

const EXAMPLES = [
  { title: "A dining table built to size" },
  { title: "Fitted storage" },
  { title: "Joinery detail" },
  { title: "A finish sample" },
  { title: "A piece in its room" },
  { title: "Workshop progress" },
];
