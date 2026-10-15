import { describe, expect, it } from "vitest";
import {
  dec,
  documentTotals,
  isDecimalString,
  lineTotal,
  moneyString,
  outstandingBalance,
  qtyString,
  sum,
} from "@/lib/money";

describe("decimal arithmetic", () => {
  it("does not suffer from floating point error", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem we are avoiding
    expect(sum(["0.1", "0.2"]).toString()).toBe("0.3");
    expect(sum(Array(10).fill("0.1")).toString()).toBe("1");
  });

  it("rounds half up to 2 dp for money and 3 dp for quantity", () => {
    expect(moneyString("1.005")).toBe("1.01");
    expect(moneyString("2.675")).toBe("2.68");
    expect(moneyString("10")).toBe("10.00");
    expect(qtyString("1.0005")).toBe("1.001");
    expect(qtyString("2")).toBe("2.000");
  });

  it("rejects junk input", () => {
    expect(() => dec("abc")).toThrow();
    expect(() => dec("")).toThrow();
    expect(() => dec(Number.NaN)).toThrow();
    expect(() => dec(Number.POSITIVE_INFINITY)).toThrow();
    expect(isDecimalString("12.50")).toBe(true);
    expect(isDecimalString("12,50")).toBe(false);
    expect(isDecimalString("1e3")).toBe(false);
  });
});

describe("line and document totals", () => {
  it("computes a line as quantity × price − discount", () => {
    expect(lineTotal({ quantity: "3", unitPrice: "19.99", discountAmount: "0.97" }).toFixed(2)).toBe("59.00");
    expect(lineTotal({ quantity: "2.5", unitPrice: "100" }).toFixed(2)).toBe("250.00");
  });

  it("refuses a discount larger than the line value", () => {
    expect(() => lineTotal({ quantity: 1, unitPrice: "10", discountAmount: "10.01" })).toThrow(/exceeds/);
  });

  it("builds document totals from lines plus delivery", () => {
    const t = documentTotals(
      [
        { quantity: "2", unitPrice: "1500.50", discountAmount: "100" },
        { quantity: "1", unitPrice: "250.25" },
      ],
      "75",
    );
    expect(t.subtotal.toFixed(2)).toBe("3251.25");
    expect(t.discountTotal.toFixed(2)).toBe("100.00");
    expect(t.deliveryCharge.toFixed(2)).toBe("75.00");
    expect(t.total.toFixed(2)).toBe("3226.25");
  });

  it("rejects a negative delivery charge", () => {
    expect(() => documentTotals([{ quantity: 1, unitPrice: 1 }], "-5")).toThrow();
  });
});

describe("outstanding balance", () => {
  it("subtracts recorded payments exactly", () => {
    expect(outstandingBalance("1000.00", ["333.33", "333.33", "333.33"]).toFixed(2)).toBe("0.01");
    expect(outstandingBalance("500", []).toFixed(2)).toBe("500.00");
  });

  it("goes negative when overpaid so it can be flagged", () => {
    expect(outstandingBalance("100", ["100.01"]).toFixed(2)).toBe("-0.01");
  });
});
