import { FlowPanel } from "@/components/app/flow-panel";
import { nextStep, orderSteps, type FlowOrder } from "@/lib/order-flow";

/**
 * The order's journey, written for this order: the steps in between (a pickup has no "out for delivery"),
 * what to do next, and when "paid" is recorded.
 */
export function OrderFlow({ order, timezone }: { order: FlowOrder; timezone: string }) {
  const next = nextStep(order);
  const note =
    order.status === "cancelled"
      ? "This order was cancelled. Nothing more to do unless it is reopened."
      : order.status === "refunded"
        ? "This order has been refunded and its items are back in stock. Nothing more to do."
        : (next ?? "Completed: the order is finished and paid.");
  return <FlowPanel label="How this order works" steps={orderSteps(order)} note={note} timezone={timezone} />;
}
