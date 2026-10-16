/** Plain labels for quotations. No server-only imports, so pages, forms and the staff screens can all use them. */

export const QUOTE_STATUSES = ["requested", "under_review", "quoted", "accepted", "declined", "cancelled"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** How the details of a made-to-measure request are named. */
export const QUOTE_DETAIL_LABELS: Record<string, string> = {
  furnitureType: "What you would like made",
  dimensions: "Dimensions",
  material: "Wood or material",
  finish: "Finish",
  budgetRange: "Budget",
  targetDate: "Wanted by",
};

/** Staff see only two stages: New (nobody has answered yet) and Responded (everything after that). */
export const STAFF_QUOTE_LABEL: Record<QuoteStatus, string> = {
  requested: "New",
  under_review: "Responded",
  quoted: "Responded",
  accepted: "Responded",
  declined: "Responded",
  cancelled: "Responded",
};

export const isQuoteStatus = (v: unknown): v is QuoteStatus => typeof v === "string" && (QUOTE_STATUSES as readonly string[]).includes(v);
