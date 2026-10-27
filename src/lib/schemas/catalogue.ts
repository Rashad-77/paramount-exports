import { z } from "zod";
import { slugify } from "@/lib/contact";
import { validation } from "@/lib/errors";
import { DIM_UNITS } from "@/lib/specifications";
import { checkbox, enumOf, idList, optEnum, optMoney, optText, optUuid, reqText, reqUuid, slug } from "@/lib/validation";

export const PRODUCT_KINDS = ["stocked", "made_to_order"] as const;
export const WOOD_TREATMENTS = ["treated", "untreated"] as const;
/** A discount is entered as money off or as a percentage off. */
export const DISCOUNT_KINDS = ["amount", "percent"] as const;
/** What staff can choose. The database enum still holds "on_request" from before it was merged into made to order. */
export const AVAILABILITY = ["in_stock", "made_to_order", "sold"] as const;
export const AVAILABILITY_LABEL: Record<(typeof AVAILABILITY)[number] | "on_request", string> = {
  in_stock: "In stock",
  made_to_order: "Made to order",
  on_request: "Made to order",
  sold: "Out of stock",
};

/** Slug may be left blank; it is then derived from the name. */
const slugOrBlank = optText("Web address name", 80);

export const categorySchema = z.object({
  name: reqText("Category name", 80),
  slug: slugOrBlank,
  description: optText("Description", 500),
  parentId: optUuid("group"),
  sortOrder: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number({ error: "Sort order must be a whole number." }).int().min(0).max(9999).optional()),
  /** Not asked for on the forms: a category shows on the website until it is archived. */
  isActive: z.boolean().default(true),
  /** The uploaded picture for a main category's banner (just uploaded; empty when it is not being changed), and where it sits (percent). */
  bannerFileId: optUuid("banner picture"),
  bannerX: z.preprocess((v) => (v === "" || v === undefined ? 50 : Number(v)), z.number().min(0).max(100).transform((n) => Math.round(n))),
  bannerY: z.preprocess((v) => (v === "" || v === undefined ? 50 : Number(v)), z.number().min(0).max(100).transform((n) => Math.round(n))),
  bannerZoom: z.preprocess((v) => (v === "" || v === undefined ? 100 : Number(v)), z.number().min(100).max(300).transform((n) => Math.round(n))),
  /** Take the banner picture away. */
  removeBanner: z.preprocess((v) => v === "1" || v === "on" || v === true, z.boolean()),
});
/** The banner position and removal are optional when a category is made in code (they default to centred and kept). */
type CategoryParsed = z.output<typeof categorySchema>;
export type CategoryInput = Omit<CategoryParsed, "bannerX" | "bannerY" | "bannerZoom" | "removeBanner"> & Partial<Pick<CategoryParsed, "bannerX" | "bannerY" | "bannerZoom" | "removeBanner">>;

/** The Add category pop-up: a main category (optionally with subcategories made at the same time) or a subcategory under a main one. */
export const categoryCreateSchema = categorySchema.safeExtend({
  kind: z.enum(["main", "sub"], { error: "Choose whether this is a main category or a subcategory." }),
  subs: z.preprocess(
    (v) => {
      if (typeof v !== "string" || !v) return [];
      try {
        return JSON.parse(v);
      } catch {
        return [];
      }
    },
    z.array(z.string().trim().min(1).max(80, "A subcategory name must be 80 characters or fewer.")).max(30, "Add up to 30 subcategories at a time.").default([]),
  ),
});
export type CategoryCreateInput = z.output<typeof categoryCreateSchema>;

export const VISIBILITY = ["draft", "published", "archived"] as const;
export const VISIBILITY_LABEL: Record<(typeof VISIBILITY)[number], string> = { draft: "Draft: hidden from the website", published: "Published: shown on the website", archived: "Archived: hidden and kept on record" };
/** A product shows up to five photos: the thumbnail row under the main photo holds five. */
export const MAX_PHOTOS = 5;

const dimPart = z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().regex(/^(\d+(\.\d+)?)?$/, "Enter dimensions as numbers, like 180 or 7.5."));
const specEntrySchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1, "Every specification needs a type.").max(60, "A specification type must be 60 characters or fewer."),
  type: z.enum(["text", "list", "dims"]),
  values: z.array(z.string().trim().max(200, "A specification value must be 200 characters or fewer.")).max(30).default([]),
  dims: z.object({ w: dimPart, d: dimPart, h: dimPart, unit: z.enum(DIM_UNITS).default("cm") }).optional(),
});
/** The specification rows arrive as one JSON field from the specifications editor. */
const specificationsField = z.preprocess(
  (v) => {
    if (v === undefined || v === "") return undefined;
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  },
  z.array(specEntrySchema, { error: "The specifications could not be read. Reload the page and try again." }).max(40, "Add at most 40 specifications.").optional(),
);

/** "id:<existing photo>" or "file:<newly uploaded file>", each with its place in the frame and zoom as "@x,y,zoom" (percent), in the order the photos are shown. */
const photosField = z.preprocess(
  (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v.filter((x) => x !== "") : [v]),
  z.array(z.string().regex(/^(id|file):[0-9a-fA-F-]{36}(@\d{1,3},\d{1,3}(,\d{1,3})?)?$/, "A photo could not be read. Reload the page and try again.")).max(MAX_PHOTOS, `Add up to ${MAX_PHOTOS} photos.`),
);

