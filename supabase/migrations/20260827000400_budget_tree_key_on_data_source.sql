-- treasury_sync_budget_tree: key the budget row on ITS OWN data source.
--
-- The defect
-- ──────────
-- The row lookup was:
--
--   WHERE municipality_id = … AND fiscal_year = … AND dataset_type = …
--     AND period_label IS NOT DISTINCT FROM …
--
-- Nothing about WHICH SOURCE the figures came from. So the first Socrata sync of a
-- city that already holds a row for the same (municipality, fiscal_year,
-- dataset_type) finds THAT row, deletes its categories and line items, and
-- overwrites its total — and because the function never updates `data_source` on
-- the existing-row path, the row goes on claiming the old publisher's name while
-- holding the new publisher's money.
--
-- Every California city in the database has CA State Controller rows for
-- FY2003-2024. Measured against the enabled Socrata budget sources, five are armed
-- with this today — each has zero rows of its own and N SCO rows it would take over
-- on its first successful sync:
--
--   Los Angeles Operating Budget                     16 SCO rows
--   West Hollywood Budget Expenditure Detail         10
--   West Hollywood Budget Revenue Detail             10
--   LA Open Budget Appropriations                     8
--   West Hollywood Budget Expenditure Detail FY15-18  6
--   West Hollywood Budget Revenue Detail FY15-18      6
--   Berkeley Operating Budget                         4
--
-- It has not fired yet only because those sources have never completed a sync, and
-- because Dallas's and San Francisco's Socrata years (FY2025-26) happen to sit past
-- the last SCO year. West Hollywood is where it would have fired first: its budget
-- book covers FY2013-2020, entirely inside the SCO range.
--
-- ⚠ This is the same family as treasury_sync_city_budget keying on
-- (muni, fy, dataset, fund_scope, basis) and never updating data_source — see
-- project_sync_city_budget_not_source_safe. A key that omits the source does not
-- fail; it silently relabels.
--
-- The fix
-- ───────
-- Add `data_source = v_ds.name` to the lookup.
--
-- ⚠ NOT via `data_source_id`, which is the obvious-looking move and is wrong:
-- treasury.budgets.data_source_id is a foreign key to treasury.SOURCE_REGISTRY, a
-- different table from treasury.data_sources, and writing a data_sources id into it
-- fails on budgets_data_source_id_fkey. (scripts/bulkLoadBudget.js already makes this
-- mistake in its pre-load `DELETE ... eq('data_source_id', ds.id)`, which therefore
-- matches nothing and silently deletes nothing — harmless only because the RPC clears
-- the categories itself.) The source's NAME is what identifies its row.
--
-- Why this is a no-op for everything already loading: a source that has synced
-- before wrote `data_source = v_ds.name` on its own INSERT, so it still matches its
-- own row. Verified against production — Dallas Operating/Revenue and San Francisco
-- Operating/Revenue each match 2 rows by name and 0 by the old looser key.
--
-- Two figures for one year from two publishers are not a conflict to be resolved by
-- overwriting. West Hollywood's own budget book reports FY2019 spending of
-- $197.6M against the State Controller's $149.4M, because the book counts $33.5M of
-- "Other Financing Uses" — interfund transfers — plus a different capital and debt
-- treatment. Both are real published numbers; they answer different questions, they
-- carry different fund scopes, and they belong in different rows.
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

  -- ⚠ data_source is part of the key. Without it this hijacks another publisher's row.
  -- ORDER BY id, not created_at: created_at is NULL on 87,845 of the 87,864 rows in
  -- treasury.budgets, so ordering by it would fall back to planner order for almost
  -- everything. This only decides which row wins if a duplicate pair ever exists; the
  -- point is that the answer is stable between runs rather than arbitrary.
  SELECT id INTO v_budget_id FROM treasury.budgets
  WHERE municipality_id = v_ds.municipality_id AND fiscal_year = p_fiscal_year
    AND dataset_type = p_dataset_type
    AND period_label IS NOT DISTINCT FROM p_period_label
    AND data_source = v_ds.name
  ORDER BY id
  LIMIT 1;

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

  -- COALESCE on basis, so a caller that says nothing about it cannot silently reset a
  -- value some other load established.
  UPDATE treasury.budgets
     SET total_budget = p_total,
         basis = COALESCE(p_basis, basis)
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
