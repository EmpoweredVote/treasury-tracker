-- SCOPE-02 Task 4 — the RPC's lookup key was narrower than the unique index,
-- and Task 9 makes the index wider still.
--
-- Before: WHERE municipality_id AND fiscal_year AND dataset_type
--   -> with two rows per city-year, SELECT ... INTO takes an arbitrary one and
--      overwrites its tree while keeping its data_source label. That writes SCO
--      actuals into a row labelled "Long Beach General Fund Operating Budget".
--
-- After: the lookup matches the full identity, and the insert stamps the axes.
-- Both new params default so existing callers are unaffected.
--
-- NOTE: adding params changes the arity, so CREATE OR REPLACE does NOT replace
-- the prior 9-arg function -- it creates a second overload. Two overloads make
-- a named-arg PostgREST call ambiguous (PGRST203), which would break existing
-- callers. Drop the old 9-arg overload so the 11-arg version (which covers all
-- old call shapes via its DEFAULTs) is the single definition.
DROP FUNCTION IF EXISTS public.treasury_sync_city_budget(uuid, integer, text, numeric, jsonb, integer, text, text, date);

CREATE OR REPLACE FUNCTION public.treasury_sync_city_budget(
  p_municipality_id uuid,
  p_fiscal_year integer,
  p_dataset_type text,
  p_total numeric,
  p_tree jsonb,
  p_row_count integer,
  p_data_source_name text DEFAULT 'CA State Controller'::text,
  p_source_url text DEFAULT NULL,
  p_source_date date DEFAULT NULL,
  p_fund_scope text DEFAULT 'unknown'::text,
  p_basis text DEFAULT 'unknown'::text
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
  v_matches int := 0;
BEGIN
  -- Refuse to guess. If the narrowed key still matches more than one row the
  -- caller has not given us enough to identify a target, and silently picking
  -- one is the defect this migration exists to remove.
  SELECT count(*) INTO v_matches FROM treasury.budgets
  WHERE municipality_id = p_municipality_id
    AND fiscal_year     = p_fiscal_year
    AND dataset_type    = p_dataset_type
    AND fund_scope      = p_fund_scope
    AND basis           = p_basis;

  IF v_matches > 1 THEN
    RETURN jsonb_build_object('error',
      format('ambiguous target: %s rows match (muni=%s fy=%s dataset=%s fund_scope=%s basis=%s)',
             v_matches, p_municipality_id, p_fiscal_year, p_dataset_type, p_fund_scope, p_basis));
  END IF;

  SELECT id INTO v_budget_id FROM treasury.budgets
  WHERE municipality_id = p_municipality_id
    AND fiscal_year     = p_fiscal_year
    AND dataset_type    = p_dataset_type
    AND fund_scope      = p_fund_scope
    AND basis           = p_basis;

  IF v_budget_id IS NOT NULL THEN
    DELETE FROM treasury.budget_line_items
     WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);
    DELETE FROM treasury.budget_categories WHERE budget_id = v_budget_id;
  ELSE
    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget,
                                  data_source, fiscal_year_start_month, fund_scope, basis)
    VALUES (p_municipality_id, p_fiscal_year, p_dataset_type, p_total,
            p_data_source_name, 7, p_fund_scope, p_basis)
    RETURNING id INTO v_budget_id;
  END IF;

  PERFORM _treasury_insert_tree(v_budget_id, p_tree, NULL, 0, p_total, 0);

  SELECT COUNT(*) INTO v_inserted FROM treasury.budget_line_items
  WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);

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
