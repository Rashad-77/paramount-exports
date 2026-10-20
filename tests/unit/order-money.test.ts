import { describe, expect, it } from "vitest";
import { orderMoney } from "@/lib/order-money-calc";

const m = (total: string, paid: string, refunded = "0") => orderMoney({ total, paidAmount: paid, refundedAmount: refunded });

describe("an order's money position", () => {
  it("starts unpaid with the whole total due", () => {
    expect(m("100000", "0")).toMatchObject({ state: "unpaid", balance: "100000.00", isPaid: false });
  });

  it("a deposit makes it part paid, with the rest still due", () => {
    expect(m("100000", "30000")).toMatchObject({ state: "part", balance: "70000.00", isPaid: false });
  });

  it("paying the balance makes it paid", () => {
    expect(m("100000", "100000")).toMatchObject({ state: "paid", balance: "0.00", isPaid: true });
  });

  it("a refund after paying in full leaves nothing due, and reads as partly refunded", () => {
    expect(m("100000", "100000", "30000")).toMatchObject({ state: "part_refunded", balance: "0.00", isPaid: true });
  });

  it("paying everything back reads as refunded and not paid", () => {
    expect(m("100000", "100000", "100000")).toMatchObject({ state: "refunded", isPaid: false });
  });

  it("refunding part of a deposit grows the balance again", () => {
    expect(m("100000", "40000", "10000")).toMatchObject({ state: "part", balance: "70000.00" });
  });

  it("paying more than the total shows the overpayment, not a negative balance", () => {
    expect(m("100000", "120000")).toMatchObject({ balance: "0.00", overpaid: "20000.00" });
  });

  it("an order with a zero total is never counted as paid", () => {
    expect(m("0", "0").isPaid).toBe(false);
  });
});
