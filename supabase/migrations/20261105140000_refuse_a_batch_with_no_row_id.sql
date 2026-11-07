-- Refuse a batch whose declared row id arrived empty.
--
-- ⚠⚠⚠ WHY THIS LIVES IN THE DATABASE AND NOT ONLY IN THE LOADERS.
--
-- `source_row_id_column` moved to Socrata's `:id` (see
-- 20261105120000_socrata_row_id_is_not_a_batch_number.sql). A system field is
-- ONLY returned when explicitly selected with `$select=:*,*` -- so any caller
-- that has not been updated reads `r[':id']` as undefined, sends rid NULL, and
-- because `idx_transactions_source_dedup` is a PARTIAL index
-- (WHERE source_row_id IS NOT NULL) the ON CONFLICT clause then matches
-- nothing at all. Every row inserts again. The dataset DOUBLES.
--
-- That is not hypothetical: `supabase/functions/treasury-sync` is deployed by
-- hand, there is no CI path for it, and the version running when this shipped
-- predates the `$select` fix. The nine affected sources were disabled to close
-- that window, but a disabled source is a reminder someone has to act on, and
-- this is the invariant stated where it cannot be forgotten.
--
-- ⭐ The direction matters. Losing rows is what started all of this and it was
-- SILENT for months; duplicating them would be just as silent, because
-- `treasury_sync_transactions` recomputes `budgets.total_budget` from whatever
-- is in the table, so the headline would simply double and still tie.
--
-- ⚠ The function's own EXCEPTION WHEN OTHERS turns this RAISE into
-- sync_status = 'error' plus last_error, with the transaction rolled back. The
-- sync fails loudly and nothing is written -- which is the entire point.
--
-- ⚠ Scoped to sources that DECLARE a row id. The XLSX loaders key on a row
-- hash and do not set `source_row_id_column`, so they are unaffected.
--
-- Only the guard is new; the rest of the body is unchanged.

CREATE OR REPLACE FUNCTION public.treasury_sync_transactions(
  p_data_source_id uuid, p_fiscal_year integer, p_vendors jsonb,
  p_transactions jsonb, p_row_count integer, p_triggered_by text DEFAULT 'manual'::text)
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
  v_skipped int := 0;
  v_vendor_count int := 0;
  v_total numeric := 0;
BEGIN
  SELECT * INTO v_ds FROM treasury.data_sources WHERE id = p_data_source_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Data source not found'); END IF;

  INSERT INTO treasury.sync_logs (data_source_id, status, triggered_by, sync_params)
  VALUES (p_data_source_id, 'running', p_triggered_by, jsonb_build_object('fiscal_year', p_fiscal_year))
  RETURNING id INTO v_sync_log_id;
  UPDATE treasury.data_sources SET sync_status = 'running' WHERE id = p_data_source_id;

  -- ⚠⚠⚠ THE GUARD. A declared row id that arrives NULL on EVERY row means the
  -- caller could not read the column -- not that the publisher omitted it.
  IF v_ds.column_mapping->>'source_row_id_column' IS NOT NULL
     AND p_row_count > 0
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_transactions) t
        WHERE t->>'rid' IS NOT NULL AND t->>'rid' <> '')
  THEN
    RAISE EXCEPTION
      'Refusing % FY%: the source declares source_row_id_column %, but all % row(s) in this batch arrived with no row id. Inserting them would bypass ON CONFLICT entirely (the dedup index is partial on source_row_id IS NOT NULL) and duplicate the dataset. Update the caller -- Socrata system fields are only returned with $select=:*,*.',
      v_ds.name, p_fiscal_year, v_ds.column_mapping->>'source_row_id_column', p_row_count;
  END IF;

  SELECT id INTO v_budget_id FROM treasury.budgets
  WHERE municipality_id = v_ds.municipality_id AND fiscal_year = p_fiscal_year AND dataset_type = v_ds.dataset_type;
  IF v_budget_id IS NULL THEN
    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget, data_source, hierarchy, fiscal_year_start_month)
    VALUES (v_ds.municipality_id, p_fiscal_year, v_ds.dataset_type, 0, v_ds.name, ARRAY['department','vendor'], v_ds.fiscal_year_start_month)
    RETURNING id INTO v_budget_id;
  END IF;

  -- Upsert vendors
  INSERT INTO treasury.vendors (name, municipality_id)
  SELECT v->>'n', v_ds.municipality_id FROM jsonb_array_elements(p_vendors) v
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_vendor_count = ROW_COUNT;

  -- Insert transactions with dedup via source_row_id
  INSERT INTO treasury.transactions (budget_id, vendor_id, amount, description, payment_date, payment_method,
    invoice_number, fund, expense_category, department, program, link_key, source_row_id)
  SELECT v_budget_id,
    (SELECT id FROM treasury.vendors WHERE name = t->>'vn' AND municipality_id = v_ds.municipality_id LIMIT 1),
    (t->>'a')::numeric, t->>'d',
    CASE WHEN t->>'dt' IS NOT NULL AND t->>'dt' != '' THEN (t->>'dt')::date ELSE NULL END,
    t->>'pm', t->>'inv', t->>'f', t->>'ec', t->>'dept', t->>'prog', t->>'lk',
    t->>'rid'
  FROM jsonb_array_elements(p_transactions) t
  ON CONFLICT (budget_id, source_row_id) WHERE source_row_id IS NOT NULL
  DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  v_skipped := p_row_count - v_inserted;

  SELECT COALESCE(SUM(amount), 0) INTO v_total FROM treasury.transactions WHERE budget_id = v_budget_id;
  UPDATE treasury.budgets SET total_budget = v_total WHERE id = v_budget_id;

  UPDATE treasury.sync_logs SET
    completed_at = clock_timestamp(), duration_ms = EXTRACT(EPOCH FROM (clock_timestamp() - v_start_ts)) * 1000,
    status = 'success', rows_fetched = p_row_count, rows_inserted = v_inserted, rows_skipped = v_skipped
  WHERE id = v_sync_log_id;
  UPDATE treasury.data_sources SET
    sync_status = 'idle', last_synced_at = now(), last_error = NULL, rows_synced = rows_synced + v_inserted
  WHERE id = p_data_source_id;

  RETURN jsonb_build_object(
    'status', 'success', 'budget_id', v_budget_id,
    'rows_fetched', p_row_count, 'rows_inserted', v_inserted, 'rows_skipped', v_skipped,
    'vendors_added', v_vendor_count, 'total_budget', v_total,
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

-- ⚠⚠ SECURITY DEFINER functions are granted to PUBLIC on creation. CREATE OR
-- REPLACE re-applies that default, so the revoke must be repeated every time
-- the body changes. See the definer-function-public-execute memo.
REVOKE EXECUTE ON FUNCTION public.treasury_sync_transactions(uuid, integer, jsonb, jsonb, integer, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.treasury_sync_transactions(uuid, integer, jsonb, jsonb, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.treasury_sync_transactions(uuid, integer, jsonb, jsonb, integer, text) FROM authenticated;
