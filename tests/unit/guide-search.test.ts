import { describe, expect, it } from "vitest";
import { searchGuide, stem, words } from "@/lib/guide-search";
import { GUIDE, GUIDE_SECTIONS } from "@/lib/owner-guide";

const top = (q: string) => searchGuide(q, GUIDE)[0]?.item.id;
const ids = (q: string) => searchGuide(q, GUIDE).map((m) => m.item.id);

describe("guide search", () => {
  it("cuts words down to roots and drops filler words", () => {
    expect(stem("photos")).toBe(stem("photo"));
    expect(stem("adding")).toBe(stem("add"));
    expect(words("How do I add a photo?")).toEqual([stem("add"), stem("photo")]);
    expect(words("the of a")).toEqual([]);
  });

  it("finds the right answer for the questions the owner is likely to ask", () => {
    expect(top("how do I add a product")).toBe("add-product");
    expect(top("change order of photos")).toBe("photos");
    expect(top("crop a picture")).toBe("photos");
    expect(top("put a discount on a product")).toBe("price");
    expect(top("what does archived mean")).toBe("status");
    expect(top("premium range")).toBe("premium");
    expect(top("how many words in premium description")).toBe("premium");
    expect(top("hide a review")).toBe("hide-review");
    expect(top("refund an order")).toBe("payment");
    expect(top("where do I change opening hours")).toBe("settings");
    expect(top("google place id")).toBe("place-id");
    expect(top("forgot my password")).toBe("account");
    expect(top("category banner picture")).toBe("add-category");
    expect(top("print receipt")).toBe("print");
    expect(top("why is my product not showing")).toBe("not-showing");
  });

  it("returns nothing for an empty or unrelated question", () => {
    expect(searchGuide("", GUIDE)).toEqual([]);
    expect(searchGuide("how do I", GUIDE)).toEqual([]);
    expect(searchGuide("zzzz qqqq", GUIDE)).toEqual([]);
  });

  it("returns at most four answers, best first", () => {
    expect(searchGuide("product", GUIDE).length).toBeLessThanOrEqual(4);
    expect(ids("photo").length).toBeGreaterThan(0);
  });
});

describe("guide content", () => {
  it("has unique ids and only known sections", () => {
    expect(new Set(GUIDE.map((g) => g.id)).size).toBe(GUIDE.length);
    for (const g of GUIDE) expect(GUIDE_SECTIONS as readonly string[], g.id).toContain(g.section);
  });

  it("gives every entry a question, a short answer and detailed steps", () => {
    for (const g of GUIDE) {
      expect(g.question.endsWith("?"), g.id).toBe(true);
      expect(g.answer.length, g.id).toBeGreaterThan(20);
      expect(g.steps?.length ?? 0, g.id).toBeGreaterThan(0);
    }
  });

  it("only links to screens that exist", () => {
    for (const g of GUIDE) if (g.link) expect(g.link.href.startsWith("/app"), g.id).toBe(true);
  });
});
