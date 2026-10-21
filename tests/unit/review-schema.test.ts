import { describe, expect, it } from "vitest";
import { reviewSchema } from "@/lib/schemas/reviews";

const valid = { stars: "5", body: "Lovely table, delivered on time.", name: "Nimali Perera", city: "Colombo" };

describe("review pop-up schema", () => {
  it("accepts stars, words, name and city, with no photos", () => {
    const r = reviewSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.stars).toBe(5);
      expect(r.data.fileIds).toEqual([]);
    }
  });

  it("needs the stars, the words, the name and the city", () => {
    const r = reviewSchema.safeParse({ stars: "", body: "", name: "", city: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors).sort()).toEqual(["body", "city", "name", "stars"]);
  });

  it("keeps stars between 1 and 5", () => {
    expect(reviewSchema.safeParse({ ...valid, stars: "0" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, stars: "6" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, stars: "2.5" }).success).toBe(false);
  });

  it("allows up to five photos", () => {
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    expect(reviewSchema.safeParse({ ...valid, fileIds: [id(1), id(2), id(3), id(4), id(5)] }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...valid, fileIds: [id(1), id(2), id(3), id(4), id(5), id(6)] }).success).toBe(false);
  });
});
