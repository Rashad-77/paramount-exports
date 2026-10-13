import { describe, expect, it } from "vitest";
import { MAX_TESTIMONIALS, parseTestimonials } from "@/lib/testimonials";

describe("parseTestimonials", () => {
  it("returns nothing when there is no text, so no review is ever invented", () => {
    expect(parseTestimonials(null)).toEqual([]);
    expect(parseTestimonials("   \n\n  ")).toEqual([]);
  });

  it("reads a quote with a name and town", () => {
    expect(parseTestimonials('"A lovely table."\n— Test Person, Colombo')).toEqual([{ quote: "A lovely table.", name: "Test Person", place: "Colombo" }]);
  });

  it("splits blocks on blank lines and allows a quote with no attribution", () => {
    const r = parseTestimonials("First review\n- A Name\n\nSecond review over\ntwo lines\r\n\r\nThird");
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ quote: "First review", name: "A Name", place: null });
    expect(r[1]).toEqual({ quote: "Second review over two lines", name: null, place: null });
    expect(r[2]!.quote).toBe("Third");
  });

  it("shows at most the allowed number", () => {
    const text = Array.from({ length: MAX_TESTIMONIALS + 5 }, (_, i) => `Review ${i}`).join("\n\n");
    expect(parseTestimonials(text)).toHaveLength(MAX_TESTIMONIALS);
  });
});
