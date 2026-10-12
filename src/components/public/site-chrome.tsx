import Link from "next/link";
import { Info } from "lucide-react";
import type { BusinessSettings } from "@/lib/settings";
import { isPlaceholderBusiness } from "@/lib/settings";
import { MobileNav, type NavLink } from "./mobile-nav";

/** Only destinations that exist. */
export const PUBLIC_LINKS: NavLink[] = [
  { label: "Collection", href: "/products" },
  { label: "Custom furniture", href: "/custom" },
  { label: "About", href: "/about" },
  { label: "Gallery", href: "/gallery" },
  { label: "Showroom & contact", href: "/contact" },
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
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="container-page flex h-[var(--header-height)] items-center justify-between gap-8">
        <Link href="/" className="font-display text-[1.25rem] leading-none tracking-[-0.01em] text-brand md:text-[1.375rem]" aria-label={`${business.name} — home`}>
          {business.name}
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8 text-[0.875rem] font-medium">
            {PUBLIC_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="link-draw-hover py-2 text-text hover:text-brand">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <MobileNav links={PUBLIC_LINKS} />
      </div>
    </header>
  );
}

export function SiteFooter({ business }: { business: BusinessSettings }) {
  return (
    <footer className="wood-dark-bg mt-[var(--section-space)] bg-brand text-ivory">
      <div className="container-page grid gap-8 py-9 md:grid-cols-[2fr_1fr_1fr] md:py-11">
        <div>
          <p className="font-display text-[1.5rem] leading-none">{business.name}</p>
          <p className="mt-4 max-w-sm text-sm text-ivory/95">{business.tagline ?? "Ready-made and made-to-order wood furniture."}</p>
        </div>
        <div className="text-sm">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-ivory/95">Visit</p>
          <p className="mt-3 whitespace-pre-line text-ivory/95">{business.address ?? "Showroom address to be added."}</p>
        </div>
        <div className="text-sm">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-ivory/95">Contact</p>
          <ul className="mt-3 space-y-1.5 text-ivory/95">
            {business.phone ? (
              <li>
                <a className="link-draw" href={`tel:${business.phone.replace(/\s+/g, "")}`}>
                  {business.phone}
                </a>
              </li>
            ) : null}
            {business.email ? (
              <li>
                <a className="link-draw" href={`mailto:${business.email}`}>
                  {business.email}
                </a>
              </li>
            ) : null}
            {!business.phone && !business.email ? <li>Contact details to be added.</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/15">
        <p className="container-page py-5 text-xs text-ivory/95">
          © {new Date().getFullYear()} {business.name}
          <span className="mx-3" aria-hidden="true">
            ·
          </span>
          <Link href="/privacy" className="link-draw">
            Privacy notice
          </Link>
          <span className="mx-3" aria-hidden="true">
            ·
          </span>
          <Link href="/terms" className="link-draw">
            Terms
          </Link>
          <span className="mx-3" aria-hidden="true">
            ·
          </span>
          <Link href="/login" className="link-draw">
            Staff sign in
          </Link>
        </p>
      </div>
    </footer>
  );
}
