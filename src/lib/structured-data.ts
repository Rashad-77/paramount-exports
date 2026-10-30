import type { BusinessSettings } from "@/lib/settings";

/**
 * schema.org descriptions of the business, built only from the details saved under Settings (nothing is invented). Search engines and
 * AI assistants read these to learn who the business is, where it is and when it is open.
 */

type Json = Record<string, unknown>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const dayIndex = (s: string) => DAYS.findIndex((d) => d.toLowerCase() === s.trim().toLowerCase());

/** The saved address is free text, one part per line: the street, then the town, the postcode and the country last. */
export function parseAddress(raw: string | null): Json | null {
  const lines = (raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/[,\s]+$/, ""))
    .filter(Boolean);
  if (lines.length === 0) return null;
  const country = lines.length > 1 && /^sri lanka$/i.test(lines[lines.length - 1]!) ? "LK" : undefined;
  const body = country ? lines.slice(0, -1) : lines;
  const at = body.findIndex((l) => /^\d{4,6}$/.test(l));
  const base: Json = { "@type": "PostalAddress", ...(country ? { addressCountry: country } : {}) };
  if (at > 0) return { ...base, streetAddress: body.slice(0, Math.max(at - 1, 1)).join(", "), addressLocality: body[at - 1], postalCode: body[at] };
  return { ...base, streetAddress: body.join(", ") };
}

/** "Monday to Saturday: 8:00 am – 5:00 pm" lines; a day marked Closed is left out. Lines that cannot be read are skipped. */
export function parseHours(raw: string | null): Json[] {
  const to24 = (t: string) => {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(t.trim());
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (m[3]!.toLowerCase() === "pm") h += 12;
    return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
  };
  const out: Json[] = [];
  for (const line of (raw ?? "").split(/\r?\n/)) {
    const m = /^([A-Za-z]+)(?:\s*(?:to|-|–)\s*([A-Za-z]+))?\s*:\s*(.+?)\s*(?:–|-|to)\s*(.+)$/i.exec(line.trim());
    if (!m) continue;
    const from = dayIndex(m[1]!);
    const until = m[2] ? dayIndex(m[2]) : from;
    const opens = to24(m[3]!);
    const closes = to24(m[4]!);
    if (from < 0 || until < from || !opens || !closes) continue;
    out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS.slice(from, until + 1), opens, closes });
  }
  return out;
}

/** A local number ("0715500668") with the country code: "+94715500668". Numbers that already have a + are kept. */
export function internationalPhone(phone: string | null, countryCode: string): string | undefined {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("+")) return digits;
  return digits.startsWith("0") ? `+${countryCode}${digits.slice(1)}` : `+${digits}`;
}

/** The map pin in a Google Maps link ("…/@6.76,80.36,17z/…"). */
function pinOf(mapUrl: string | null): { latitude: number; longitude: number } | null {
  const m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(mapUrl ?? "");
  return m ? { latitude: Number(m[1]), longitude: Number(m[2]) } : null;
}

/** The business: a furniture shop with its address, telephone, hours, map pin and social pages. */
export function localBusinessLd(b: BusinessSettings, site: string, description?: string): Json {
  const phones = [b.phone, b.phoneAlt].map((p) => internationalPhone(p, b.phoneCountryCode)).filter((p): p is string => Boolean(p));
  const hours = parseHours(b.openingHours);
  const pin = pinOf(b.mapUrl);
  const address = parseAddress(b.address);
  // The social pages and the Google Maps listing: the same business, found in the places people look for it.
  const sameAs = [b.facebook, b.tiktok, b.mapUrl].filter((u): u is string => Boolean(u));
  return {
    "@context": "https://schema.org",
    "@type": "FurnitureStore",
    "@id": `${site}/#business`,
    name: b.name,
    url: site,
    logo: `${site}/logo-mark.png`,
    image: `${site}/logo-mark.png`,
    ...(description ? { description } : {}),
    ...(phones[0] ? { telephone: phones[0] } : {}),
    ...(b.email ? { email: b.email } : {}),
    ...(address ? { address } : {}),
    ...(address && (address as { addressCountry?: string }).addressCountry ? { areaServed: (address as { addressCountry?: string }).addressCountry } : {}),
    ...(pin ? { geo: { "@type": "GeoCoordinates", ...pin } } : {}),
    ...(b.mapUrl ? { hasMap: b.mapUrl } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(phones.length
      ? { contactPoint: phones.map((telephone) => ({ "@type": "ContactPoint", telephone, contactType: "customer service" })) }
      : {}),
    currenciesAccepted: b.currency,
  };
}

/** The website itself, tied to the business above. */
export function websiteLd(b: BusinessSettings, site: string): Json {
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": `${site}/#website`, url: site, name: b.name, publisher: { "@id": `${site}/#business` } };
}

/** A trail of pages (Home, Collection, Category, Piece) as search engines show it under a result. */
export function breadcrumbLd(site: string, trail: Array<{ name: string; path: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${site}${t.path}` })),
  };
}

/** Questions and answers exactly as they are written on the page. */
export function faqLd(items: Array<{ q: string; a: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

/** The town in the saved address, for page titles ("Kuruwita"); nothing when the address has none. */
export function townOf(address: string | null): string | null {
  const a = parseAddress(address);
  return (a?.addressLocality as string | undefined) ?? null;
}

/** "Kuruwita, Sri Lanka" for page text and titles: the town, and the country when the address names it. */
export function placeOf(address: string | null): string | null {
  const a = parseAddress(address);
  const town = a?.addressLocality as string | undefined;
  if (!town) return null;
  return a?.addressCountry === "LK" ? `${town}, Sri Lanka` : town;
}

/** A category page: a list of the pieces on it (the first page of them), as search engines read it. */
export function collectionLd(site: string, c: { name: string; path: string; description?: string; items: Array<{ name: string; path: string }> }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.name,
    url: `${site}${c.path}`,
    ...(c.description ? { description: c.description } : {}),
    isPartOf: { "@id": `${site}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: c.items.map((i, n) => ({ "@type": "ListItem", position: n + 1, name: i.name, url: `${site}${i.path}` })),
    },
  };
}
