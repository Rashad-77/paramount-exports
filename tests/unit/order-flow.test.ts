import { describe, expect, it } from "vitest";
import { nextStep, orderSteps, type FlowOrder } from "@/lib/order-flow";
import { discountFrom } from "@/server/order-money";

const base: FlowOrder = {
  status: "new",
  fulfilment: "delivery",
  paymentMethod: "on_delivery",
  isPaid: false,
  total: "100000",
  currency: "LKR",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  confirmedAt: null,
  readyAt: null,
  outForDeliveryAt: null,
  deliveredAt: null,
  paidAt: null,
  cancelledAt: null,
};

describe("the order's steps", () => {
  it("a delivery goes placed, confirmed, ready, delivered, then payment", () => {
    expect(orderSteps(base).map((s) => s.label)).toEqual(["Order placed", "Confirmed", "Ready to send", "Delivered", "Payment received"]);
  });

  it("a pickup says collected, not delivered", () => {
    expect(orderSteps({ ...base, fulfilment: "pickup" }).map((s) => s.label)).toContain("Collected");
  });

  it("marks the first unfinished step as current", () => {
    const steps = orderSteps({ ...base, status: "confirmed", confirmedAt: new Date() });
    expect(steps.find((s) => s.state === "current")?.key).toBe("ready");
  });

  it("a cancelled order has no current step", () => {
    expect(orderSteps({ ...base, status: "cancelled" }).some((s) => s.state === "current")).toBe(false);
  });

  it("tells staff what to do next, never mentioning the removed out-for-delivery step", () => {
    for (const status of ["new", "confirmed", "ready"] as const) expect(nextStep({ ...base, status })).not.toMatch(/out for delivery/i);
  });
});

describe("discounts", () => {
  it("takes a percentage of the items", () => {
    expect(discountFrom("192000", undefined, "10")).toBe("19200.00");
  });

  it("takes a fixed amount", () => {
    expect(discountFrom("192000", "5000")).toBe("5000.00");
  });

  it("cannot be more than the items cost", () => {
    expect(() => discountFrom("1000", "1500")).toThrow();
  });
});
