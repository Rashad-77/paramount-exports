import { Clock, Info, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { whatsappLink } from "@/lib/contact";
import type { BusinessSettings } from "@/lib/settings";
import { isPlaceholderBusiness } from "@/lib/settings";
import { PublicHeader, type NavLink } from "./public-nav";

/** Only destinations that exist. */
export const PUBLIC_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Custom work", href: "/custom" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Track order", href: "/track" },
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
  // The name at the left already goes home, so the menu does not repeat it.
  return <PublicHeader name={business.name} links={PUBLIC_LINKS.filter((l) => l.href !== "/")} />;
}

const INFORMATION = [
  { label: "About us", href: "/about" },
  { label: "Our process", href: "/about#process" },
  { label: "Gallery", href: "/gallery" },
  { label: "Made to measure", href: "/custom" },
  { label: "Privacy notice", href: "/privacy" },
  { label: "Terms and conditions", href: "/terms" },
];

export function SiteFooter({ business }: { business: BusinessSettings }) {
  const [first = business.name, ...others] = business.name.trim().split(/\s+/);
  const rest = others.join(" ");
  return (
    <footer className="foot">
      <div className="container-page">
        <div className="foot-grid">
          <div className="foot-about">
            <Link href="/" className="brand" aria-label={`${business.name} — home`}>
              <span className="name">
                <b>{first}</b>
                {rest ? <i>{rest}</i> : null}
              </span>
            </Link>
            <p className="foot-tag">
              {business.tagline ?? "A showroom and workshop making ready-made and made-to-order wood furniture."} Visit our showroom, or order online and pay when it arrives.
            </p>
          </div>
          <nav aria-label="Information">
            <p className="foot-head">Information</p>
            <ul className="foot-list">
              {INFORMATION.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Customer support">
            <p className="foot-head">Customer support</p>
            <ul className="foot-list">
              <li>
                <Link href="/track">Track your order</Link>
              </li>
              <li>
                <Link href="/help">How ordering works</Link>
              </li>
              <li>
                <Link href="/help#payment">Delivery and payment</Link>
              </li>
              <li>
                <Link href="/contact">Contact us</Link>
              </li>
              {business.whatsapp ? (
                <li>
                  <a href={whatsappLink(business.whatsapp, business.phoneCountryCode)} target="_blank" rel="noopener noreferrer">
                    WhatsApp us<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
          <div>
            <p className="foot-head">Visit us</p>
            <ul className="foot-list">
              <li className="plain">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                {business.address ?? "Showroom address to be added."}
              </li>
              <li className="plain">
                <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                {business.openingHours ?? "Opening hours to be added."}
              </li>
              {business.phone ? (
                <li>
                  <a href={`tel:${business.phone.replace(/\s+/g, "")}`}>
                    <Phone aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    {business.phone}
                  </a>
                </li>
              ) : null}
              {business.email ? (
                <li>
                  <a href={`mailto:${business.email}`}>
                    <Mail aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    {business.email}
                  </a>
                </li>
              ) : null}
              {!business.phone && !business.email ? (
                <li>
                  <Link href="/contact">Send us an enquiry</Link>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <p>
            © {new Date().getFullYear()} {business.name}
          </p>
          <Link href="/login">Staff sign in</Link>
        </div>
      </div>
    </footer>
  );
}
