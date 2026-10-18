-- Specification types and values the staff have created, kept for every later product.
CREATE TABLE "spec_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "value_type" text DEFAULT 'text' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "spec_types_key_unique" UNIQUE ("key"),
  CONSTRAINT "spec_types_value_type_known" CHECK ("value_type" IN ('text', 'list'))
);--> statement-breakpoint
CREATE TABLE "spec_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type_key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "spec_values_type_value_idx" ON "spec_values" ("type_key", lower("value"));--> statement-breakpoint
-- The own types already used on products become saved types too.
INSERT INTO "spec_types" ("key", "label", "value_type")
SELECT DISTINCT ON (k) k, lbl, vt FROM (
  SELECT 'custom-' || trim(both '-' from regexp_replace(lower(e->>'label'), '[^a-z0-9]+', '-', 'g')) AS k, e->>'label' AS lbl, CASE WHEN e->>'type' = 'list' THEN 'list' ELSE 'text' END AS vt
  FROM "products", jsonb_array_elements("specifications") AS e
  WHERE e->>'key' LIKE 'custom-%'
) t WHERE k <> 'custom-' AND lower(lbl) NOT IN ('material', 'finish', 'colour', 'wood treatment', 'grade', 'frame material', 'top material', 'upholstery', 'glass', 'hardware and fittings', 'dimensions', 'thickness', 'length', 'width', 'diameter', 'seat height', 'weight', 'load capacity', 'seating capacity', 'drawers', 'shelves', 'number of doors', 'opening style', 'mounting', 'shape', 'style', 'suitable for', 'origin', 'assembly', 'customisation', 'warranty', 'packaging')
ON CONFLICT ("key") DO NOTHING;
