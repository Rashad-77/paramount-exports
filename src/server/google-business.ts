import "server-only";
import { kept } from "@/lib/data-cache";
import { serverEnv } from "@/lib/env";
import { parseBusinessReviews, type GoogleReview } from "@/lib/google-reviews";

export interface BusinessReviews {
  reviews: GoogleReview[];
  total: number | null;
  average: number | null;
}

/** True when the business owner has authorised the site to read all of the business's Google reviews. */
export function businessProfileIsSet(): boolean {
  try {
    const e = serverEnv();
    return Boolean(e.GOOGLE_BUSINESS_CLIENT_ID && e.GOOGLE_BUSINESS_CLIENT_SECRET && e.GOOGLE_BUSINESS_REFRESH_TOKEN && e.GOOGLE_BUSINESS_LOCATION);
  } catch {
    return false;
  }
}

/** The most reviews read in one go (pages of 50): far more than the website will ever show, and a stop against a runaway loop. */
const MAX_REVIEWS = 500;

async function readAll(): Promise<BusinessReviews | null> {
  const e = serverEnv();
  if (!e.GOOGLE_BUSINESS_CLIENT_ID || !e.GOOGLE_BUSINESS_CLIENT_SECRET || !e.GOOGLE_BUSINESS_REFRESH_TOKEN || !e.GOOGLE_BUSINESS_LOCATION) return null;
  const token = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.GOOGLE_BUSINESS_CLIENT_ID, client_secret: e.GOOGLE_BUSINESS_CLIENT_SECRET, refresh_token: e.GOOGLE_BUSINESS_REFRESH_TOKEN, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!token.ok) {
    console.error(`[google-business] Google refused the sign-in (${token.status}); the owner has to authorise again`);
    return null;
  }
  const access = ((await token.json()) as { access_token?: string }).access_token;
  if (!access) return null;

  const all: GoogleReview[] = [];
  let page: string | null = null;
  let total: number | null = null;
  let average: number | null = null;
  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${e.GOOGLE_BUSINESS_LOCATION}/reviews`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (page) url.searchParams.set("pageToken", page);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error(`[google-business] Google answered ${res.status}`);
      return all.length ? { reviews: all, total, average } : null;
    }
    const parsed = parseBusinessReviews(await res.json());
    all.push(...parsed.reviews);
    total = parsed.total ?? total;
    average = parsed.average ?? average;
    page = parsed.next;
  } while (page && all.length < MAX_REVIEWS);
  return { reviews: all, total, average };
}

const cached = kept(
  async () => {
    try {
      return await readAll();
    } catch (err) {
      console.error("[google-business] could not read the reviews:", err instanceof Error ? err.message : "unknown error");
      return null;
    }
  },
  ["google-business-reviews"],
  ["google-business"],
  6 * 60 * 60,
);

/** Every Google review of the business, kept for six hours. Null when it is not set up or Google does not answer (the site then falls back to the 5 the Places API gives). */
export async function getBusinessReviews(): Promise<BusinessReviews | null> {
  if (!businessProfileIsSet()) return null;
  return cached();
}
