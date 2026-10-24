import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { products } from "./catalogue";

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
    /** The picture Google supplies on a Google sign-in (an uploaded picture takes priority; see server/avatars.ts). */
    avatarUrl: text("avatar_url"),
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

/** Products a customer has saved to come back to. */
export const customerWishlist = pgTable(
  "customer_wishlist",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.productId] })],
);

/** Delivery addresses a customer has saved. At most one is the default (offered first at checkout). */
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipient: text("recipient").notNull(),
    phone: text("phone"),
    address: text("address").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customer_addresses_account_idx").on(t.accountId),
    uniqueIndex("customer_addresses_one_default").on(t.accountId).where(sql`${t.isDefault}`),
    check("customer_addresses_not_blank", sql`length(btrim(${t.address})) > 0 AND length(btrim(${t.label})) > 0`),
  ],
);

/** Things the customer should hear about: a quotation was priced, an order moved on. Shown on the dashboard. */
export const customerUpdates = pgTable(
  "customer_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_updates_account_idx").on(t.accountId, t.createdAt)],
);
