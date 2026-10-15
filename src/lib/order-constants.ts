/** Plain order constants and labels. No server-only imports, so client components can use them. */

export const FULFILMENT = ["delivery", "pickup"] as const;
export const PAYMENT_METHODS = ["on_delivery", "bank_transfer", "at_showroom"] as const;
export const ORDER_STATUSES = ["new", "confirmed", "in_progress", "ready", "out_for_delivery", "delivered", "cancelled"] as const;

export type Fulfilment = (typeof FULFILMENT)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILMENT_LABEL: Record<Fulfilment, string> = { delivery: "Delivery", pickup: "Collect from the showroom" };
export const PAYMENT_LABEL: Record<PaymentMethod, string> = { on_delivery: "Pay on delivery", bank_transfer: "Bank transfer", at_showroom: "Pay at the showroom" };
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  in_progress: "In production",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Completed",
  cancelled: "Cancelled",
};

/** The statuses before an order is finished. */
export const OPEN_STATUSES = ["new", "confirmed", "in_progress", "ready", "out_for_delivery"] as const;

export const MAX_LINES = 20;
export const MAX_QTY = 99;
