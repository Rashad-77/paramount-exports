import { describe, expect, it } from "vitest";
import { withUnit } from "@/lib/dimensions";

describe("withUnit", () => {
  it("puts the chosen unit after the numbers", () => {
    expect(withUnit("180 × 90 × 75", "cm")).toBe("180 × 90 × 75 cm");
    expect(withUnit("  2 x 6 x 12  ", "ft")).toBe("2 x 6 x 12 ft");
  });
  it("keeps units the customer typed", () => {
    expect(withUnit("2 in × 6 in × 12 ft", "cm")).toBe("2 in × 6 in × 12 ft");
    expect(withUnit('2" × 6"', "cm")).toBe('2" × 6"');
  });
  it("is empty when nothing was typed, whatever the unit", () => {
    expect(withUnit("", "cm")).toBeNull();
    expect(withUnit(undefined, "cm")).toBeNull();
  });
  it("leaves the text alone when no unit comes with it", () => {
    expect(withUnit("180 × 90", undefined)).toBe("180 × 90");
  });
});