const optInt = (label: string, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), z.coerce.number({ error: `${label} must be a whole number.` }).int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`).max(max).optional());

const productBase = z.object({
  name: reqText("Product name", 120),
  /** Left out on the form: the web address name is always made from the product name. */
  slug: slugOrBlank,
  categoryId: reqUuid("category"),
  kind: enumOf(PRODUCT_KINDS, "product type"),
  description: optText("Description", 4000),
  shortDescription: optText("Short description", 300),
  specifications: specificationsField,
  /** Older single-value fields, used when no specification list is sent. */
  material: optText("Wood / material", 120),
  finish: optText("Finish", 120),
  dimensions: optText("Dimensions", 200),
  sku: z
    .string()
    .trim()
    .max(60, "SKU must be 60 characters or fewer.")
    .regex(/^[A-Za-z0-9._-]*$/, "Use letters, numbers, dots, hyphens and underscores only.")
    .optional()
    .transform((v) => v || undefined),
  /** The regular price. With a discount, customers see this struck through and the price after the discount. */
  listPrice: optMoney("Price"),
  /** Money off ("amount") or a percentage off ("percent"), with its value. Both blank: no discount. */
  discountKind: optEnum(DISCOUNT_KINDS, "discount type"),
  discountValue: optMoney("Discount"),
  /** How many are in stock; needed when the availability is "In stock". */
  stockQuantity: optInt("Available amount", 1000000),
  /** Draft, published or archived. Present only on the staff form, where it takes the place of the older tick boxes below. */
  visibility: optEnum(VISIBILITY, "visibility"),
  isPublished: checkbox,
  isFeatured: checkbox,
  isPremium: checkbox,
  showAvailability: checkbox,
  availability: optEnum(AVAILABILITY, "availability"),
  showPrice: checkbox,
  photos: photosField,
  seoTitle: optText("Page title", 70),
  seoDescription: optText("Page description", 160),
});

type StaffFormFields = { discountKind?: string; discountValue?: string; visibility?: string; availability?: string; stockQuantity?: number; showAvailability: boolean; showPrice: boolean; listPrice?: string; photos: string[] };
const productRules = (v: StaffFormFields, ctx: z.RefinementCtx) => {
  if (v.discountKind || v.discountValue) {
    if (!v.discountKind) ctx.addIssue({ code: "custom", path: ["discountKind"], message: "Choose whether the discount is an amount or a percentage." });
    else if (!v.discountValue) ctx.addIssue({ code: "custom", path: ["discountValue"], message: v.discountKind === "percent" ? "Enter the percentage." : "Enter the amount." });
    else if (!v.listPrice) ctx.addIssue({ code: "custom", path: ["listPrice"], message: "Enter the price first, then the discount." });
    else if (v.discountKind === "percent" && (Number(v.discountValue) < 1 || Number(v.discountValue) >= 100)) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Enter a percentage from 1 to 99." });
    else if (v.discountKind === "amount" && Number(v.discountValue) >= Number(v.listPrice)) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "The discount must be less than the price." });
  }
  if (v.visibility !== undefined) {
    // The staff form: in stock needs an amount; what is shown publicly follows what was filled in.
    if (v.availability === "in_stock" && v.stockQuantity === undefined) ctx.addIssue({ code: "custom", path: ["stockQuantity"], message: "Enter how many are available." });
    // Customers must never see a product with no picture.
    if (v.visibility === "published" && v.photos.length === 0) ctx.addIssue({ code: "custom", path: ["photos"], message: "A published product needs at least one photo. Add one, or save it as a draft." });
    return;
  }
  if (v.showAvailability && !v.availability) ctx.addIssue({ code: "custom", path: ["availability"], message: "Choose the availability to show, or untick “Show availability”." });
};

/** Every product says what it is made of: the Material specification needs at least one value (checked when the form sends its specifications). */
const materialRule = (v: { specifications?: Array<{ key: string; values: string[] }> }, ctx: z.RefinementCtx) => {
  if (!v.specifications) return;
  const material = v.specifications.find((s) => s.key === "material");
  if (!material || !material.values.some((x) => x.trim())) ctx.addIssue({ code: "custom", path: ["specifications"], message: "Add at least one material (for example Teak)." });
};

export const productSchema = productBase.superRefine((v, ctx) => {
  productRules(v, ctx);
  materialRule(v, ctx);
  // A new product starts with at least one photo.
  if (v.visibility !== undefined && v.photos.length === 0) ctx.addIssue({ code: "custom", path: ["photos"], message: "Add at least one photo of the product." });
  if (v.visibility === undefined && v.showPrice && !v.listPrice) ctx.addIssue({ code: "custom", path: ["listPrice"], message: "Enter a price, or untick “Show price publicly”." });
});
export type ProductInput = z.output<typeof productSchema>;

/** Update from the staff form carries the price and stock of the product's one price line; the older form left prices to the options. */
export const productUpdateSchema = productBase.omit({ sku: true }).superRefine((v, ctx) => {
  productRules(v, ctx);
  materialRule(v, ctx);
});
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;

/** The gallery has two sections, each a set of photographs: the showroom and the workshop. */
export const GALLERY_AREAS = ["showroom", "workshop"] as const;
export type GalleryArea = (typeof GALLERY_AREAS)[number];
export const GALLERY_AREA_LABEL: Record<GalleryArea, string> = { showroom: "Showroom photos", workshop: "Workshop photos" };
/** Photographs in one section. */
export const MAX_GALLERY_PHOTOS = 30;
export const galleryAddSchema = z.object({
  area: z.enum(GALLERY_AREAS),
  fileIds: idList(10),
});

export const resolveSlug = (explicit: string | undefined, name: string): string => {
  const candidate = explicit && explicit.length > 0 ? explicit : slugify(name);
  const r = slug.safeParse(candidate);
  if (!r.success) {
    const message = r.error.issues[0]?.message ?? "Enter a valid web address name.";
    throw validation(message, { slug: [message] });
  }
  return r.data;
};
