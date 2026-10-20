import type { Fulfilment, OrderStatus, PaymentMethod } from "@/lib/order-constants";

/** What an order page needs to know to describe the order's journey. Delivery and pickup orders take different roads, and each payment method has its own moment for "paid". */
export interface FlowOrder {
  status: OrderStatus;
  fulfilment: Fulfilment;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  total: string;
  currency: string;
  createdAt: Date;
  confirmedAt: Date | null;
  readyAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
}

export interface FlowStep {
  key: string;
  label: string;
  at: Date | null;
  state: "done" | "current" | "todo";
}

/** The stages an order goes through, in order. A pickup has no "out for delivery"; payment is its own last step because staff record it separately. */
export function orderSteps(o: FlowOrder): FlowStep[] {
  const delivery = o.fulfilment === "delivery";
  const rank: Record<OrderStatus, number> = { new: 0, confirmed: 1, in_progress: 1, ready: 2, out_for_delivery: 2, delivered: 3, cancelled: -1 };
  const at = rank[o.status];
  const defs: Array<{ key: string; label: string; at: Date | null; rank: number }> = [
    { key: "placed", label: "Order placed", at: o.createdAt, rank: 0 },
    { key: "confirmed", label: "Confirmed", at: o.confirmedAt, rank: 1 },
    { key: "ready", label: delivery ? "Ready to send" : "Ready to collect", at: o.readyAt, rank: 2 },
    { key: "done", label: delivery ? "Delivered" : "Collected", at: o.deliveredAt, rank: 3 },
  ];
  // A step is done once the order has reached it; the current step is the first one still to do, the same thing the Next step line says.
  const isDone = (d: (typeof defs)[number]) => d.key === "placed" || d.rank <= at;
  const steps: FlowStep[] = defs.map((d) => ({
    key: d.key,
    label: d.label,
    at: d.at,
    // A cancelled order keeps the steps it reached and shows nothing as current.
    state: o.status === "cancelled" ? (d.at ? "done" : "todo") : isDone(d) ? "done" : "todo",
  }));
  // The first step not yet done is where the order is now.
  const now = steps.findIndex((st) => st.state === "todo");
  if (o.status !== "cancelled" && now >= 0) steps[now]!.state = "current";
  steps.push({ key: "paid", label: "Payment received", at: o.paidAt, state: o.isPaid ? "done" : o.status === "delivered" ? "current" : "todo" });
  return steps;
}

/** The one thing to do next, for this order's current stage. `null` when nothing is left to do. */
export function nextStep(o: FlowOrder): string | null {
  const delivery = o.fulfilment === "delivery";
  switch (o.status) {
    case "new":
      return delivery
        ? "Check the order and the address, agree the delivery charge with the customer and save it, then press “Confirm order”."
        : "Check the order, then press “Confirm order”. There is no delivery charge for a pickup.";
    case "confirmed":
    case "in_progress":
      return o.paymentMethod === "bank_transfer" && !o.isPaid
        ? "Prepare the order and press “Mark as ready”. Watch for the bank transfer and mark it as paid when it arrives."
        : "Prepare the order and press “Mark as ready”.";
    case "ready":
      return delivery
        ? "Agree the delivery day with the customer. When it has been delivered, press “Mark as delivered”."
        : "Tell the customer it can be collected from the showroom" + (o.paymentMethod === "at_showroom" ? ", and take the payment when they arrive" : o.isPaid ? "" : ", once the transfer has arrived") + ". When they have it, press “Mark as collected”.";
    case "out_for_delivery":
      return o.paymentMethod === "on_delivery"
        ? "When it arrives and the cash is collected, press “Mark as delivered”, then “Mark as paid” once the money is back at the showroom."
        : "When it arrives, press “Mark as delivered”.";
    case "delivered":
      return o.isPaid ? null : "The order has been " + (delivery ? "delivered" : "collected") + ". Press “Mark as paid” when the money has been received.";
    case "cancelled":
      return null;
  }
}
