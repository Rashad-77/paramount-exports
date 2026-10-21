import { z } from "zod";
import { optText, reqText } from "@/lib/validation";

const blankToNull = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema.nullable());

export const businessFormSchema = z.object({
  name: reqText("Business name", 120),
  tagline: blankToNull(z.string().trim().max(200, "Keep the tagline under 200 characters.")),
  email: blankToNull(z.email("Enter a valid email address.")),
  phone: blankToNull(z.string().trim().max(40)),
  phoneAlt: blankToNull(z.string().trim().max(40)),
  whatsapp: blankToNull(z.string().trim().max(40)),
  address: blankToNull(z.string().trim().max(400)),
  mapUrl: blankToNull(z.url("Enter a full web address starting with https://").refine((u) => u.startsWith("https://"), "The map link must start with https://")),
  notifyEmail: blankToNull(z.email("Enter a valid email address.")),
  tiktok: blankToNull(z.url("Enter a full web address starting with https://").refine((u) => u.startsWith("https://"), "The TikTok link must start with https://")),
  facebook: blankToNull(z.url("Enter a full web address starting with https://").refine((u) => u.startsWith("https://"), "The Facebook link must start with https://")),
  googlePlaceId: blankToNull(z.string().trim().regex(/^[A-Za-z0-9_-]{10,200}$/, "A Place ID is letters and numbers only, like ChIJ… (10 characters or more).")),
  googleReviewUrl: blankToNull(z.url("Enter a full web address starting with https://").refine((u) => u.startsWith("https://"), "The review link must start with https://")),
  openingHours: blankToNull(z.string().trim().max(600)),
  bankDetails: blankToNull(z.string().trim().max(600, "Keep the bank details under 600 characters.")),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. LKR."),
  timezone: reqText("Timezone", 60),
  phoneCountryCode: z.preprocess((v) => (typeof v === "string" ? v.trim().replace(/^\+/, "") : v), z.string().regex(/^\d{1,3}$/, "Digits only, e.g. +94.")),
});

export const pagesFormSchema = z.object({
  about: blankToNull(z.string().max(8000, "Keep this under 8,000 characters.")),
  privacy: blankToNull(z.string().max(12000, "Keep this under 12,000 characters.")),
  terms: blankToNull(z.string().max(12000, "Keep this under 12,000 characters.")),
  ownerName: blankToNull(z.string().trim().max(120, "Keep the name under 120 characters.")),
  ownerRole: blankToNull(z.string().trim().max(120, "Keep the role under 120 characters.")),
  ownerBio: blankToNull(z.string().max(1500, "Keep this under 1,500 characters.")),
});

export { optText };
