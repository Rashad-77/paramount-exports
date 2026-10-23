-- The gallery is now two sections, showroom photos and workshop photos, and nothing else: no projects. The photos get their own table; the
-- project tables go (no project was ever published on the live website).
CREATE TABLE gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  file_id uuid NOT NULL REFERENCES uploaded_files (id) ON DELETE RESTRICT,
  alt_text text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_photos_area_known CHECK (area IN ('showroom', 'workshop')),
  CONSTRAINT gallery_photos_file_key UNIQUE (file_id)
);
--> statement-breakpoint
CREATE INDEX gallery_photos_area_idx ON gallery_photos (area, position);
--> statement-breakpoint
DROP TABLE gallery_images;
--> statement-breakpoint
DROP TABLE gallery_projects;
--> statement-breakpoint
SELECT enforce_rls();
