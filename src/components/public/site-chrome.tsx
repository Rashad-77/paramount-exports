import Link from "next/link";
import { Info } from "lucide-react";
import type { BusinessSettings } from "@/lib/settings";
import { isPlaceholderBusiness } from "@/lib/settings";
import { PublicHeader, type NavLink } from "./public-nav";

/** Only destinations that exist. */
export const PUBLIC_LINKS: NavLink[] = [
  { label: "Collection", href: "/products" },
  { label: "Custom furniture", href: "/custom" },
  { label: "About", href: "/about" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact us", href: "/contact" },
];

export function PlaceholderNotice({ business }: { business: BusinessSettings }) {
  if (!isPlaceholderBusiness(business)) return null;
  return (
    <div className="bg-brand-dark text-[0.8125rem] text-ivory">
      <p className="container-page flex items-start gap-2 py-2">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ivory/95" strokeWidth={1.75} />
        <span>
          Preview build: the business name, photography, wording and contact details on this site are placeholders until the
          real content is supplied.
        </span>
      </p>
    </div>
  );
}

export function SiteHeader({ business }: { business: BusinessSettings }) {
  return <PublicHeader name={business.name} links={PUBLIC_LINKS} />;
}

export function SiteFooter({ business }: { business: BusinessSettings }) {
  return (
    <footer className="wood-band on-wood mt-0">
      <div className="container-page grid gap-10 pt-14 pb-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="text-[1.4rem] font-extrabold leading-none tracking-tight">{business.name}</p>
          <p className="mt-4 max-w-xs text-sm on-wood-muted">{business.tagline ?? "Ready-made and made-to-order wood furniture."}</p>
        </div>
        <div className="text-sm">
          <p className="eyebrow">Explore</p>
          <ul className="mt-4 space-y-2 on-wood-muted">
            {PUBLIC_LINKS.map((l) => (
              <li key={l.href}>
                <Link className="fill-hover -mx-1 px-1" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="eyebrow">Visit</p>
          <p className="mt-4 whitespace-pre-line on-wood-muted">{business.address ?? "Showroom address to be added."}</p>
        </div>
        <div className="text-sm">
          <p className="eyebrow">Contact</p>
          <ul className="mt-4 space-y-2 on-wood-muted">
            {business.phone ? (
              <li>
                <a className="fill-hover -mx-1 px-1" href={`tel:${business.phone.replace(/\s+/g, "")}`}>
                  {business.phone}
                </a>
              </li>
            ) : null}
            {business.email ? (
              <li>
                <a className="fill-hover -mx-1 px-1" href={`mailto:${business.email}`}>
                  {business.email}
                </a>
              </li>
            ) : null}
            {!business.phone && !business.email ? <li>Contact details to be added.</li> : null}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="container-page relative h-[clamp(2.6rem,8vw,7.5rem)] overflow-hidden">
        <span className="bigword">{business.name}</span>
      </div>
      <div className="relative z-10 border-t border-ivory/15 bg-black/20">
        <p className="container-page py-5 text-xs on-wood-muted">
          © {new Date().getFullYear()} {business.name}
          <span className="mx-3" aria-hidden="true">
            ·
          </span>
          <Link href="/privacy" className="fill-hover -mx-1 px-1">
            Privacy notice
          </Link>
          <span className="mx-3" aria-hidden="true">
            ·
          </span>
          <Link href="/terms" className="fill-hover -mx-1 px-1">
            Terms
          </Link>
          <span className="mx-3" aria-hidden="true">
            ·
          </span>
          <Link href="/login" className="fill-hover -mx-1 px-1">
            Staff sign in
          </Link>
        </p>
      </div>
    </footer>
  );
}
