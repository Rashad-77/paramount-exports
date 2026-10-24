import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleReviewLink, parsePlaceReviews } from "@/lib/google-reviews";

describe("googleReviewLink", () => {
  it("builds the review link from the Place ID, else uses the typed link, else none", () => {
    expect(googleReviewLink({ googlePlaceId: "ChIJabc-DEF_123", googleReviewUrl: "https://g.page/r/x/review" })).toBe("https://search.google.com/local/writereview?placeid=ChIJabc-DEF_123");
    expect(googleReviewLink({ googlePlaceId: null, googleReviewUrl: "https://g.page/r/x/review" })).toBe("https://g.page/r/x/review");
    expect(googleReviewLink({ googlePlaceId: null, googleReviewUrl: null })).toBeNull();
  });
});

describe("parsePlaceReviews", () => {
  const sample = {
    rating: 4.8,
    userRatingCount: 12,
    googleMapsUri: "https://maps.google.com/?cid=1",
    reviews: [
      { rating: 5, text: { text: "  Beautiful table, delivered on time.  " }, relativePublishTimeDescription: "a month ago", publishTime: "2026-09-23T20:30:00Z", authorAttribution: { displayName: "Nimal P.", uri: "https://www.google.com/maps/contrib/1", photoUri: "https://lh3.googleusercontent.com/a/abc=s64-c" } },
      { rating: 4, text: { text: "Good work." }, authorAttribution: { uri: "javascript:alert(1)" } },
      { rating: 5, text: { text: "" }, authorAttribution: { displayName: "No text" } },
      { rating: 9, text: { text: "Out of range" } },
      "nonsense",
    ],
  };
  it("keeps the real reviews and drops anything unusable", () => {
    const r = parsePlaceReviews(sample)!;
    expect(r.rating).toBe(4.8);
    expect(r.total).toBe(12);
    expect(r.mapsUrl).toBe("https://maps.google.com/?cid=1");
    expect(r.reviews).toHaveLength(2);
    expect(r.reviews[0]).toEqual({
      author: "Nimal P.",
      rating: 5,
      text: "Beautiful table, delivered on time.",
      when: "a month ago",
      url: "https://www.google.com/maps/contrib/1",
      photo: "https://lh3.googleusercontent.com/a/abc=s64-c",
      // 20:30 UTC on the 23rd is already the 24th in Sri Lanka (UTC+5:30); dd/mm/yyyy with no time.
      date: "24/09/2026",
    });
    expect(r.reviews[1]).toMatchObject({ author: "A Google user", url: null, photo: null, date: null });
  });
  it("returns nothing for an empty or odd answer", () => {
    expect(parsePlaceReviews(null)).toBeNull();
    expect(parsePlaceReviews({})).toBeNull();
    expect(parsePlaceReviews({ rating: 5, userRatingCount: 1 })).toMatchObject({ rating: 5, total: 1, reviews: [] });
  });
});

describe("getGoogleReviews", () => {
  const real = globalThis.fetch;
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL ??= "postgres://x:x@127.0.0.1:5432/x";
  });
  afterEach(() => {
    globalThis.fetch = real;
    delete process.env.GOOGLE_PLACES_API_KEY;
    vi.restoreAllMocks();
  });

  it("asks Google with the key and the Place ID, and returns what it says", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key-1234567";
    const calls: { url: string; headers: Record<string, string> }[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return new Response(JSON.stringify({ rating: 5, userRatingCount: 1, reviews: [{ rating: 5, text: { text: "Lovely." }, authorAttribution: { displayName: "A B" } }] }), { status: 200 });
    }) as typeof fetch;
    const { getGoogleReviews } = await import("@/server/google-reviews");
    const r = await getGoogleReviews("ChIJabcdefghij");
    expect(r?.reviews[0]?.text).toBe("Lovely.");
    expect(calls[0]!.url).toBe("https://places.googleapis.com/v1/places/ChIJabcdefghij");
    expect(calls[0]!.headers["X-Goog-Api-Key"]).toBe("test-key-1234567");
    expect(calls[0]!.headers["X-Goog-FieldMask"]).toContain("reviews");
  });

  it("shows nothing when there is no key or no Place ID", async () => {
    globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
    const { getGoogleReviews } = await import("@/server/google-reviews");
    expect(await getGoogleReviews("ChIJabcdefghij")).toBeNull(); // no key set
    expect(await getGoogleReviews(null)).toBeNull();
  });

  it("shows nothing, and does not throw, when Google refuses or cannot be reached", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key-1234567";
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    globalThis.fetch = (async () => new Response("denied", { status: 403 })) as typeof fetch;
    const { getGoogleReviews } = await import("@/server/google-reviews");
    expect(await getGoogleReviews("ChIJabcdefghij")).toBeNull();
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    expect(await getGoogleReviews("ChIJabcdefghij")).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
