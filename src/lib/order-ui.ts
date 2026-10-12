import type { Tone } from "@/components/ui/status";
import type { OrderStatusValue } from "@/lib/schemas/orders";

export const ORDER_TONE: Record<OrderStatusValue, Tone> = { draft: "neutral", confirmed: "info", preparing: "warning", ready: "info", delivered: "success", cancelled: "danger" };
