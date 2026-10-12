import type { Tone } from "@/components/ui/status";

export const LEAD_STATUSES = ["new", "contacted", "requirements_confirmed", "quotation_sent", "negotiation", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  requirements_confirmed: "Requirements confirmed",
  quotation_sent: "Quotation sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, Tone> = {
  new: "info",
  contacted: "neutral",
  requirements_confirmed: "neutral",
  quotation_sent: "neutral",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

export const OPEN_LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "requirements_confirmed", "quotation_sent", "negotiation"];

export const LEAD_SOURCES = ["website", "whatsapp", "phone", "showroom", "referral", "social_media", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  phone: "Phone",
  showroom: "Showroom visit",
  referral: "Referral",
  social_media: "Social media",
  other: "Other",
};

export const LEAD_KIND_LABEL: Record<string, string> = { general: "General enquiry", product_enquiry: "Product enquiry", custom: "Custom furniture" };
