import { ArrowUpRight, Clock, Info, Mail, MapPin, Phone } from "lucide-react";
import { ReviewButton } from "@/components/public/review-button";
import { googleReviewLink } from "@/lib/google-reviews";
import Image from "next/image";
import Link from "next/link";
import type { BusinessSettings } from "@/lib/settings";
import { isPlaceholderBusiness } from "@/lib/settings";
import { PublicHeader, type NavLink } from "./public-nav";
import { FacebookIcon } from "@/components/public/facebook-icon";
import { TikTokIcon } from "@/components/public/tiktok-icon";
import { WhatsAppIcon } from "@/components/public/whatsapp-icon";
import { whatsappLink } from "@/lib/contact";
import { Reveal } from "./reveal";

/** Only destinations that exist. */
export const PUBLIC_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Custom work", href: "/custom" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Support", href: "/help" },
  { label: "Track order", href: "/track" },
];

export function PlaceholderNotice({ business }: { business: BusinessSettings }) {
  if (!isPlaceholderBusiness(business)) return null;
  return (
    <div className="bg-brand-dark text-[clamp(0.7313rem,calc(0.7313rem_+_(100vw_-_375px)_*_0.00331),0.8125rem)] text-ivory">
      <p className="container-page flex items-start gap-2 py-2">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ivory/95" strokeWidth={1.75} />
        <span>
          Preview build: the photography, wording and contact details on this site are placeholders until the real content is
          supplied.
        </span>
      </p>
    </div>
  );
}

export function SiteHeader({ business, accounts = false }: { business: BusinessSettings; accounts?: boolean }) {
  // The name at the left already goes home, so the menu does not repeat it.
  const links = PUBLIC_LINKS.filter((l) => l.href !== "/");
  // Right-most: the account button. While accounts are off it leads to a short page saying so, rather than nowhere.
  return <PublicHeader name={business.name} links={links} accountHref={accounts ? "/account" : "/account/sign-in"} />;
}

const INFORMATION = [
  { label: "About us", href: "/about" },
  { label: "Our process", href: "/about#process" },
  { label: "Gallery", href: "/gallery" },
  { label: "Privacy notice", href: "/privacy" },
  { label: "Terms and conditions", href: "/terms" },
];

/** The WhatsApp number behind the "Built by" link at the bottom of the footer. */
const BUILDER_WHATSAPP = "0719825855";

export function SiteFooter({ business, collection = [] }: { business: BusinessSettings; /** The main categories, each linked to its own page. */ collection?: Array<{ name: string; slug: string }> }) {
  const [first = business.name, ...others] = business.name.trim().split(/\s+/);
  const rest = others.join(" ");
  const phones = [business.phone, business.phoneAlt].filter((p): p is string => Boolean(p));
  return (
    <footer className="foot">
      <div className="container-page">
        <Reveal className="foot-grid">
          <div className="foot-about">
            <Link href="/" className="brand" aria-label={`${business.name} — home`}>
              <Image src="/logo-mark.png" alt="" width={40} height={40} className="mark" />
              <span className="name">
                <b>{first}</b>
                {rest ? <i>{rest}</i> : null}
              </span>
            </Link>
            <p className="foot-tag">Expertise in woodworking</p>
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
          {/* Its own column, so its heading lines up with the others. */}
          {collection.length > 0 ? (
            <nav aria-label="Collection">
              <p className="foot-head">Collection</p>
              <ul className="foot-list">
                {collection.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/collections/${c.slug}`}>{c.name}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <nav aria-label="Customer support">
            <p className="foot-head">Customer support</p>
            <ul className="foot-list">
              <li>
                <Link href="/track">Track your order</Link>
              </li>
              {googleReviewLink(business) ? (
                <li>
                  <ReviewButton reviewUrl={googleReviewLink(business)} variant="link" className="foot-link">
                    Review us on Google
                  </ReviewButton>
                </li>
              ) : null}
              <li>
                <Link href="/help">How ordering works</Link>
              </li>
              <li>
                <Link href="/help#payment">Delivery and payment</Link>
              </li>
            </ul>
          </nav>
          <div>
            <p className="foot-head">Contact us</p>
            <ul className="foot-list">
              {phones.length > 0 ? (
                <li className="plain">
                  <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                  <span className="grid gap-1">
                    {phones.map((p) => (
                      <a key={p} href={`tel:${p.replace(/\s+/g, "")}`}>
                        {p}
                      </a>
                    ))}
                  </span>
                </li>
              ) : null}
              {business.whatsapp ? (
                <li>
                  <a href={whatsappLink(business.whatsapp, business.phoneCountryCode)} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon aria-hidden="true" className="size-4" />
                    {business.whatsapp}
                    <span className="sr-only"> on WhatsApp (opens in a new tab)</span>
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
              {business.facebook ? (
                <li>
                  <a href={business.facebook} target="_blank" rel="noopener noreferrer">
                    <FacebookIcon aria-hidden="true" className="size-4" />
                    Facebook<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ) : null}
              {business.tiktok ? (
                <li>
                  <a href={business.tiktok} target="_blank" rel="noopener noreferrer">
                    <TikTokIcon aria-hidden="true" className="size-4" />
                    TikTok<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
          <div>
            <p className="foot-head">Visit us</p>
            <ul className="foot-list">
              {business.address ? (
                <li className="plain">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                  {business.address}
                </li>
              ) : null}
              {business.openingHours ? (
                <li className="plain">
                  <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                  {business.openingHours}
                </li>
              ) : null}
            </ul>
          </div>
        </Reveal>
        <div className="foot-bottom">
          <p>
            © {new Date().getFullYear()} {business.name}
          </p>
          <p className="foot-built">
            <a href={whatsappLink(BUILDER_WHATSAPP, business.phoneCountryCode)} target="_blank" rel="noopener noreferrer" className="gap-1">
              {/* One line runs under "by", the name and the arrow, close to the letters (the arrow's extra height is pulled back so it does not push the line down). */}
              <span className="inline-flex items-center gap-1 border-b border-current leading-[0.9]">
                by Rashad
                {/* Raised a little: capital letters sit above the middle of their line, and the arrow should line up with them. */}
                <ArrowUpRight aria-hidden="true" className="-my-1 size-4 -translate-y-[1.5px]" strokeWidth={1.75} />
              </span>
              <span className="sr-only"> (chat on WhatsApp, opens in a new tab)</span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
