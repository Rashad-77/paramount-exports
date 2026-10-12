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
    <div className="border-b border-border bg-linen text-sm text-text">
      <p className="container-page flex items-start gap-2 py-2">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
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
    <header className="relative border-b border-border bg-ivory">
      <div className="container-page flex h-[var(--header-height)] items-center justify-between gap-6">
        <Link href="/" className="font-display text-xl tracking-tight text-walnut md:text-2xl" aria-label={`${business.name} — home`}>
          {business.name}
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm">
            {PUBLIC_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="py-2 text-text hover:text-walnut hover:underline">
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
    <footer className="mt-24 border-t border-border bg-linen/50">
      <div className="container-page grid gap-8 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="font-display text-xl text-walnut">{business.name}</p>
          <p className="mt-2 max-w-sm text-sm text-text-muted">
            {business.tagline ?? "Ready-made and made-to-order wood furniture."}
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium">Visit</p>
          <p className="mt-2 text-text-muted">{business.address ?? "Showroom address to be added."}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium">Contact</p>
          <ul className="mt-2 space-y-1 text-text-muted">
            {business.phone ? (
              <li>
                <a className="underline" href={`tel:${business.phone.replace(/\s+/g, "")}`}>
                  {business.phone}
                </a>
              </li>
            ) : null}
            {business.email ? (
              <li>
                <a className="underline" href={`mailto:${business.email}`}>
                  {business.email}
                </a>
              </li>
            ) : null}
            {!business.phone && !business.email ? <li>Contact details to be added.</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="container-page py-4 text-xs text-text-muted">
          © {new Date().getFullYear()} {business.name}
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <Link href="/privacy" className="underline">
            Privacy notice
          </Link>
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <Link href="/terms" className="underline">
            Terms
          </Link>
        </p>
      </div>
    </footer>
  );
}
