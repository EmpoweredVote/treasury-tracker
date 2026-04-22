-- Phase 3 schema migration: webhook deduplication columns
-- Apply via: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (IF NOT EXISTS guards)

ALTER TABLE treasury.budget_line_items
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'csv';

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_items_external_id_source
  ON treasury.budget_line_items (external_id, source)
  WHERE external_id IS NOT NULL;

-- Verify migration applied correctly
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'treasury'
  AND table_name = 'budget_line_items'
  AND column_name IN ('external_id', 'source')
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'treasury'
  AND tablename = 'budget_line_items'
  AND indexname = 'idx_line_items_external_id_source';
