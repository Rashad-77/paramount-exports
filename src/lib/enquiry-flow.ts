import type { FlowStepView } from "@/components/app/flow-panel";

/** The two stages of an enquiry or a quotation request: received, then responded. */
export function enquirySteps(e: { createdAt: Date; handledAt: Date | null; isHandled: boolean }, received = "Enquiry received"): FlowStepView[] {
  return [
    { key: "received", label: received, at: e.createdAt, state: "done" },
    { key: "responded", label: "Responded", at: e.handledAt, state: e.isHandled ? "done" : "current" },
  ];
}

export const enquiryNextStep = (isHandled: boolean) => (isHandled ? "This enquiry has been answered. Nothing more to do." : "Reply to the customer by phone or email, then press “Mark as responded”.");
