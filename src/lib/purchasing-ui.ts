import type { Tone } from "@/components/ui/status";

export type PoStatusValue = "draft" | "sent" | "partially_received" | "received" | "cancelled";
export const PO_STATUSES: PoStatusValue[] = ["draft", "sent", "partially_received", "received", "cancelled"];
export const PO_STATUS_LABEL: Record<PoStatusValue, string> = { draft: "Draft", sent: "Sent to supplier", partially_received: "Partly received", received: "Received", cancelled: "Cancelled" };
export const PO_STATUS_TONE: Record<PoStatusValue, Tone> = { draft: "neutral", sent: "info", partially_received: "warning", received: "success", cancelled: "danger" };
export const SUPPLIER_PAY_LABEL = { unpaid: "Unpaid", part_paid: "Part paid", paid: "Paid", n_a: "—" } as const;
export const SUPPLIER_PAY_TONE: Record<keyof typeof SUPPLIER_PAY_LABEL, Tone> = { unpaid: "warning", part_paid: "warning", paid: "success", n_a: "neutral" };
