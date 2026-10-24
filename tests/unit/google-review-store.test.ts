import { describe, expect, it } from "vitest";
import { parsePlaceReviews } from "@/lib/google-reviews";
import { reviewKey } from "@/server/google-review-store";

describe("reviewKey", () => {
  it("uses Google's review id when there is one", () => {
    const r = parsePlaceReviews({ reviews: [{ name: "places/P/reviews/R1", rating: 5, text: { text: "Lovely" }, authorAttribution: { displayName: "A" } }] })!.reviews[0]!;
    expect(r.id).toBe("places/P/reviews/R1");
    expect(reviewKey(r)).toBe("places/P/reviews/R1");
  });
  it("otherwise fingerprints author, stars and words, ignoring case and spacing", () => {
    const a = reviewKey({ id: null, author: "Nimal P.", rating: 5, text: "Beautiful  table" });
    expect(reviewKey({ id: null, author: "nimal p.", rating: 5, text: "beautiful table" })).toBe(a);
    expect(reviewKey({ id: null, author: "Nimal P.", rating: 4, text: "Beautiful table" })).not.toBe(a);
  });
});
