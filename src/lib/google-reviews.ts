/** What the website shows of the business's Google reviews. Nothing here is invented: it is exactly what Google returns, or nothing. */
export interface GoogleReview {
  author: string;
  /** 1 to 5. */
  rating: number;
  text: string;
  /** "a month ago", as Google words it. */
  when: string | null;
  /** The reviewer's Google profile, when Google gives one. */
  url: string | null;
}

export interface GoogleReviews {
  /** Average rating across all Google reviews, 0 to 5. */
  rating: number | null;
  /** How many Google reviews the business has in all (Google returns only a few of them). */
  total: number;
  /** The business's page on Google Maps. */
  mapsUrl: string | null;
  reviews: GoogleReview[];
}

/** The link that opens Google's "write a review" box for the business: from the Place ID, else the link typed in Settings, else none. */
export function googleReviewLink(b: { googlePlaceId: string | null; googleReviewUrl: string | null }): string | null {
  if (b.googlePlaceId) return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(b.googlePlaceId)}`;
  return b.googleReviewUrl ?? null;
}

/** Turns the answer of Google's Places API (New) into what the site shows. Anything unusable is left out. */
export function parsePlaceReviews(data: unknown): GoogleReviews | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const raw = Array.isArray(d.reviews) ? d.reviews : [];
  const reviews: GoogleReview[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const text = typeof (x.text as { text?: unknown } | undefined)?.text === "string" ? ((x.text as { text: string }).text).trim() : "";
    const rating = typeof x.rating === "number" ? Math.round(x.rating) : 0;
    const attr = (x.authorAttribution ?? {}) as { displayName?: unknown; uri?: unknown };
    const author = typeof attr.displayName === "string" && attr.displayName.trim() ? attr.displayName.trim() : "A Google user";
    if (!text || rating < 1 || rating > 5) continue;
    reviews.push({
      author,
      rating,
      text,
      when: typeof x.relativePublishTimeDescription === "string" ? x.relativePublishTimeDescription : null,
      url: typeof attr.uri === "string" && attr.uri.startsWith("https://") ? attr.uri : null,
    });
  }
  const rating = typeof d.rating === "number" ? d.rating : null;
  const total = typeof d.userRatingCount === "number" ? d.userRatingCount : reviews.length;
  const mapsUrl = typeof d.googleMapsUri === "string" && d.googleMapsUri.startsWith("https://") ? d.googleMapsUri : null;
  if (reviews.length === 0 && rating === null) return null;
  return { rating, total, mapsUrl, reviews };
}
