-- Built-in suggestions (Teak, Oak…) the staff have removed or renamed, so they stop being offered.
CREATE TABLE "spec_hidden_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type_key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "spec_hidden_values_type_value_idx" ON "spec_hidden_values" ("type_key", lower("value"));
