import { z } from "zod";
import { slugify } from "@/lib/contact";
import { validation } from "@/lib/errors";
import { checkbox, enumOf, idList, optEnum, optMoney, optText, optUuid, reqText, reqUuid, slug } from "@/lib/validation";

export const PRODUCT_KINDS = ["stocked", "made_to_order"] as const;
export const AVAILABILITY = ["in_stock", "made_to_order", "on_request", "sold"] as const;
export const AVAILABILITY_LABEL: Record<(typeof AVAILABILITY)[number], string> = {
  in_stock: "In stock",
  made_to_order: "Made to order",
  on_request: "Available on request",
  sold: "Sold",
};

/** Slug may be left blank; it is then derived from the name. */
const slugOrBlank = optText("Web address name", 80);

export const categorySchema = z.object({
  name: reqText("Category name", 80),
  slug: slugOrBlank,
  description: optText("Description", 500),
  parentId: optUuid("group"),
  sortOrder: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number({ error: "Sort order must be a whole number." }).int().min(0).max(9999)),
  isActive: checkbox,
});
export type CategoryInput = z.output<typeof categorySchema>;

const productBase = z.object({
  name: reqText("Product name", 120),
  slug: slugOrBlank,
  categoryId: reqUuid("category"),
  kind: enumOf(PRODUCT_KINDS, "product type"),
  description: optText("Description", 4000),
  material: optText("Wood / material", 120),
  finish: optText("Finish", 120),
  dimensions: optText("Dimensions", 200),
  sku: z
    .string({ error: "SKU is required." })
    .trim()
    .min(1, "SKU is required.")
    .max(60, "SKU must be 60 characters or fewer.")
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, hyphens and underscores only."),
  listPrice: optMoney("Price"),
  isPublished: checkbox,
  isFeatured: checkbox,
  showAvailability: checkbox,
  availability: optEnum(AVAILABILITY, "availability"),
  showPrice: checkbox,
  seoTitle: optText("Page title", 70),
  seoDescription: optText("Page description", 160),
});

type AvailabilityFields = { showAvailability: boolean; availability?: string };
const availabilityRule = (v: AvailabilityFields, ctx: z.RefinementCtx) => {
  if (v.showAvailability && !v.availability) ctx.addIssue({ code: "custom", path: ["availability"], message: "Choose the availability to show, or untick “Show availability”." });
};

/** Create: also takes the first SKU and price (stored on the default "Standard" option). */
export const productSchema = productBase.superRefine((v, ctx) => {
  availabilityRule(v, ctx);
  if (v.showPrice && !v.listPrice) ctx.addIssue({ code: "custom", path: ["listPrice"], message: "Enter a price, or untick “Show price publicly”." });
});
export type ProductInput = z.output<typeof productSchema>;

/** Update: SKU and prices live on the options (variants), so they are not part of this form. */
export const productUpdateSchema = productBase.omit({ sku: true, listPrice: true }).superRefine(availabilityRule);
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;

export const variantBase = z.object({
  sku: z.string({ error: "SKU is required." }).trim().min(1, "SKU is required.").max(60).regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, hyphens and underscores only."),
  label: reqText("Option name", 80),
  listPrice: optMoney("Price"),
  salePrice: optMoney("Sale price"),
  isActive: checkbox,
});
/** A sale price needs a normal price and must be lower than it. Apply with `.superRefine` after any `.extend`. */
export const variantRules = (v: { listPrice?: string; salePrice?: string }, ctx: z.RefinementCtx) => {
  if (!v.salePrice) return;
  if (!v.listPrice) ctx.addIssue({ code: "custom", path: ["listPrice"], message: "Enter the normal price too, or clear the sale price." });
  else if (Number(v.salePrice) >= Number(v.listPrice)) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "The sale price must be lower than the normal price." });
};
export const variantSchema = variantBase.superRefine(variantRules);
export type VariantInput = z.output<typeof variantSchema>;

export const imagesSchema = z.object({
  fileIds: idList(10),
  altText: reqText("Image description", 200),
});

export const galleryProjectSchema = z.object({
  title: reqText("Project title", 120),
  description: optText("Description", 2000),
  completedOn: z.preprocess((v) => (v === "" ? undefined : v), z.iso.date("Enter a valid date.").optional()),
  isPublished: checkbox,
  sortOrder: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().int().min(0).max(9999)),
  categoryId: optUuid("category"),
});
export type GalleryProjectInput = z.output<typeof galleryProjectSchema>;

export const resolveSlug = (explicit: string | undefined, name: string): string => {
  const candidate = explicit && explicit.length > 0 ? explicit : slugify(name);
  const r = slug.safeParse(candidate);
  if (!r.success) {
    const message = r.error.issues[0]?.message ?? "Enter a valid web address name.";
    throw validation(message, { slug: [message] });
  }
  return r.data;
};
