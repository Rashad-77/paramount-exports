/** A Google review kept on the site. Staff type them in on the dashboard's Reviews page; nothing here is invented. */
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
