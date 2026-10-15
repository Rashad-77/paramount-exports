import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Customer accounts (optional: guests can still order). `id` equals the sign-in identity's id (Supabase `auth.users.id`).
 * These people are NOT staff: staff access comes only from `profiles` + `user_roles`, so an account grants nothing in /app.
 */
export const customerAccounts = pgTable(
  "customer_accounts",
  {
    id: uuid("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    emailLower: text("email_lower").notNull().unique(),
    phone: text("phone"),
    /** Normalised phone (see lib/contact.ts); links the account to orders placed before it existed. */
    phoneKey: text("phone_key"),
    /** Default delivery address, offered at checkout. */
    address: text("address"),
    /** Development-only sign-in (scrypt hash). Always null when real sign-in (Supabase) is used. */
    localPasswordHash: text("local_password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_accounts_phone_key_idx").on(t.phoneKey), check("customer_accounts_name_not_blank", sql`length(btrim(${t.fullName})) > 0`)],
);

/** The basket of a signed-in customer, so it follows them from phone to laptop. Ids and quantities only; prices are always read fresh. */
export const customerCarts = pgTable("customer_carts", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => customerAccounts.id, { onDelete: "cascade" }),
  items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
