import "server-only";
import { serverEnv } from "@/lib/env";
import { parsePlaceReviews, type GoogleReviews } from "@/lib/google-reviews";
import { getBusinessReviews } from "./google-business";

/** True when a Google API key is set, so Settings can say whether Google reviews are connected. The key itself is never shown. */
export function googleKeyIsSet(): boolean {
  try {
    return Boolean(serverEnv().GOOGLE_PLACES_API_KEY);
  } catch {
    return false;
  }
}

/** Google lets a site keep what it fetched for a short while only, so the answer is reused for a day and then fetched again. */
const REVALIDATE_SECONDS = 24 * 60 * 60;

/**
 * The business's Google rating and its most recent reviews, from the Places API (New). Returns null when no Place ID or API key is
 * set, or when Google does not answer: the website then simply shows no Google reviews. It never throws and never blocks a page.
 */
export async function getGoogleReviews(placeId: string | null, opts: { fresh?: boolean } = {}): Promise<GoogleReviews | null> {
  const places = await getPlaceReviews(placeId, opts.fresh === true);
  // When the owner has authorised the Business Profile API, every review is shown (the Places API gives only 5).
  const all = await getBusinessReviews();
  if (all && all.reviews.length > 0) {
    return {
      rating: places?.rating ?? all.average,
      total: places?.total ?? all.total ?? all.reviews.length,
      mapsUrl: places?.mapsUrl ?? null,
      reviews: all.reviews,
    };
  }
  return places;
}

async function getPlaceReviews(placeId: string | null, fresh: boolean): Promise<GoogleReviews | null> {
  if (!placeId) return null;
  let key: string | undefined;
  let base = "https://places.googleapis.com/v1/places";
  try {
    const env = serverEnv();
    key = env.GOOGLE_PLACES_API_KEY;
    base = (env.GOOGLE_PLACES_API_URL ?? base).replace(/\/$/, "");
  } catch {
    return null;
  }
  if (!key) return null;
  try {
    const res = await fetch(`${base}/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews" },
      signal: AbortSignal.timeout(6000),
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
    });
    if (!res.ok) {
      console.error(`[google-reviews] Google answered ${res.status}`);
      return null;
    }
    return parsePlaceReviews(await res.json());
  } catch (e) {
    console.error("[google-reviews] could not reach Google:", e instanceof Error ? e.message : "unknown error");
    return null;
  }
}
