/** What the website shows of the business's Google reviews. Nothing here is invented: it is exactly what Google returns, or nothing. */
export interface GoogleReview {
  /** Google's own identifier for the review (places/…/reviews/…), when it gives one. Used to recognise a review already saved. */
  id: string | null;
  author: string;
  /** 1 to 5. */
  rating: number;
  text: string;
  /** "a month ago", as Google words it. */
  when: string | null;
  /** The reviewer's Google profile, when Google gives one. */
  url: string | null;
  /** The reviewer's Google profile picture, when Google gives one. */
  photo: string | null;
  /** The day Google says the review was posted, as dd/mm/yyyy (no time). */
  date: string | null;
  /** The same moment as an ISO timestamp, to put reviews in order. */
  published: string | null;
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
export function googleReviewLink(b: { googlePlaceId: string | null; googleReviewUrl: string | null; name?: string; address?: string | null }): string | null {
  if (b.googlePlaceId) return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(b.googlePlaceId)}`;
  if (b.googleReviewUrl) return b.googleReviewUrl;
  // Nothing set in Settings yet: open the business's listing on Google Maps (found by name and place), where the visitor can write a review.
  if (b.name) {
    const where = (b.address ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(-3).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, where].filter(Boolean).join(" "))}`;
  }
  return null;
}

/** dd/mm/yyyy in Sri Lanka time, from the moment Google gives (an ISO timestamp). No time of day. */
export function formatReviewDate(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** A Google-hosted picture address only. */
function googlePhoto(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 500) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && /(^|\.)googleusercontent\.com$/.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
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
    const attr = (x.authorAttribution ?? {}) as { displayName?: unknown; uri?: unknown; photoUri?: unknown };
    const author = typeof attr.displayName === "string" && attr.displayName.trim() ? attr.displayName.trim() : "A Google user";
    if (!text || rating < 1 || rating > 5) continue;
    reviews.push({
      id: typeof x.name === "string" && x.name ? x.name : null,
      author,
      rating,
      text,
      when: typeof x.relativePublishTimeDescription === "string" ? x.relativePublishTimeDescription : null,
      url: typeof attr.uri === "string" && attr.uri.startsWith("https://") ? attr.uri : null,
      photo: googlePhoto(attr.photoUri),
      date: formatReviewDate(x.publishTime),
      published: typeof x.publishTime === "string" && !Number.isNaN(new Date(x.publishTime).getTime()) ? x.publishTime : null,
    });
  }
  const rating = typeof d.rating === "number" ? d.rating : null;
  const total = typeof d.userRatingCount === "number" ? d.userRatingCount : reviews.length;
  const mapsUrl = typeof d.googleMapsUri === "string" && d.googleMapsUri.startsWith("https://") ? d.googleMapsUri : null;
  if (reviews.length === 0 && rating === null) return null;
  return { rating, total, mapsUrl, reviews };
}

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** One page of the business's own Google reviews, from the Business Profile API (which, unlike the Places API, lists all of them). */
export function parseBusinessReviews(data: unknown): { reviews: GoogleReview[]; next: string | null; total: number | null; average: number | null } {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const raw = Array.isArray(d.reviews) ? d.reviews : [];
  const reviews: GoogleReview[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const rating = typeof x.starRating === "string" ? (STARS[x.starRating] ?? 0) : 0;
    const text = typeof x.comment === "string" ? x.comment.trim() : "";
    const who = (x.reviewer ?? {}) as { displayName?: unknown; profilePhotoUrl?: unknown; isAnonymous?: unknown };
    const author = who.isAnonymous !== true && typeof who.displayName === "string" && who.displayName.trim() ? who.displayName.trim() : "A Google user";
    const when = typeof x.createTime === "string" ? x.createTime : null;
    if (!text || rating < 1) continue;
    reviews.push({
      id: typeof x.name === "string" && x.name ? x.name : typeof x.reviewId === "string" && x.reviewId ? x.reviewId : null,
      author,
      rating,
      text,
      when: null,
      url: null,
      photo: googlePhoto(who.profilePhotoUrl),
      date: formatReviewDate(when),
      published: when && !Number.isNaN(new Date(when).getTime()) ? when : null,
    });
  }
  return {
    reviews,
    next: typeof d.nextPageToken === "string" && d.nextPageToken ? d.nextPageToken : null,
    total: typeof d.totalReviewCount === "number" ? d.totalReviewCount : null,
    average: typeof d.averageRating === "number" ? d.averageRating : null,
  };
}
