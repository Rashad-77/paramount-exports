import type { Metadata } from "next";
import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { Reveal } from "@/components/public/reveal";
import { ButtonLink } from "@/components/ui/button";
import { whatsappLink } from "@/lib/contact";
import { publicEnv } from "@/lib/env";
import { getBusinessSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Visit the showroom, call us, or send an enquiry.",
  alternates: { canonical: "/contact" },
};
export const revalidate = 300;

/** One way to get in touch. A link when the detail is set in Settings; a quiet note until then. */
function Channel({ icon: Icon, title, value, href, cta, external = false }: { icon: typeof Phone; title: string; value: string | null; href: string | null; cta: string; external?: boolean }) {
  const inner: ReactNode = (
    <>
      <span className="ct-ico">
        <Icon aria-hidden="true" className="mx-auto size-8 text-brand" strokeWidth={1.25} />
      </span>
      <h2 className="font-display mt-5 text-[1.5rem] leading-tight text-brand">{title}</h2>
      <p className="mt-2 break-words text-lg text-text-muted">{value ?? "To be added."}</p>
      {href ? (
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
          {cta}
          <ArrowRight aria-hidden="true" className="ct-arrow size-4" />
          {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
        </span>
      ) : null}
    </>
  );
  return href ? (
    <a href={href} className="ct-card" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {inner}
    </a>
  ) : (
    <div className="ct-card">{inner}</div>
  );
}

export default async function ContactPage() {
  const b = await getBusinessSettings();
  const mapped = Boolean(b.address && b.mapUrl);
  const channels = [
    { icon: Phone, title: "Call us", value: b.phone, href: b.phone ? `tel:${b.phone.replace(/\s+/g, "")}` : null, cta: "Call now" },
    { icon: MessageCircle, title: "WhatsApp", value: b.whatsapp, href: b.whatsapp ? whatsappLink(b.whatsapp, b.phoneCountryCode) : null, cta: "Start a chat", external: true },
    { icon: Mail, title: "Email", value: b.email, href: b.email ? `mailto:${b.email}` : null, cta: "Send an email" },
  ];
  return (
    <>
      <header className="ct-hero">
        <div className="container-page">
          <p className="eyebrow rise-in">Contact us</p>
          <h1 className="font-display rise-in rise-in-2 mx-auto mt-3 max-w-[16ch] text-display text-brand">Let&rsquo;s talk about your piece.</h1>
          <p className="rise-in rise-in-3 mx-auto mt-4 max-w-lg text-base leading-relaxed text-text-muted sm:text-lg">Call, message or visit. Or write to us below.</p>
        </div>
      </header>

      <section aria-label="Contact details" className="border-y border-[var(--leaf)] bg-white">
        <div className="grid divide-y divide-[var(--leaf)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {channels.map((c, i) => (
            <Reveal key={c.title} variant="fade" delay={i * 90}>
              <Channel {...c} />
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="visit-title">
        <Reveal variant="wipe">
          <div className="relative h-[24rem] bg-[#e4e4e2]">
            {b.mapUrl ? (
              <a href={b.mapUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label="Open the showroom location in maps (opens in a new tab)" />
            ) : null}
            <ImagePlaceholder label="Map of the showroom" className="size-full" compact />
            <span className="ct-ring" aria-hidden="true" />
            <span className="ct-ring" aria-hidden="true" />
            <span className="ct-pin" aria-hidden="true">
              <MapPin className="size-6" strokeWidth={1.5} />
            </span>
            {!b.mapUrl ? <span className="absolute right-4 top-4 bg-white/85 px-3 py-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-[#55554f]">Map to be added</span> : null}
          </div>
        </Reveal>
        <div className="border-b border-[var(--leaf)] bg-white">
          <Reveal variant="fade" className="container-page grid gap-6 py-10 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
            <div>
              <p className="eyebrow">Find us</p>
              <h2 id="visit-title" className="font-display mt-3 text-[1.75rem] leading-tight text-brand">
                Visit the showroom
              </h2>
              <p className="mt-3 whitespace-pre-line text-lg font-medium leading-snug text-text">{b.address ?? "Showroom address to be added."}</p>
            </div>
            <div className="md:border-l md:border-[var(--leaf)] md:pl-8">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-text-muted">Opening hours</p>
              <p className="mt-2 whitespace-pre-line text-lg font-medium leading-snug text-text">{b.openingHours ?? "Opening hours to be added."}</p>
            </div>
            {mapped ? (
              <ButtonLink href={b.mapUrl!} size="cta" className="go" target="_blank" rel="noopener noreferrer">
                Get directions
                <span className="sr-only"> (opens in a new tab)</span>
              </ButtonLink>
            ) : null}
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="send-title" style={{ background: "linear-gradient(180deg,#eef6f0,#e4f1e9)", paddingBlock: "clamp(3rem,7vw,5.5rem)" }}>
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl">
            <h2 id="send-title" className="font-display text-center text-headline text-brand">
              Or send an enquiry
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-base text-text-muted">We reply within one working day.</p>
            <div className="ct-form mt-8 border border-white bg-white/80 p-6 md:p-10">
              <EnquiryForm kind="general" turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="inside-title" className="border-t border-border bg-white section-y">
        <div className="container-page flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Reveal variant="fade">
            <p className="eyebrow">The showroom</p>
            <h2 id="inside-title" className="font-display mt-3 text-headline text-brand">
              Come and see it.
            </h2>
          </Reveal>
          <Link href="/gallery#gallery" className="fill-hover -mx-1 inline-flex items-center gap-2 px-1 text-sm font-semibold text-brand">
            See the gallery <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-px bg-white md:grid-cols-4">
          {["The main floor", "Dining tables", "Seating", "The entrance"].map((l, i) => (
            <Reveal key={l} variant="wipe" delay={i * 120}>
              <div className="aspect-[4/3]">
                <ImagePlaceholder label={`Showroom — ${l}`} className="size-full" compact />
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
