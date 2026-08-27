-- treasury_log_sync_failure: give pre-RPC sync failures somewhere to land.
--
-- ⚠⚠ THE DEFECT THIS FIXES
--
-- Every sync_logs row is written INSIDE treasury_sync_budget_tree /
-- treasury_sync_salary_tree / treasury_sync_transactions. So anything that fails
-- BEFORE the RPC is reached leaves no trace anywhere:
--
--   * the Socrata fetch 4xx/5xx or times out
--   * the zero-total abort added in PR #83 (which fires deliberately, and often)
--   * treasury_get_data_source_config returns nothing
--   * the column_mapping is in the wrong dialect, so the tree builds empty
--
-- In every one of those cases sync_logs gains no row, data_sources.last_error
-- stays NULL, sync_status stays 'idle', and last_synced_at keeps its old value.
-- The source looks HEALTHY and merely old. San Francisco sat like that from
-- 2026-05-23 to 2026-08-27 and nothing anywhere said so.
--
-- ⚠ A failure logger that can itself fail is worse than none, because it turns a
-- loud failure back into a silent one. Two hazards, both handled below:
--
--   1. sync_logs.triggered_by is CHECK-constrained to a fixed vocabulary. An
--      edge function passing 'post-deploy-probe' would violate it and the INSERT
--      would throw — inside the error path. Unknown values are normalised.
--   2. Anything else going wrong is swallowed: this function never raises, it
--      returns a jsonb describing what it managed to do.
--
-- 'empty' is added to the status vocabulary. A fetch that returns zero rows is
-- neither success nor error — it means the fiscal-year filter matched nothing,
-- which is usually a mapping bug — and it deserves an honest name rather than
-- being recorded as a success or not recorded at all.

ALTER TABLE treasury.sync_logs DROP CONSTRAINT IF EXISTS sync_logs_status_check;
ALTER TABLE treasury.sync_logs ADD CONSTRAINT sync_logs_status_check
  CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text,
                             'error'::text, 'empty'::text]));

CREATE OR REPLACE FUNCTION public.treasury_log_sync_failure(
  p_data_source_id uuid,
  p_fiscal_year    integer DEFAULT NULL,
  p_error          text    DEFAULT NULL,
  p_stage          text    DEFAULT NULL,
  p_rows_fetched   integer DEFAULT 0,
  p_triggered_by   text    DEFAULT 'manual',
  p_status         text    DEFAULT 'error'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $function$
DECLARE
  v_triggered_by text;
  v_status       text;
  v_log_id       uuid;
BEGIN
  -- Normalise against the CHECK vocabularies rather than trusting the caller;
  -- a constraint violation here would re-hide the very failure being reported.
  v_triggered_by := CASE
    WHEN p_triggered_by IN ('scheduler','manual','webhook','backfill',
                            'bulk_load','cursor_resume','cron','debug')
      THEN p_triggered_by
    ELSE 'manual'
  END;
  v_status := CASE WHEN p_status IN ('error','empty') THEN p_status ELSE 'error' END;

  INSERT INTO treasury.sync_logs (
    data_source_id, started_at, completed_at, duration_ms, status,
    rows_fetched, rows_inserted, error_message, error_details,
    sync_params, triggered_by
  ) VALUES (
    p_data_source_id, clock_timestamp(), clock_timestamp(), 0, v_status,
    COALESCE(p_rows_fetched, 0), 0,
    left(COALESCE(p_error, 'unspecified failure before the sync RPC was reached'), 4000),
    jsonb_build_object('stage', COALESCE(p_stage, 'pre_rpc'),
                       'reported_by', 'treasury_log_sync_failure',
                       'raw_triggered_by', p_triggered_by),
    jsonb_build_object('fiscal_year', p_fiscal_year),
    v_triggered_by
  )
  RETURNING id INTO v_log_id;

  -- Only a genuine error marks the source unhealthy. An empty fetch is recorded
  -- but must not flip sync_status, or every legitimately-empty year would page
  -- somebody. last_synced_at is deliberately NOT advanced in either case: nothing
  -- was synced.
  IF v_status = 'error' THEN
    UPDATE treasury.data_sources
       SET sync_status = 'error',
           last_error  = left(COALESCE(p_error, 'failure before the sync RPC'), 4000)
     WHERE id = p_data_source_id;
  END IF;

  RETURN jsonb_build_object('logged', true, 'sync_log_id', v_log_id, 'status', v_status);
EXCEPTION WHEN OTHERS THEN
  -- Never raise out of the error path.
  RETURN jsonb_build_object('logged', false, 'reason', SQLERRM);
END;
$function$;

COMMENT ON FUNCTION public.treasury_log_sync_failure(uuid, integer, text, text, integer, text, text) IS
  'Record a sync failure that happened BEFORE one of the treasury_sync_* RPCs was '
  'reached, so it appears in sync_logs and data_sources.last_error instead of '
  'leaving the source looking idle and healthy. Normalises triggered_by/status '
  'against their CHECK vocabularies and never raises.';

GRANT EXECUTE ON FUNCTION public.treasury_log_sync_failure(uuid, integer, text, text, integer, text, text)
  TO anon, authenticated, service_role;
