import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** Step 1 foundation tables. See docs/DATA_MODEL.md. */

export const appRole = pgEnum("app_role", ["owner", "manager", "sales", "workshop", "finance"]);
export const locationKind = pgEnum("location_kind", ["showroom", "workshop", "warehouse"]);
export const fileVisibility = pgEnum("file_visibility", ["public", "private"]);
export const fileStatus = pgEnum("file_status", ["quarantined", "linked", "purged"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** One row per staff member. `id` equals `auth.users.id` (FK added in a custom migration). */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    role: appRole("role").notNull(),
    grantedBy: uuid("granted_by").references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_roles_user_role_key").on(t.userId, t.role), index("user_roles_user_idx").on(t.userId)],
);

/** Append-only (enforced by trigger). `actorId` is not an FK so history survives user archival. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: locationKind("kind").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique("locations_name_key").on(t.name)],
);

export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    visibility: fileVisibility("visibility").notNull().default("private"),
    status: fileStatus("status").notNull().default("quarantined"),
    uploadedBy: uuid("uploaded_by"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uploaded_files_object_key").on(t.bucket, t.objectKey),
    index("uploaded_files_entity_idx").on(t.entityType, t.entityId),
    check("uploaded_files_size_positive", sql`${t.sizeBytes} > 0`),
  ],
);

/** Fixed-window counters for public form throttling. `keyHash` is a salted hash, never a raw IP. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    keyHash: text("key_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.keyHash, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);
