-- One uniform list of specifications per product (type, value rows), and a separate choice of thumbnail photo.
ALTER TABLE "products" ADD COLUMN "specifications" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "thumbnail_image_id" uuid;--> statement-breakpoint
-- Carry what is already entered over into the new list, so nothing on the website goes missing.
UPDATE "products" p SET "specifications" = COALESCE((
  SELECT jsonb_agg(s.e ORDER BY s.ord)
  FROM (
    SELECT 10 AS ord, jsonb_build_object('key', 'material', 'label', 'Material', 'type', 'list', 'values', to_jsonb(string_to_array(p.material, ', '))) AS e WHERE coalesce(trim(p.material), '') <> ''
    UNION ALL SELECT 20, jsonb_build_object('key', 'treatment', 'label', 'Wood treatment', 'type', 'list', 'values', jsonb_build_array(CASE p.wood_treatment WHEN 'treated' THEN 'Treated' ELSE 'Untreated' END)) WHERE p.wood_treatment IS NOT NULL
    UNION ALL SELECT 30, jsonb_build_object('key', 'finish', 'label', 'Finish', 'type', 'list', 'values', to_jsonb(string_to_array(p.finish, ', '))) WHERE coalesce(trim(p.finish), '') <> ''
    UNION ALL SELECT 40, jsonb_build_object('key', 'colour', 'label', 'Colour', 'type', 'list', 'values', to_jsonb(string_to_array(p.colour, ', '))) WHERE coalesce(trim(p.colour), '') <> ''
    UNION ALL SELECT 50, jsonb_build_object('key', 'dimensions', 'label', 'Dimensions', 'type', 'dims', 'values', jsonb_build_array(trim(p.dimensions))) WHERE coalesce(trim(p.dimensions), '') <> ''
    UNION ALL SELECT 100 + t.n, jsonb_build_object('key', 'custom-' || t.n, 'label', trim(split_part(t.line, ':', 1)), 'type', 'text', 'values', jsonb_build_array(trim(substr(t.line, position(':' in t.line) + 1))))
      FROM unnest(regexp_split_to_array(coalesce(p.other_specs, ''), E'\\r?\\n')) WITH ORDINALITY AS t(line, n)
      WHERE position(':' in t.line) > 1 AND trim(substr(t.line, position(':' in t.line) + 1)) <> ''
    UNION ALL SELECT 200, jsonb_build_object('key', 'features', 'label', 'Features', 'type', 'list', 'values', (SELECT jsonb_agg(trim(regexp_replace(l, '^[-•*]\s*', ''))) FROM unnest(regexp_split_to_array(p.features, E'\\r?\\n')) AS l WHERE trim(l) <> '')) WHERE coalesce(trim(p.features), '') <> ''
    UNION ALL SELECT 210, jsonb_build_object('key', 'uses', 'label', 'Uses', 'type', 'list', 'values', (SELECT jsonb_agg(trim(regexp_replace(l, '^[-•*]\s*', ''))) FROM unnest(regexp_split_to_array(p.uses, E'\\r?\\n')) AS l WHERE trim(l) <> '')) WHERE coalesce(trim(p.uses), '') <> ''
    UNION ALL SELECT 220, jsonb_build_object('key', 'care', 'label', 'Care instructions', 'type', 'text', 'values', jsonb_build_array(trim(p.care_instructions))) WHERE coalesce(trim(p.care_instructions), '') <> ''
    UNION ALL SELECT 230, jsonb_build_object('key', 'lead-time', 'label', 'Lead time', 'type', 'text', 'values', jsonb_build_array(trim(p.lead_time))) WHERE coalesce(trim(p.lead_time), '') <> ''
  ) s
), '[]'::jsonb);
