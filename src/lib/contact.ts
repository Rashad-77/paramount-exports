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
