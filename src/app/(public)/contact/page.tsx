import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/public/whatsapp-icon";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { SiteImage } from "@/components/public/site-image";
import { Reveal } from "@/components/public/reveal";
import { ButtonLink } from "@/components/ui/button";
import { BackBar } from "@/components/public/back-link";
import { mapEmbedUrl, whatsappLink } from "@/lib/contact";
import { publicEnv } from "@/lib/env";
import { JsonLd } from "@/components/json-ld";
import { getBusinessSettings } from "@/lib/settings";
import { localBusinessLd } from "@/lib/structured-data";
import { listGalleryPhotos } from "@/server/catalogue-public";

export const metadata: Metadata = {
  title: "Contact and showroom visit",
  description: "Visit the showroom, call or message us on WhatsApp, or send an enquiry. Address, opening hours and a map to find us.",
  alternates: { canonical: "/contact" },
};
export const revalidate = 300;

/** One way to get in touch. A link when the detail is set in Settings; a quiet note until then. */
function Channel({ icon: Icon, title, value, href, cta, external = false }: { icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>; title: string; value: string | null; href: string | null; cta: string; external?: boolean }) {
  const inner: ReactNode = (
    <>
      <span className="ct-ico">
        <Icon aria-hidden="true" className="mx-auto size-8 text-brand" strokeWidth={1.25} />
      </span>
      <h2 className="font-display mt-5 text-[clamp(1.15rem,calc(1.15rem_+_(100vw_-_375px)_*_0.01425),1.5rem)] leading-tight text-brand">{title}</h2>
      <p className="mt-2 break-words text-lg text-text-muted">{value ?? "To be added."}</p>
      {href ? (
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
          {cta}

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
  const [b, photos] = await Promise.all([getBusinessSettings(), listGalleryPhotos()]);
  // The first four photographs of the showroom in the gallery.
  const showroom = photos.showroom.slice(0, 4);
  const mapped = Boolean(b.address && b.mapUrl);
  const embed = mapEmbedUrl(b.mapUrl);
  const channels = [
    { icon: Phone, title: "Call us", value: b.phone ? [b.phone, b.phoneAlt].filter(Boolean).join("  ·  ") : null, href: b.phone ? `tel:${b.phone.replace(/\s+/g, "")}` : null, cta: "Call now" },
    { icon: WhatsAppIcon, title: "WhatsApp", value: b.whatsapp, href: b.whatsapp ? whatsappLink(b.whatsapp, b.phoneCountryCode) : null, cta: "Start a chat", external: true },
    { icon: Mail, title: "Email", value: b.email, href: b.email ? `mailto:${b.email}` : null, cta: "Send an email" },
  ];
  return (
    <>
      <JsonLd data={localBusinessLd(b, publicEnv().NEXT_PUBLIC_SITE_URL)} />
      <header className="plain-band on-wood relative">
        <BackBar href="/" to="home" />
        <div className="container-page pt-[clamp(8rem,12vw,10rem)] pb-[clamp(3rem,6vw,5rem)]">
          <p className="eyebrow">Contact us</p>
          <h1 className="font-display mt-4 max-w-[16ch] text-display text-white">Let&rsquo;s talk about your piece.</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed on-wood-muted">Call, message or visit. Or write to us below.</p>
        </div>
      </header>

      <section aria-label="Contact details" className="border-y border-[var(--leaf)] bg-white">
        <div className="grid divide-y divide-[var(--leaf)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {channels.map((c, i) => (
            <Reveal key={c.title} variant="up" delay={i * 90}>
              <Channel {...c} />
            </Reveal>
          ))}
        </div>
      </section>

      <section id="map" aria-labelledby="visit-title" className="scroll-mt-16">
        <Reveal variant="wipe">
          <div className="relative h-[24rem] bg-[#e4e4e2]">
            {embed ? (
              <iframe title="Map showing the showroom" src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 size-full border-0" />
            ) : (
              <>
                {b.mapUrl ? <a href={b.mapUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label="Open the showroom location in maps (opens in a new tab)" /> : null}
                <ImagePlaceholder label="Map of the showroom" className="size-full" compact />
                <span className="ct-ring" aria-hidden="true" />
                <span className="ct-ring" aria-hidden="true" />
                <span className="ct-pin" aria-hidden="true">
                  <MapPin className="size-6" strokeWidth={1.5} />
                </span>
                {!b.mapUrl ? <span className="absolute right-4 top-4 bg-white/85 px-3 py-1.5 text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00254),0.75rem)] font-medium uppercase tracking-[0.14em] text-[#55554f]">Map to be added</span> : null}
              </>
            )}
          </div>
        </Reveal>
        <div className="border-b border-[var(--leaf)] bg-white">
          <Reveal variant="up" className="container-page grid gap-6 py-10 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
            <div>
              <p className="eyebrow">Find us</p>
              <h2 id="visit-title" className="font-display mt-3 text-[clamp(1.225rem,calc(1.225rem_+_(100vw_-_375px)_*_0.02137),1.75rem)] leading-tight text-brand">
                Visit the showroom
              </h2>
              <p className="mt-3 whitespace-pre-line text-lg font-medium leading-snug text-text">{b.address ?? "Showroom address to be added."}</p>
            </div>
            <div className="md:border-l md:border-[var(--leaf)] md:pl-8">
              <p className="text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00254),0.75rem)] font-semibold uppercase tracking-[0.2em] text-text-muted">Opening hours</p>
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

      <section id="enquiry" aria-labelledby="send-title" className="scroll-mt-20" style={{ background: "linear-gradient(180deg,#f2ede4,#e8e3dc)", paddingBlock: "clamp(3rem,7vw,5.5rem)" }}>
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl">
            <h2 id="send-title" className="font-display text-center text-headline text-brand">
              Send an enquiry
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-base text-text-muted">We reply within one working day.</p>
            <div className="ct-form mt-8 border border-white bg-white/80 p-6 md:p-10">
              <EnquiryForm kind="general" turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="inside-title" className="border-t border-border bg-white section-y">
        <div className="container-page">
          <Reveal variant="fade">
            <p className="eyebrow">The showroom</p>
            <h2 id="inside-title" className="font-display mt-3 text-headline text-brand">
              Come and see it.
            </h2>
            {b.address ? (
              <p className="mt-5 flex max-w-md items-start gap-2.5 text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text">
                <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand" strokeWidth={1.5} />
                <span className="whitespace-pre-line">{b.address}</span>
              </p>
            ) : null}
          </Reveal>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-px bg-white md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => {
            const p = showroom[i];
            return (
              <Reveal key={p?.id ?? `empty-${i}`} variant="wipe" delay={i * 120}>
                <div className="relative aspect-[4/3]">
                  {p ? <SiteImage src={p.url} alt={p.alt} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" /> : <ImagePlaceholder label="Showroom photograph" className="size-full" compact />}
                </div>
              </Reveal>
            );
          })}
        </div>
        <div className="container-page mt-8 text-center">
          <Link href="/gallery#gallery" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            See the gallery
          </Link>
        </div>
      </section>
    </>
  );
}
