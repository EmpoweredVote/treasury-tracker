-- Phase 3: Postgres RPC function for atomic GiveButter donation writes
-- Apply via: Supabase SQL editor or MCP
-- Safe to re-run (CREATE OR REPLACE)

CREATE OR REPLACE FUNCTION treasury.record_givebutter_donation(
  p_external_id       TEXT,
  p_leaf_category_id  UUID,
  p_parent_category_id UUID,
  p_budget_id         UUID,
  p_description       TEXT,
  p_amount            NUMERIC,
  p_date              DATE,
  p_vendor            TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Idempotency check: if already processed, return silently
  IF EXISTS (
    SELECT 1 FROM treasury.budget_line_items
    WHERE external_id = p_external_id
      AND source = 'givebutter_webhook'
  ) THEN
    RETURN;
  END IF;

  -- 1. INSERT line item
  INSERT INTO treasury.budget_line_items
    (category_id, description, approved_amount, actual_amount,
     vendor, date, external_id, source)
  VALUES
    (p_leaf_category_id, p_description, p_amount, p_amount,
     p_vendor, p_date, p_external_id, 'givebutter_webhook');

  -- 2. UPDATE leaf category (Give Butter, depth=1)
  UPDATE treasury.budget_categories
  SET amount = amount + p_amount
  WHERE id = p_leaf_category_id;

  -- 3. UPDATE parent category (Donations, depth=0)
  UPDATE treasury.budget_categories
  SET amount = amount + p_amount
  WHERE id = p_parent_category_id;

  -- 4. UPDATE budget total
  UPDATE treasury.budgets
  SET total_budget = total_budget + p_amount
  WHERE id = p_budget_id;
END;
$$;

-- DRY-RUN TEST (wraps in rollback — safe to run in SQL editor)
-- Replace the UUIDs below with real values from your DB before running
-- Step 1: Find real UUIDs:
--   SELECT b.id AS budget_id, bc.name, bc.id AS category_id, bc.depth
--   FROM treasury.budgets b
--   JOIN treasury.budget_categories bc ON bc.budget_id = b.id
--   WHERE b.dataset_type = 'revenue'
--     AND bc.name IN ('Donations', 'Give Butter')
--   ORDER BY b.fiscal_year DESC, bc.depth;
--
-- Step 2: Replace UUIDs below and run:
--
-- BEGIN;
-- SELECT treasury.record_givebutter_donation(
--   'test-external-id-dry-run',
--   '00000000-0000-0000-0000-000000000001'::uuid,  -- Give Butter category id
--   '00000000-0000-0000-0000-000000000002'::uuid,  -- Donations category id
--   '00000000-0000-0000-0000-000000000003'::uuid,  -- revenue budget id
--   'Test donation — dry run',
--   1.00,
--   CURRENT_DATE,
--   'GiveButter'
-- );
-- SELECT id, description, actual_amount, source, external_id
-- FROM treasury.budget_line_items
-- WHERE external_id = 'test-external-id-dry-run';
-- ROLLBACK;
