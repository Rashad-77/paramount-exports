export interface Testimonial {
  quote: string;
  name: string | null;
  place: string | null;
}

/** Most reviews shown on the homepage. */
export const MAX_TESTIMONIALS = 12;

/**
 * Customer reviews are kept as plain text in Website content: one review per blank-line-separated block, the quote first and
 * an optional last line that starts with a dash, "— Name, Place". Nothing is ever invented: with no text there are no reviews.
 */
export function parseTestimonials(text: string | null | undefined): Testimonial[] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, MAX_TESTIMONIALS)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const last = lines.length > 1 ? lines[lines.length - 1]! : "";
      const attribution = /^[—–-]\s*(.+)$/.exec(last);
      const quoteLines = attribution ? lines.slice(0, -1) : lines;
      const [name, ...place] = (attribution?.[1] ?? "").split(",").map((p) => p.trim());
      return {
        quote: quoteLines.join(" ").replace(/^["“”]+|["“”]+$/g, "").trim(),
        name: name || null,
        place: place.join(", ") || null,
      };
    })
    .filter((t) => t.quote.length > 0);
}
