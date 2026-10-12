import { sql } from "drizzle-orm";
import { check, date, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./foundation";
import { products, productVariants } from "./catalogue";

export const leadSource = pgEnum("lead_source", ["website", "whatsapp", "phone", "showroom", "referral", "social_media", "other"]);
export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "requirements_confirmed",
  "quotation_sent",
  "negotiation",
  "won",
  "lost",
]);
export const leadKind = pgEnum("lead_kind", ["general", "product_enquiry", "custom"]);
export const contactMethod = pgEnum("contact_method", ["phone", "whatsapp", "email"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    company: text("company"),
    phone: text("phone").notNull(),
    /** Normalised phone used for duplicate warnings (see lib/contact.ts). Not unique: duplicates are warned about, not blocked. */
    phoneKey: text("phone_key").notNull(),
    email: text("email"),
    emailLower: text("email_lower"),
    address: text("address"),
    preferredContact: contactMethod("preferred_contact"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    index("customers_phone_key_idx").on(t.phoneKey),
    index("customers_email_lower_idx").on(t.emailLower),
    index("customers_name_idx").on(t.name),
  ],
);

/** Enquiry / sales opportunity. Holds its own contact snapshot; public enquiries never create customers automatically. */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    kind: leadKind("kind").notNull().default("general"),
    source: leadSource("source").notNull().default("website"),
    status: leadStatus("status").notNull().default("new"),
    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "restrict" }),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactPhoneKey: text("contact_phone_key").notNull(),
    contactEmail: text("contact_email"),
    contactEmailLower: text("contact_email_lower"),
    preferredContact: contactMethod("preferred_contact"),
    message: text("message"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    /** Custom-furniture details exactly as submitted (type, dimensions, material, finish, budget, target date). */
    payload: jsonb("payload"),
    /** Set when an existing customer matches the phone/email. Staff decide whether to link — never merged automatically. */
    possibleDuplicateCustomerId: uuid("possible_duplicate_customer_id").references(() => customers.id, { onDelete: "set null" }),
    nextFollowUpOn: date("next_follow_up_on"),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    index("leads_status_idx").on(t.status),
    index("leads_assigned_idx").on(t.assignedTo),
    index("leads_customer_idx").on(t.customerId),
    index("leads_created_idx").on(t.createdAt),
    index("leads_phone_key_idx").on(t.contactPhoneKey),
    check("leads_lost_needs_reason", sql`${t.status} <> 'lost' OR ${t.lostReason} IS NOT NULL`),
  ],
);
