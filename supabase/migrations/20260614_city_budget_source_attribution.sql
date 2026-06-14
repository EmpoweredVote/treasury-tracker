-- Phase 52-01 — City-budget source attribution primitive
--
-- Goal: let the city-budget write path persist a durable source URL and a fetch
-- date, so every figure the hardened SoCal pipeline loads meets the same
-- always-sourced bar as federal (v2.2 CONTEXT D-02..D-04).
--
-- Design note (deviation from the plan's literal text, approved 2026-06-14):
-- the plan named treasury.data_sources.base_url / last_synced_at, but
-- treasury.budgets.data_source_id FKs to source_registry (NOT data_sources) and
-- the RPC never touches data_sources, so that target is unreachable and unread by
-- the UI. Instead we mirror the established federal always-sourced pattern
-- (treasury.operating_budgets / revenue_budgets carry source_url + source_date):
-- add the same two columns to treasury.budgets and write them from the RPC.
--
-- Backward compatibility: columns are nullable (default NULL) so all existing
-- rows are untouched; the two new RPC params are trailing + DEFAULT NULL so every
-- existing 7-arg caller is byte-for-byte unaffected; attribution is written with
-- COALESCE so a NULL param never clobbers an existing value.

-- 1) Additive sourcing columns on the city/tree budget table.
ALTER TABLE treasury.budgets
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_date date;

COMMENT ON COLUMN treasury.budgets.source_url IS 'Durable URL to the source dataset/record (e.g. the ByTheNumbers dataset page). REQUIRED on rows loaded by the hardened pipeline (v2.0 always-sourced standard); nullable for legacy municipal rows.';
COMMENT ON COLUMN treasury.budgets.source_date IS 'Date the source data was fetched. REQUIRED on rows loaded by the hardened pipeline; nullable for legacy rows.';

-- 2) Extend the shared city-budget writer with optional, trailing source params.
--    Body is the live definition (pg_get_functiondef) edited in place: only the
--    signature gains two trailing params and the final UPDATE gains two COALESCE
--    assignments. Everything else is unchanged.
--
--    NOTE: adding params changes the arity, so CREATE OR REPLACE does NOT replace
--    the prior 7-arg function — it creates a second overload. Two overloads make
--    a 7-named-arg PostgREST call ambiguous (PGRST203), which would break the
--    existing bulkLoadStateController.js caller. Drop the old 7-arg overload so
--    the 9-arg version (which covers all old call shapes via its DEFAULTs) is the
--    single definition.
DROP FUNCTION IF EXISTS public.treasury_sync_city_budget(uuid, integer, text, numeric, jsonb, integer, text);

CREATE OR REPLACE FUNCTION public.treasury_sync_city_budget(
  p_municipality_id uuid,
  p_fiscal_year integer,
  p_dataset_type text,
  p_total numeric,
  p_tree jsonb,
  p_row_count integer,
  p_data_source_name text DEFAULT 'CA State Controller'::text,
  p_source_url text DEFAULT NULL,
  p_source_date date DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'treasury', 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_budget_id uuid;
  v_inserted int := 0;
BEGIN
  -- Get or create budget
  SELECT id INTO v_budget_id FROM treasury.budgets
  WHERE municipality_id = p_municipality_id AND fiscal_year = p_fiscal_year AND dataset_type = p_dataset_type;

  IF v_budget_id IS NOT NULL THEN
    DELETE FROM treasury.budget_line_items WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);
    DELETE FROM treasury.budget_categories WHERE budget_id = v_budget_id;
  ELSE
    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget, data_source, fiscal_year_start_month)
    VALUES (p_municipality_id, p_fiscal_year, p_dataset_type, p_total, p_data_source_name, 7)
    RETURNING id INTO v_budget_id;
  END IF;

  -- Insert tree using existing helper
  PERFORM _treasury_insert_tree(v_budget_id, p_tree, NULL, 0, p_total, 0);

  -- Count inserted
  SELECT COUNT(*) INTO v_inserted FROM treasury.budget_line_items
  WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);

  -- Update total + durable source attribution. COALESCE so a NULL param never
  -- overwrites an existing value (existing callers stay no-ops on the new columns).
  UPDATE treasury.budgets
     SET total_budget = p_total,
         source_url   = COALESCE(p_source_url, source_url),
         source_date  = COALESCE(p_source_date, source_date)
   WHERE id = v_budget_id;

  RETURN jsonb_build_object(
    'status', 'success', 'budget_id', v_budget_id,
    'rows_inserted', v_inserted, 'total_budget', p_total
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$function$;
