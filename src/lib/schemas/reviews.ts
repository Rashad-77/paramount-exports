import { z } from "zod";
import { HONEYPOT_FIELD } from "@/lib/form-guard";
import { idList, reqText } from "@/lib/validation";

/** The Review pop-up on the website. Name and city are shown beside the review, so both are required. */
export const reviewSchema = z.object({
  stars: z.coerce.number({ error: "Choose how many stars." }).int().min(1, "Choose how many stars.").max(5, "Choose how many stars."),
  body: reqText("Your review", 1000),
  name: reqText("Your name", 80),
  city: reqText("Your city", 80),
  fileIds: idList(5),
  // Anti-spam fields (not stored)
  [HONEYPOT_FIELD]: z.string().optional(),
  formToken: z.string().optional(),
});

export type ReviewInput = z.output<typeof reviewSchema>;
