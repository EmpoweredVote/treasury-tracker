-- treasury_sync_budget_tree: let a caller state the BASIS of the figures it is writing.
--
-- Why
-- ───
-- treasury.budgets.basis ('actual' | 'adopted' | 'unknown') is what the reader sees:
-- src/components/ScopeLabel.tsx renders it as a chip, and src/utils/spendVerb.ts turns
-- it into "spent" versus "budgeted". treasury_sync_city_budget has taken p_basis since
-- SCOPE-02, but treasury_sync_budget_tree — the RPC every Socrata loader and the
-- treasury-sync edge function use — never did, so all 24 Socrata budget sources land
-- on the column default 'unknown'.
--
-- That was tolerable while every Socrata feed was an adopted budget. West Hollywood
-- publishes WIDE-FORMAT datasets with a column per year, and the columns are not all
-- the same kind of money: `_2017_actuals`, `_2018_actuals` and `_2019_actuals` are
-- closed-year outturn sitting immediately beside `_2020_approved`, an adopted budget.
-- Loading those years without a basis would put an actual and a budget on one line in
-- the chart with nothing to tell them apart — the -75% Long Beach cliff that opened
-- SCOPE-02.
--
-- Contract
-- ────────
--   p_basis NULL      → leave the basis alone. New rows take the column default
--                       ('unknown'); existing rows keep whatever they hold. Every
--                       caller that does not pass it is unaffected.
--   p_basis 'actual'  → these figures are what was actually spent or received.
--   p_basis 'adopted' → these figures are the plan approved before the year began.
--
-- ⚠ DROP-then-CREATE, not CREATE OR REPLACE. Adding a parameter changes the arity, and
-- PostgREST resolves overloads by argument names: leaving the 8-argument version in
-- place next to this 9-argument one makes every call ambiguous and returns PGRST203.
DROP FUNCTION IF EXISTS public.treasury_sync_budget_tree(
  uuid, integer, text, numeric, jsonb, integer, text, text);

CREATE OR REPLACE FUNCTION public.treasury_sync_budget_tree(
  p_data_source_id uuid,
  p_fiscal_year integer,
  p_dataset_type text,
  p_total numeric,
  p_tree jsonb,
  p_row_count integer,
  p_triggered_by text DEFAULT 'manual'::text,
  p_period_label text DEFAULT NULL::text,
  p_basis text DEFAULT NULL::text
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
  v_basis text;
BEGIN
  SELECT * INTO v_ds FROM treasury.data_sources WHERE id = p_data_source_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Data source not found'); END IF;

  INSERT INTO treasury.sync_logs (data_source_id, status, triggered_by, sync_params)
  VALUES (p_data_source_id, 'running', p_triggered_by, jsonb_build_object('fiscal_year', p_fiscal_year))
  RETURNING id INTO v_sync_log_id;
  UPDATE treasury.data_sources SET sync_status = 'running' WHERE id = p_data_source_id;

  -- Fail with a sentence rather than a raw CHECK violation, and BEFORE the destructive
  -- category delete below so a bad call cannot wipe good data.
  --
  -- ⚠ RAISE, not RETURN. Returning an error object here would skip the EXCEPTION block,
  -- leaving the sync_logs row stuck at 'running' and data_sources reading idle with
  -- last_error NULL — the invisible-failure shape PR #86 existed to remove.
  IF p_basis IS NOT NULL AND p_basis NOT IN ('actual', 'adopted', 'unknown') THEN
    RAISE EXCEPTION
      'Invalid p_basis %: treasury.budgets.basis accepts actual, adopted or unknown. '
      'A figure that is neither an actual nor an adopted budget — a proposal never '
      'adopted — should not be loaded as either.', quote_literal(p_basis);
  END IF;

  SELECT id INTO v_budget_id FROM treasury.budgets
  WHERE municipality_id = v_ds.municipality_id AND fiscal_year = p_fiscal_year
    AND dataset_type = p_dataset_type
    AND period_label IS NOT DISTINCT FROM p_period_label;

  IF v_budget_id IS NOT NULL THEN
    DELETE FROM treasury.budget_line_items WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);
    DELETE FROM treasury.budget_categories WHERE budget_id = v_budget_id;
  ELSE
    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget, data_source,
      hierarchy, fiscal_year_start_month, period_label, basis)
    VALUES (v_ds.municipality_id, p_fiscal_year, p_dataset_type, p_total, v_ds.name,
      ARRAY(SELECT jsonb_array_elements_text(v_ds.column_mapping->'hierarchy_columns')), v_ds.fiscal_year_start_month, p_period_label,
      COALESCE(p_basis, 'unknown'))
    RETURNING id INTO v_budget_id;
  END IF;

  PERFORM _treasury_insert_tree(v_budget_id, p_tree, NULL, 0, p_total, 0);

  SELECT COUNT(*) INTO v_inserted FROM treasury.budget_line_items
  WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);

  -- COALESCE, so a caller that says nothing about basis cannot silently reset a value
  -- some other load established.
  UPDATE treasury.budgets SET total_budget = p_total, basis = COALESCE(p_basis, basis)
  WHERE id = v_budget_id
  RETURNING basis INTO v_basis;

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
    'total_budget', p_total, 'basis', v_basis,
    'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_ts)) * 1000
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
