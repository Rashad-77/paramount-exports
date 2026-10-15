import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, check, index, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid, date } from "drizzle-orm/pg-core";
import { profiles, uploadedFiles } from "./foundation";

export const productKind = pgEnum("product_kind", ["stocked", "made_to_order"]);
export const availabilityStatus = pgEnum("availability_status", ["in_stock", "made_to_order", "on_request", "sold"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    /** The group this category sits under (two levels: a group, then its categories). Empty for a group. */
    parentId: uuid("parent_id").references((): AnyPgColumn => productCategories.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("product_categories_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`), index("product_categories_parent_idx").on(t.parentId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "restrict" }),
    kind: productKind("kind").notNull().default("stocked"),
    material: text("material"),
    finish: text("finish"),
    /** Free-text dimensions as shown to customers, e.g. "W 180 × D 90 × H 75 cm". */
    dimensions: text("dimensions"),
    isPublished: boolean("is_published").notNull().default(false),
    /** Shown in the homepage "featured" section. */
    isFeatured: boolean("is_featured").notNull().default(false),
    /** Availability is only shown publicly when the business has approved it for this product. */
    showAvailability: boolean("show_availability").notNull().default(false),
    availability: availabilityStatus("availability"),
    /** Prices are only shown publicly when explicitly enabled. */
    showPrice: boolean("show_price").notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_published_idx").on(t.isPublished),
    check("products_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    sku: text("sku").notNull().unique(),
    label: text("label").notNull().default("Standard"),
    listPrice: numeric("list_price", { precision: 14, scale: 2 }),
    /** Reduced price while the option is on sale; always below the list price. */
    salePrice: numeric("sale_price", { precision: 14, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("product_variants_product_idx").on(t.productId), check("product_variants_price_nonneg", sql`${t.listPrice} IS NULL OR ${t.listPrice} >= 0`),
    check("product_variants_sale_below_list", sql`${t.salePrice} IS NULL OR (${t.listPrice} IS NOT NULL AND ${t.salePrice} >= 0 AND ${t.salePrice} < ${t.listPrice})`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => uploadedFiles.id, { onDelete: "restrict" }),
    altText: text("alt_text").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_images_product_idx").on(t.productId), unique("product_images_file_key").on(t.fileId)],
);

export const galleryProjects = pgTable("gallery_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  completedOn: date("completed_on"),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  /** The kind of furniture this project shows, so the Gallery can be filtered like the Collection. */
  categoryId: uuid("category_id").references(() => productCategories.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => galleryProjects.id, { onDelete: "restrict" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => uploadedFiles.id, { onDelete: "restrict" }),
    altText: text("alt_text").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gallery_images_project_idx").on(t.projectId), unique("gallery_images_file_key").on(t.fileId)],
);
