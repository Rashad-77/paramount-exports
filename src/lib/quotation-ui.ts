/** Plain labels for quotations. No server-only imports, so pages, forms and the staff screens can all use them. */

export const QUOTE_STATUSES = ["requested", "quoted", "accepted", "declined", "cancelled"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** What the customer reads. */
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  requested: "Received",
  quoted: "Price ready",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Closed",
};

/** What each status means, in one line, for the customer. */
export const QUOTE_STATUS_HELP: Record<QuoteStatus, string> = {
  requested: "We have your request and are working out the price. We will contact you.",
  quoted: "Our price is ready. Please read it and accept or decline.",
  accepted: "You accepted this quotation. We will confirm your order with you.",
  declined: "You declined this quotation.",
  cancelled: "We have closed this request. Contact us if you would like to talk about it.",
};

export const QUOTE_TONE: Record<QuoteStatus, "info" | "success" | "warning" | "neutral"> = {
  requested: "info",
  quoted: "warning",
  accepted: "success",
  declined: "neutral",
  cancelled: "neutral",
};

/** How the details of a made-to-measure request are named. */
export const QUOTE_DETAIL_LABELS: Record<string, string> = {
  furnitureType: "What you would like made",
  dimensions: "Dimensions",
  material: "Wood or material",
  finish: "Finish",
  budgetRange: "Budget",
  targetDate: "Wanted by",
};

export const isQuoteStatus = (v: unknown): v is QuoteStatus => typeof v === "string" && (QUOTE_STATUSES as readonly string[]).includes(v);
