import { describe, expect, it } from "vitest";
import { LOW_STOCK_AT, stockState } from "@/lib/stock";

describe("stockState", () => {
  it("made to order ignores the count", () => expect(stockState(true, 0)).toEqual({ state: "made_to_order" }));
  it("an uncounted option is untracked", () => {
    expect(stockState(false, null)).toEqual({ state: "untracked" });
    expect(stockState(false, undefined)).toEqual({ state: "untracked" });
  });
  it("zero is out, a few is low, plenty is in", () => {
    expect(stockState(false, 0)).toEqual({ state: "out" });
    expect(stockState(false, 1)).toEqual({ state: "low", left: 1 });
    expect(stockState(false, LOW_STOCK_AT)).toEqual({ state: "low", left: LOW_STOCK_AT });
    expect(stockState(false, LOW_STOCK_AT + 1)).toEqual({ state: "in", left: LOW_STOCK_AT + 1 });
  });
});
