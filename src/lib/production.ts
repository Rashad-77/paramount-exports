import type { Tone } from "@/components/ui/status";

/** Stage vocabulary shared by services and screens. Order matters: it is the normal flow of a job. */
export const JOB_STAGES = ["awaiting_materials", "ready_to_start", "cutting_preparation", "assembly", "sanding_finishing", "quality_check", "ready_for_delivery", "on_hold", "cancelled"] as const;
export type JobStage = (typeof JOB_STAGES)[number];
export const FLOW: JobStage[] = ["awaiting_materials", "ready_to_start", "cutting_preparation", "assembly", "sanding_finishing", "quality_check", "ready_for_delivery"];

export const STAGE_LABEL: Record<JobStage, string> = {
  awaiting_materials: "Awaiting materials",
  ready_to_start: "Ready to start",
  cutting_preparation: "Cutting / preparation",
  assembly: "Assembly",
  sanding_finishing: "Sanding / finishing",
  quality_check: "Quality check",
  ready_for_delivery: "Ready for delivery",
  on_hold: "On hold",
  cancelled: "Cancelled",
};
export const STAGE_TONE: Record<JobStage, Tone> = {
  awaiting_materials: "warning",
  ready_to_start: "neutral",
  cutting_preparation: "info",
  assembly: "info",
  sanding_finishing: "info",
  quality_check: "info",
  ready_for_delivery: "success",
  on_hold: "warning",
  cancelled: "danger",
};

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const PRIORITY_TONE: Record<Priority, Tone> = { low: "neutral", normal: "neutral", high: "warning", urgent: "danger" };

export const ISSUE_TYPES = ["delay", "rework", "issue"] as const;
export const ISSUE_LABEL: Record<(typeof ISSUE_TYPES)[number], string> = { delay: "Delay", rework: "Rework", issue: "Issue" };

/** Position in the normal flow, or -1 for on_hold / cancelled. */
export const flowIndex = (s: JobStage) => FLOW.indexOf(s);
