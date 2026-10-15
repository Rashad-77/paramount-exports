/**
 * Phone / email normalisation for duplicate WARNINGS (never for silent merging).
 * Two numbers are considered the same person's when their last 9 digits match, so +94 77 123 4567,
 * 0771234567 and 94771234567 all collide regardless of how the country prefix was typed.
 */
const MATCH_DIGITS = 9;

export const digitsOnly = (raw: string): string => raw.replace(/\D/g, "");

export function isPlausiblePhone(raw: string): boolean {
  if (!/^[+\d][\d\s\-().]*$/.test(raw.trim())) return false;
  const n = digitsOnly(raw).length;
  return n >= 7 && n <= 15;
}

export function phoneKey(raw: string): string {
  const d = digitsOnly(raw);
  return d.length > MATCH_DIGITS ? d.slice(-MATCH_DIGITS) : d;
}

export const normaliseEmail = (raw: string): string => raw.trim().toLowerCase();

/**
 * wa.me link for staff to open a chat manually (no message is sent automatically).
 * Numbers with a leading 0 get `countryCode` substituted; numbers starting with + or the country code are used as-is.
 */
export function whatsappLink(phone: string, countryCode = "94"): string {
  let d = digitsOnly(phone);
  if (phone.trim().startsWith("+")) {
    /* already international */
  } else if (d.startsWith("00")) {
    d = d.slice(2);
  } else if (d.startsWith("0")) {
    d = countryCode + d.slice(1);
  } else if (!d.startsWith(countryCode)) {
    d = countryCode + d;
  }
  return `https://wa.me/${d}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * The address of an embeddable map for a Google Maps link that carries the place's position (the `@lat,lng` or `!3d…!4d…` part).
 * Anything else gives null, and the page shows a plain link instead.
 */
export function mapEmbedUrl(mapUrl: string | null | undefined): string | null {
  if (!mapUrl) return null;
  let u: URL;
  try {
    u = new URL(mapUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !/^(www\.)?google\.[a-z.]+$/.test(u.hostname) || !u.pathname.startsWith("/maps")) return null;
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(mapUrl) ?? /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(mapUrl);
  if (!pin) return null;
  // With the place's own id the map shows the business card for the pin, as Google's share-and-embed does; without it, just the position.
  const id = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(mapUrl)?.[1];
  const name = /\/maps\/place\/([^/@]+)/.exec(u.pathname + "/")?.[1];
  if (id && name) {
    const label = encodeURIComponent(decodeURIComponent(name.replace(/\+/g, " ")));
    return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2500!2d${pin[2]}!3d${pin[1]}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s${encodeURIComponent(id)}!2s${label}!5e0!3m2!1sen!2slk!4v1`;
  }
  return `https://www.google.com/maps?q=${pin[1]},${pin[2]}&z=17&output=embed`;
}
