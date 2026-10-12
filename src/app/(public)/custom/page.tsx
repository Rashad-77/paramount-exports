import type { Metadata } from "next";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { PageIntro } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";
import { publicEnv } from "@/lib/env";
import { CUSTOM_STEPS } from "@/lib/custom-steps";

export const metadata: Metadata = {
  title: "Custom furniture",
  description: "Have a piece made to your measurements. Tell us what you need and we will respond with a quotation.",
  alternates: { canonical: "/custom" },
};


export default function CustomPage() {
  return (
    <>
      <PageIntro title="Made to your measurements" eyebrow="Made to order" lead="Send us the details of what you have in mind. There is no obligation, and an enquiry does not create an order." />
      <div className="container-page grid gap-10 py-[var(--section-space)] lg:grid-cols-[1fr_1.25fr] lg:gap-0">
        <Reveal as="section" aria-labelledby="process-title" className="wood-dark-bg relative isolate p-8 text-ivory md:p-12 lg:-mr-px">
          <h2 id="process-title" className="font-display text-[2.25rem] leading-tight">
            How it works
          </h2>
          <ol className="mt-10 space-y-9">
            {CUSTOM_STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4">
                <span aria-hidden="true" className="numeral text-[2.75rem] !text-linen-dark">
                  {i + 1}
                </span>
                <div className="border-t border-ivory/20 pt-4">
                  <h3 className="font-display text-[1.5rem] leading-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ivory/75">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-sm text-ivory/70">Timescales and prices depend on the piece and are confirmed in your quotation.</p>
        </Reveal>

        <Reveal as="section" aria-labelledby="request-title" delay={120} className="border border-border bg-surface p-6 shadow-[var(--shadow-md)] md:p-12">
          <h2 id="request-title" className="font-display text-[2.25rem] leading-tight text-walnut">
            Request a quotation
          </h2>
          <div className="mt-8">
            <EnquiryForm kind="custom" turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} submitLabel="Request quotation" />
          </div>
        </Reveal>
      </div>
    </>
  );
}
