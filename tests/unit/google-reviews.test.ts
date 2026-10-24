import { describe, expect, it } from "vitest";
import { formatReviewDate, googleReviewLink } from "@/lib/google-reviews";

describe("googleReviewLink", () => {
  it("builds the review link from the Place ID, else uses the typed link, else none", () => {
    expect(googleReviewLink({ googlePlaceId: "ChIJabc-DEF_123", googleReviewUrl: "https://g.page/r/x/review" })).toBe("https://search.google.com/local/writereview?placeid=ChIJabc-DEF_123");
    expect(googleReviewLink({ googlePlaceId: null, googleReviewUrl: "https://g.page/r/x/review" })).toBe("https://g.page/r/x/review");
    expect(googleReviewLink({ googlePlaceId: null, googleReviewUrl: null })).toBeNull();
  });
});

describe("formatReviewDate", () => {
  it("gives dd/mm/yyyy in Sri Lanka time, with no time of day", () => {
    // 20:30 UTC on the 23rd is already the 24th in Sri Lanka (UTC+5:30).
    expect(formatReviewDate("2026-09-23T20:30:00Z")).toBe("24/09/2026");
    expect(formatReviewDate(null)).toBeNull();
    expect(formatReviewDate("not a date")).toBeNull();
  });
});
