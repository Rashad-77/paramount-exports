import { describe, expect, it } from "vitest";
import { reviewKey } from "@/server/google-review-store";

describe("reviewKey", () => {
  it("uses Google's review id when there is one", () => {
    expect(reviewKey({ id: "places/P/reviews/R1", author: "A", rating: 5, text: "Lovely" })).toBe("places/P/reviews/R1");
  });
  it("otherwise fingerprints author, stars and words, ignoring case and spacing", () => {
    const a = reviewKey({ id: null, author: "Nimal P.", rating: 5, text: "Beautiful  table" });
    expect(reviewKey({ id: null, author: "nimal p.", rating: 5, text: "beautiful table" })).toBe(a);
    expect(reviewKey({ id: null, author: "Nimal P.", rating: 4, text: "Beautiful table" })).not.toBe(a);
  });
});
