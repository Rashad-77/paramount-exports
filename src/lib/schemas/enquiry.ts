import { z } from "zod";
import { HONEYPOT_FIELD } from "@/lib/form-guard";
import { DIMENSION_UNIT_VALUES } from "@/lib/enquiry-form-labels";
import { enumOf, idList, optDate, optEmail, optEnum, optText, optUuid, reqPhone, reqText } from "@/lib/validation";

export const ENQUIRY_KINDS = ["general", "product_enquiry", "custom"] as const;
export const CONTACT_METHODS = ["phone", "whatsapp", "email"] as const;

/** One schema for the three public forms (contact, product enquiry, custom furniture). */
export const enquirySchema = z
  .object({
    kind: enumOf(ENQUIRY_KINDS, "enquiry type"),
    name: reqText("Your name", 120),
    phone: reqPhone,
    email: optEmail,
    preferredContact: optEnum(CONTACT_METHODS, "contact method"),
    message: optText("Message", 2000),
    productId: optUuid("product"),
    variantId: optUuid("product option"),
    // Custom furniture details
    furnitureType: optText("Furniture type", 120),
    dimensions: optText("Dimensions", 200),
    dimensionUnit: optEnum(DIMENSION_UNIT_VALUES, "unit"),
    material: optText("Wood or material", 120),
    finish: optText("Finish", 120),
    budgetRange: optText("Budget range", 80),
    targetDate: optDate,
    fileIds: idList(5),
    // Anti-spam fields (not stored)
    [HONEYPOT_FIELD]: z.string().optional(),
    formToken: z.string().optional(),
    "cf-turnstile-response": z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "general" && (v.message?.length ?? 0) < 10) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Please tell us a little about what you need (at least 10 characters)." });
    }
    if (v.kind === "custom" && !v.furnitureType) {
      ctx.addIssue({ code: "custom", path: ["furnitureType"], message: "Tell us what you would like made, e.g. dining table." });
    }
    if (v.kind === "product_enquiry" && !v.productId) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "This enquiry is missing its product. Please open the product page and try again." });
    }
    if (v.targetDate && v.targetDate < new Date(Date.now() - 36 * 3600_000).toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Choose a date that is today or later." });
    }
    if (v.preferredContact === "email" && !v.email) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Add your email address, or choose a different contact method." });
    }
  });

export type EnquiryInput = z.output<typeof enquirySchema>;
