-- Phase 49-01: Transition Quarter storage primitive.
--
-- The FY1976 Transition Quarter (Jul–Sep 1976) must be stored as a distinct,
-- selectable period without breaking the one-row-per-(entity, year, lens) invariant.
-- budgets.fiscal_year is integer and the unique index forbids a second 1976 row per
-- lens, so we add a nullable period_label discriminator, widen the unique index with
-- NULLS NOT DISTINCT (preserves the dedup guarantee for normal NULL-label rows), and
-- add an optional p_period_label arg to treasury_sync_budget_tree.
--
-- Backward-compatible: every existing budgets row keeps period_label = NULL and every
-- existing 7-argument RPC caller resolves to the new function via the DEFAULT NULL arg.

-- 1) Discriminator column ------------------------------------------------------------
ALTER TABLE treasury.budgets ADD COLUMN IF NOT EXISTS period_label text;
COMMENT ON COLUMN treasury.budgets.period_label IS
  'Non-null only for sub-annual / special periods (e.g. the FY1976 Transition Quarter). NULL for normal fiscal years.';

-- 2) Widen the unique index to include period_label (NULLS NOT DISTINCT so two
--    NULL-label rows still collide — the original guarantee — while a labeled TQ row
--    can coexist with the NULL-label FY1976 row). --------------------------------------
DROP INDEX IF EXISTS treasury.idx_budget_municipality_year_type;
CREATE UNIQUE INDEX idx_budget_municipality_year_type
  ON treasury.budgets (municipality_id, fiscal_year, dataset_type, period_label)
  NULLS NOT DISTINCT;

-- 3) Add optional p_period_label to the shared tree-sync RPC. The original 7-arg
--    function is dropped and re-created with an 8th DEFAULT NULL arg so there is no
--    overload ambiguity for existing 7-arg calls. ------------------------------------
DROP FUNCTION IF EXISTS public.treasury_sync_budget_tree(uuid, integer, text, numeric, jsonb, integer, text);

CREATE OR REPLACE FUNCTION public.treasury_sync_budget_tree(
  p_data_source_id uuid,
  p_fiscal_year integer,
  p_dataset_type text,
  p_total numeric,
  p_tree jsonb,
  p_row_count integer,
  p_triggered_by text DEFAULT 'manual'::text,
  p_period_label text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'treasury', 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_ds treasury.data_sources%ROWTYPE;
  v_budget_id uuid;
  v_sync_log_id uuid;
  v_start_ts timestamptz := clock_timestamp();
  v_inserted int := 0;
BEGIN
  SELECT * INTO v_ds FROM treasury.data_sources WHERE id = p_data_source_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Data source not found'); END IF;

  INSERT INTO treasury.sync_logs (data_source_id, status, triggered_by, sync_params)
  VALUES (p_data_source_id, 'running', p_triggered_by, jsonb_build_object('fiscal_year', p_fiscal_year))
  RETURNING id INTO v_sync_log_id;
  UPDATE treasury.data_sources SET sync_status = 'running' WHERE id = p_data_source_id;

  -- Period match includes period_label so a labeled TQ budget is independent of the
  -- NULL-label FY1976 budget (IS NOT DISTINCT FROM treats NULL = NULL).
  SELECT id INTO v_budget_id FROM treasury.budgets
  WHERE municipality_id = v_ds.municipality_id AND fiscal_year = p_fiscal_year
    AND dataset_type = p_dataset_type
    AND period_label IS NOT DISTINCT FROM p_period_label;

  IF v_budget_id IS NOT NULL THEN
    DELETE FROM treasury.budget_line_items WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);
    DELETE FROM treasury.budget_categories WHERE budget_id = v_budget_id;
  ELSE
    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget, data_source,
      hierarchy, fiscal_year_start_month, period_label)
    VALUES (v_ds.municipality_id, p_fiscal_year, p_dataset_type, p_total, v_ds.name,
      ARRAY(SELECT jsonb_array_elements_text(v_ds.column_mapping->'hierarchy_columns')), v_ds.fiscal_year_start_month, p_period_label)
    RETURNING id INTO v_budget_id;
  END IF;

  -- Insert the tree recursively
  PERFORM _treasury_insert_tree(v_budget_id, p_tree, NULL, 0, p_total, 0);

  -- Count inserted line items
  SELECT COUNT(*) INTO v_inserted FROM treasury.budget_line_items
  WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);

  UPDATE treasury.budgets SET total_budget = p_total WHERE id = v_budget_id;

  UPDATE treasury.sync_logs SET
    completed_at = clock_timestamp(), duration_ms = EXTRACT(EPOCH FROM (clock_timestamp() - v_start_ts)) * 1000,
    status = 'success', rows_fetched = p_row_count, rows_inserted = v_inserted
  WHERE id = v_sync_log_id;
  UPDATE treasury.data_sources SET
    sync_status = 'idle', last_synced_at = now(), last_error = NULL, rows_synced = rows_synced + v_inserted
  WHERE id = p_data_source_id;

  RETURN jsonb_build_object(
    'status', 'success', 'budget_id', v_budget_id,
    'rows_fetched', p_row_count, 'rows_inserted', v_inserted,
    'total_budget', p_total, 'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_ts)) * 1000
  );
EXCEPTION WHEN OTHERS THEN
  IF v_sync_log_id IS NOT NULL THEN
    UPDATE treasury.sync_logs SET completed_at = clock_timestamp(),
      duration_ms = EXTRACT(EPOCH FROM (clock_timestamp() - v_start_ts)) * 1000,
      status = 'error', error_message = SQLERRM WHERE id = v_sync_log_id;
  END IF;
  UPDATE treasury.data_sources SET sync_status = 'error', last_error = SQLERRM WHERE id = p_data_source_id;
  RETURN jsonb_build_object('error', SQLERRM, 'rows_fetched', p_row_count);
END;
$function$;
