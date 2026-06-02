-- Phase 25 migration: add county_id self-referential FK to treasury.municipalities
-- Establishes county-city relational model: cities reference their parent county municipality row.
-- ON DELETE SET NULL: deleting a county row nulls city county_id values (does not cascade-delete cities).
-- Safe to run multiple times: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

ALTER TABLE treasury.municipalities
  ADD COLUMN IF NOT EXISTS county_id UUID
  REFERENCES treasury.municipalities(id)
  ON DELETE SET NULL;

-- Partial index for county page queries (SELECT * WHERE county_id = <county_uuid>)
CREATE INDEX IF NOT EXISTS idx_municipalities_county_id
  ON treasury.municipalities(county_id)
  WHERE county_id IS NOT NULL;
