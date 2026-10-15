import { describe, expect, it } from "vitest";
import { isOverdue, localDateString } from "@/lib/time";

describe("business-timezone dates", () => {
  // 2026-03-10 20:00 UTC is already 2026-03-11 01:30 in Asia/Colombo (UTC+5:30).
  const instant = new Date("2026-03-10T20:00:00Z");

  it("derives the local calendar date from a UTC instant", () => {
    expect(localDateString(instant, "UTC")).toBe("2026-03-10");
    expect(localDateString(instant, "Asia/Colombo")).toBe("2026-03-11");
  });

  it("treats a task as overdue only when due strictly before local today", () => {
    expect(isOverdue("2026-03-10", false, "Asia/Colombo", instant)).toBe(true);
    expect(isOverdue("2026-03-11", false, "Asia/Colombo", instant)).toBe(false);
    expect(isOverdue("2026-03-01", true, "Asia/Colombo", instant)).toBe(false);
  });
});
