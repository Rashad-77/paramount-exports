import type { Metadata } from "next";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { PageIntro } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";
import { publicEnv } from "@/lib/env";
import { CUSTOM_STEPS } from "@/lib/custom-steps";

export const metadata: Metadata = {
  title: "Custom made wood furniture",
  description:
    "Have wood furniture made to your measurements, in the timber and finish you choose. Tell us what you need and we will reply with a quotation before any work starts.",
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
        action={{ href: "#quotation", label: "Request a quotation" }}
      />
      <div>
        <div id="quotation" className="container-page scroll-mt-20 grid gap-10 py-[var(--section-space)] lg:grid-cols-[1fr_1.25fr] lg:gap-0">
          <Reveal
            as="section"
            aria-labelledby="process-title"
            className="relative isolate bg-walnut p-5 text-ivory sm:p-8 md:p-12 lg:-mr-px"
          >
            <h2
              id="process-title"
              className="font-display text-[clamp(1.1875rem,calc(1.1875rem_+_(100vw_-_375px)_*_0.01781),1.625rem)] leading-tight"
            >
              How it works
            </h2>
            <ol className="mt-7 space-y-9">
              {CUSTOM_STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-3 sm:grid-cols-[3rem_1fr] sm:gap-4">
                  <span
                    aria-hidden="true"
                    className="text-[clamp(1.3rem,calc(1.3rem_+_(100vw_-_375px)_*_0.0285),2rem)] font-bold leading-none text-ivory/95"
                  >
                    {i + 1}
                  </span>
                  <div className="border-t border-ivory/20 pt-4">
                    <h3 className="font-display text-[clamp(1.075rem,calc(1.075rem_+_(100vw_-_375px)_*_0.00712),1.25rem)] leading-tight">
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
              className="font-display text-[clamp(1.1875rem,calc(1.1875rem_+_(100vw_-_375px)_*_0.01781),1.625rem)] leading-tight text-walnut"
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
    </>
  );
}
