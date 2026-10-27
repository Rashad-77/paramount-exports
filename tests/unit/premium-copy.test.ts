import { describe, expect, it } from "vitest";
import { PREMIUM_MAX_WORDS, countWords } from "@/lib/premium-copy";
import { productUpdateSchema } from "@/lib/schemas/catalogue";

describe("premium descriptions", () => {
  it("counts words across spaces and line breaks", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords("  one two\nthree\n\nfour  ")).toBe(4);
  });

  it("refuses a premium, featured piece whose description is too long, and only then", () => {
    const base = { name: "Table", kind: "stocked", categoryId: "00000000-0000-4000-8000-000000000001", isPremium: "on", isFeatured: "on" };
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    const tooLong = productUpdateSchema.safeParse({ ...base, description: words(PREMIUM_MAX_WORDS + 1) });
    expect(tooLong.success ? [] : tooLong.error.issues.filter((i) => i.path[0] === "description")).toHaveLength(1);
    const fits = productUpdateSchema.safeParse({ ...base, description: words(PREMIUM_MAX_WORDS) });
    expect(fits.success ? [] : fits.error.issues.filter((i) => i.path[0] === "description")).toHaveLength(0);
    const notPremium = productUpdateSchema.safeParse({ ...base, isPremium: undefined, description: words(PREMIUM_MAX_WORDS + 50) });
    expect(notPremium.success ? [] : notPremium.error.issues.filter((i) => i.path[0] === "description")).toHaveLength(0);
  });
});
