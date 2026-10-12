-- Hand-written companion to 0000: things the Drizzle schema cannot express.
-- Statements are separated by statement-breakpoint markers because the migrator runs them one by one.

-- 1. Staff profiles are tied to Supabase Auth identities. (On a plain Postgres test database an `auth.users`
--    stub is created by the test harness; on Supabase the real table exists.)
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fk" FOREIGN KEY ("id") REFERENCES auth.users ("id") ON DELETE RESTRICT;
--> statement-breakpoint

-- 2. updated_at maintenance
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON "profiles" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER locations_set_updated_at BEFORE UPDATE ON "locations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER site_settings_set_updated_at BEFORE UPDATE ON "site_settings" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- 3. Immutability: audit history can be appended to, never edited or removed.
--    Reused by inventory_movements and other ledgers in later migrations.
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

-- 4. Human-readable, collision-safe document references (sequence-backed; gaps are possible, duplicates are not).
CREATE SEQUENCE seq_quotation START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_order START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_job START 1;
--> statement-breakpoint
CREATE SEQUENCE seq_purchase_order START 1;
--> statement-breakpoint
CREATE FUNCTION next_reference(kind text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF kind = 'quotation' THEN
    RETURN 'QUO-' || lpad(nextval('seq_quotation')::text, 6, '0');
  ELSIF kind = 'order' THEN
    RETURN 'SO-' || lpad(nextval('seq_order')::text, 6, '0');
  ELSIF kind = 'job' THEN
    RETURN 'JOB-' || lpad(nextval('seq_job')::text, 6, '0');
  ELSIF kind = 'purchase_order' THEN
    RETURN 'PO-' || lpad(nextval('seq_purchase_order')::text, 6, '0');
  END IF;
  RAISE EXCEPTION 'Unknown reference kind: %', kind USING ERRCODE = 'invalid_parameter_value';
END;
$$;
--> statement-breakpoint

-- 5. Row Level Security: deny-all for Supabase's API roles. The application connects with a privileged
--    server-side role and enforces permissions in its service layer. Every future table MUST repeat this
--    (a test fails if any public table lacks RLS).
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "uploaded_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Belt and braces: also remove table privileges from the API roles (they exist on Supabase).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint

-- 6. Baseline reference data (configuration, not demo data): one showroom and one workshop, editable in the app.
INSERT INTO "locations" ("name", "kind") VALUES ('Showroom', 'showroom'), ('Workshop', 'workshop')
ON CONFLICT ("name") DO NOTHING;
