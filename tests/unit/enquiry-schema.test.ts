import { describe, expect, it } from "vitest";
import { enquirySchema } from "@/lib/schemas/enquiry";

const base = { kind: "custom", name: "A Visitor", phone: "0715354001", furnitureType: "Dining table", consent: "on" };
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe("custom enquiry date", () => {
  it("accepts today or a later date, or none", () => {
    expect(enquirySchema.safeParse({ ...base }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...base, targetDate: day(0) }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...base, targetDate: day(30) }).success).toBe(true);
  });
  it("refuses a date in the past with a clear message", () => {
    const r = enquirySchema.safeParse({ ...base, targetDate: day(-10) });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("today or later");
  });
});
