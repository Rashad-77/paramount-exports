import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customerAccounts } from "./accounts";

export const REVIEW_STATUSES = ["approved", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** A review written on the website. It shows on the homepage straight away (status "approved") until staff hide it. Its photographs are in uploaded_files (entity_type "review"). */
export const customerReviews = pgTable(
  "customer_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: text("city"),
    stars: integer("stars").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<ReviewStatus>().notNull().default("approved"),
    accountId: uuid("account_id").references(() => customerAccounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customer_reviews_status_idx").on(t.status, t.createdAt),
    check("customer_reviews_stars_range", sql`${t.stars} BETWEEN 1 AND 5`),
    check("customer_reviews_status_known", sql`${t.status} IN ('approved', 'hidden')`),
  ],
);
