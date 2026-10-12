import type { Tone } from "@/components/ui/status";

export const DELIVERY_TONE: Record<"planned" | "out_for_delivery" | "delivered" | "failed", Tone> = { planned: "neutral", out_for_delivery: "info", delivered: "success", failed: "danger" };
export const CASE_TONE: Record<"open" | "in_progress" | "resolved" | "closed", Tone> = { open: "warning", in_progress: "info", resolved: "success", closed: "neutral" };
/** "10:00:00" → "10:00" */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
export const windowLabel = (a: string | null, b: string | null) => (a && b ? `${hhmm(a)}–${hhmm(b)}` : "Any time");
