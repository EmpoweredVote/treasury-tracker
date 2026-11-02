-- treasury_sync_city_budget now calls the shared rule, and its source_url
-- check is fixed.
--
-- ⚠⚠ THE ROW-2 HOLE, found in code review. The link rule sat inside the
-- `IF NOT v_known_family` branch, and a family becomes "known" the instant
-- its first row commits — so a loader supplying a URL for row 1 and NULL for
-- rows 2..N walked straight past Goal 2 ("a loader cannot write a row with
-- no source_url"). Goal 2 was enforced for exactly one row per family.
--
-- The rule now keys on whether the family has ever had a LINKLESS row, which
-- is stable across a run:
--   * a brand-new family has none, so EVERY insert must bring a link
--   * an established linkless family (CA publicpay 7,682 rows, MA DLS 15,071)
--     is grandfathered, as the gate's non-goal requires
--   * a family where every row has a link (Ohio AOS) must keep bringing them
--
-- ⚠ And `source_url = COALESCE(p_source_url, source_url)` let an EMPTY STRING
-- overwrite a good link, because '' is not NULL — the very shape Review
-- Focus #4 is about. It is now COALESCE(nullif(btrim(...), ''), source_url).
--
-- ⚠ p_data_source_name is btrim'd before matching and before the key lookups,
-- so the RPC and the JS preflight agree about whitespace. This repo has
-- already lost a day to a trailing space (ga_dca_rlgf).
--
-- The body below is byte-identical to what was applied to the database.

CREATE OR REPLACE FUNCTION public.treasury_sync_city_budget(
  p_municipality_id uuid, p_fiscal_year integer, p_dataset_type text,
  p_total numeric, p_tree jsonb, p_row_count integer,
  p_data_source_name text DEFAULT 'CA State Controller'::text,
  p_source_url text DEFAULT NULL::text, p_source_date date DEFAULT NULL::date,
  p_fund_scope text DEFAULT 'unknown'::text, p_basis text DEFAULT 'unknown'::text,
  p_derivation text DEFAULT 'published'::text,
  p_fiscal_year_start_month integer DEFAULT NULL::integer)
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
  v_fysm int;
  v_family_months int;
  v_reason text;
  v_name text := btrim(coalesce(p_data_source_name, ''));
  v_link text := nullif(btrim(coalesce(p_source_url, '')), '');
BEGIN
  v_reason := treasury.family_refusal_reason(v_name);
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('error', v_reason);
  END IF;

  SELECT id INTO v_budget_id FROM treasury.budgets
  WHERE municipality_id = p_municipality_id
    AND fiscal_year     = p_fiscal_year
    AND dataset_type    = p_dataset_type
    AND fund_scope      = p_fund_scope
    AND basis           = p_basis;

  IF v_budget_id IS NULL AND v_link IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM treasury.budgets
       WHERE data_source = v_name
         AND (source_url IS NULL OR btrim(source_url) = '')
     )
  THEN
    RETURN jsonb_build_object('error', format(
      'no source_url for a new row in %s. Nothing was written. Every row this '
      || 'family has carries a link, so a linkless one would be the first figure '
      || 'in it a reader cannot trace — and a figure they cannot trace is one '
      || 'they have to take on trust.', v_name));
  END IF;

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

  IF v_budget_id IS NOT NULL THEN
    DELETE FROM treasury.budget_line_items
     WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);
    DELETE FROM treasury.budget_categories WHERE budget_id = v_budget_id;
  ELSE
    IF p_fiscal_year_start_month IS NOT NULL THEN
      IF p_fiscal_year_start_month < 1 OR p_fiscal_year_start_month > 12 THEN
        RETURN jsonb_build_object('error',
          format('fiscal_year_start_month %s is not a month (expected 1-12)',
                 p_fiscal_year_start_month));
      END IF;
      v_fysm := p_fiscal_year_start_month;
    ELSE
      SELECT count(DISTINCT fiscal_year_start_month) INTO v_family_months
        FROM treasury.budgets
       WHERE municipality_id = p_municipality_id
         AND data_source     = v_name;

      IF v_family_months = 1 THEN
        SELECT DISTINCT fiscal_year_start_month INTO v_fysm
          FROM treasury.budgets
         WHERE municipality_id = p_municipality_id
           AND data_source     = v_name;
      ELSE
        RETURN jsonb_build_object('error',
          format('cannot determine fiscal_year_start_month: %s existing month(s) for '
                 || '(muni=%s data_source=%s). Pass p_fiscal_year_start_month explicitly '
                 || '— it must come from the entity''s own financial report, never a default.',
                 v_family_months, p_municipality_id, v_name));
      END IF;
    END IF;

    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget,
                                  data_source, fiscal_year_start_month, fund_scope, basis,
                                  derivation)
    VALUES (p_municipality_id, p_fiscal_year, p_dataset_type, p_total,
            v_name, v_fysm, p_fund_scope, p_basis, p_derivation)
    RETURNING id INTO v_budget_id;
  END IF;

  PERFORM _treasury_insert_tree(v_budget_id, p_tree, NULL, 0, p_total, 0);

  SELECT COUNT(*) INTO v_inserted FROM treasury.budget_line_items
  WHERE category_id IN (SELECT id FROM treasury.budget_categories WHERE budget_id = v_budget_id);

  UPDATE treasury.budgets
     SET total_budget = p_total,
         source_url   = COALESCE(v_link, source_url),
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

REVOKE ALL ON FUNCTION public.treasury_sync_city_budget(
  uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text, integer
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.treasury_sync_city_budget(
  uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text, integer
) TO service_role;
