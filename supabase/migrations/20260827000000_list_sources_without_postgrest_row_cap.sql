-- treasury_list_sources: an enumerator that cannot be silently truncated.
--
-- ⚠⚠ THE DEFECT THIS FIXES
--
-- treasury_list_source_ids() returns every enabled source — 1,811 rows today.
-- PostgREST caps a response at db-max-rows = 1000, so EVERY caller that reaches
-- it over HTTP (the treasury-sync-orchestrator edge function, bulkLoadBudget.js,
-- ~25 seeder verification blocks) silently receives only the first 1,000.
--
-- The function orders by `priority DESC, name`, so the cut is ALPHABETICAL. It
-- lands at "Norwell — MA General Fund Expenditures". Everything sorting after
-- that — San Francisco, San Diego, Sacramento, Seattle, Portland, Oakland,
-- Tacoma, Tucson, West Hollywood — is invisible to the sync orchestrator and has
-- therefore NEVER been synced by cron. San Francisco's last successful load was
-- 2026-05-23, by hand, and its data_sources row still reads
-- sync_status = 'idle', last_error = NULL: a failure that looks exactly like
-- health, because the source was never enumerated to begin with.
--
-- scripts/seedOHState.js diagnosed this cap correctly and worked around it in
-- that one file ("Ohio entries (starting with 'O') exceed the cutoff"). The
-- class was never fixed. This is the class fix.
--
-- The cap cannot be raised from SQL, and a Range header can only narrow a
-- PostgREST response, never widen it past db-max-rows. So the fix is to let
-- callers filter SERVER-side and receive a set that fits: there are ~15 socrata
-- budget sources against 1,811 total.
--
-- New name, not a new overload: adding parameters to treasury_list_source_ids
-- would ship a PGRST203 ambiguous-overload error to every existing caller.
-- treasury_list_source_ids is left exactly as it is.

CREATE OR REPLACE FUNCTION public.treasury_list_sources(
  p_api_type      text   DEFAULT NULL,
  p_dataset_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id                      uuid,
  name                    text,
  api_type                text,
  dataset_type            text,
  sync_frequency          text,
  last_synced_at          timestamptz,
  sync_status             text,
  fiscal_years            integer[],
  is_enabled              boolean,
  fiscal_year_start_month bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT ds.id, ds.name, ds.api_type, ds.dataset_type, ds.sync_frequency,
         ds.last_synced_at, ds.sync_status, ds.fiscal_years,
         -- explicit cast: data_sources.fiscal_year_start_month is `integer`, and a
         -- plpgsql RETURNS TABLE mismatch fails at CALL time, not CREATE time
         ds.is_enabled, ds.fiscal_year_start_month::bigint
  FROM treasury.data_sources ds
  WHERE ds.is_enabled = true
    AND ds.sync_status <> 'running'
    AND (p_api_type IS NULL OR ds.api_type = p_api_type)
    AND (p_dataset_types IS NULL OR ds.dataset_type = ANY (p_dataset_types))
  ORDER BY ds.priority DESC, ds.name;
END;
$function$;

COMMENT ON FUNCTION public.treasury_list_sources(text, text[]) IS
  'Enumerate enabled, not-running data sources, filtered server-side by api_type '
  'and/or dataset_type. Prefer this over treasury_list_source_ids for any caller '
  'that needs a COMPLETE set: the unfiltered listing exceeds PostgREST''s '
  '1000-row db-max-rows cap and is silently truncated alphabetically. '
  'Callers should still treat a result of exactly 1000 rows as suspect.';

GRANT EXECUTE ON FUNCTION public.treasury_list_sources(text, text[]) TO anon, authenticated, service_role;
