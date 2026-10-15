import type { Tone } from "@/components/ui/status";
import type { OrderStatus } from "@/lib/order-constants";

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = { new: "info", confirmed: "neutral", in_progress: "warning", delivered: "success", cancelled: "danger" };

/** What each button that moves an order forward says. */
export const NEXT_STATUS_ACTION: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  in_progress: "Start preparing",
  delivered: "Mark as delivered",
};

export const MESSAGE_KIND_LABEL: Record<string, string> = { general: "Message", product_enquiry: "Product enquiry", custom: "Custom furniture request" };
