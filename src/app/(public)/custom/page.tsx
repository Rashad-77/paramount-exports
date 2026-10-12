import type { Metadata } from "next";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { PageIntro } from "@/components/public/prose";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Custom furniture",
  description: "Have a piece made to your measurements. Tell us what you need and we will respond with a quotation.",
  alternates: { canonical: "/custom" },
};

const STEPS = [
  { title: "Tell us what you need", body: "Describe the piece, its dimensions, the wood and finish you prefer, and attach any photographs or sketches." },
  { title: "We review and get in touch", body: "Someone from the team contacts you to confirm the details and answer questions." },
  { title: "You receive a quotation", body: "A written quotation sets out the specification, price and payment terms for you to accept." },
  { title: "We build, then deliver", body: "Once the quotation is accepted, the piece is made in our workshop and arranged for delivery or collection." },
];

export default function CustomPage() {
  return (
    <>
      <PageIntro title="Made to your measurements" lead="Send us the details of what you have in mind. There is no obligation, and an enquiry does not create an order." />
      <div className="container-page grid gap-12 pb-20 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <section aria-labelledby="process-title">
          <h2 id="process-title" className="font-display text-2xl text-walnut">
            How it works
          </h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-4">
                <span aria-hidden="true" className="tabular font-display text-2xl text-stone">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-text-muted">Timescales and prices depend on the piece and are confirmed in your quotation.</p>
        </section>

        <section aria-labelledby="request-title" className=" border border-border bg-surface p-6 md:p-8">
          <h2 id="request-title" className="font-display text-2xl text-walnut">
            Request a quotation
          </h2>
          <div className="mt-6">
            <EnquiryForm kind="custom" turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} submitLabel="Request quotation" />
          </div>
        </section>
      </div>
    </>
  );
}
