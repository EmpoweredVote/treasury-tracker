-- THE GATE. treasury_sync_city_budget refuses a row the reader cannot use.
--
-- ── WHY HERE ───────────────────────────────────────────────────────────────
--
-- Two promises to someone looking up their own government's finances: the
-- figure is right, and when they cannot tell why, they click through to the
-- publisher's own file instead of trusting us. A row with no provenance
-- label keeps neither; a row with no link keeps the second one from being
-- checkable at all.
--
-- Measured 2026-11-01: 1,302 rows are `unknown` on all four axes and 24,947
-- carry no source_url, none of it chosen — a loader writes, the axis columns
-- default to `unknown` because no registry entry matches the new
-- data_source, and NO GATE READS THE AXIS COLUMNS AT LOAD TIME. Hawaii
-- shipped exactly that way twice.
--
-- ⚠⚠ This function is the only chokepoint. 34 JS call sites invoke it
-- directly across 61 files and there is no shared write helper, so a
-- JS-side guard would be 34 edits with nothing stopping the 35th loader. A
-- gate here holds for a loader written next year by someone who never read
-- any of this.
--
-- ── ⚠⚠⚠ THE THREE RULES, AND WHY EACH IS SHAPED THIS WAY ───────────────────
--
-- 1. IT TESTS FOR A MATCH, NEVER FOR A NON-`unknown` VALUE. 24,778 rows are
--    honestly `unknown` on audit grade and that is CORRECT — SCOPE-01
--    classified 33.2% as unknown rather than guess. A family whose
--    considered, cited answer is `unknown` passes.
--
-- 2. THREE AXES, NOT FOUR. Of 5,929 live families only 62 (1.0%) match all
--    four; accounting_basis has five entries and is `unknown` on 99.94% of
--    rows. Requiring it would refuse every loader in the repo. The active
--    three — audit_grade, fund_scope, basis — pass for 1,966 families
--    covering 530,717 rows (90.6%).
--
-- 3. AN EXISTING FAMILY IS GRANDFATHERED. A bare three-axis rule would still
--    refuse 2,150 existing families on their next write, including a run
--    whose whole purpose is to FIX bad data. The goal is that a loader
--    cannot write a family NO registry matches; draining the backlog is
--    explicitly not this gate's job — the provenance ratchet owns that.
--    ⭐ This does not weaken the enumerated-year design: "(FY2026 actual, …)"
--    is a different data_source string, so a year outside a registry's
--    window is a NEW family and is still refused. That is precisely why the
--    years are enumerated instead of written FY\d{4}.
--
-- ⚠ The refusal is returned, not raised: this function ends in a blanket
-- EXCEPTION handler that converts any RAISE into the same {error} payload,
-- so there is no mechanism that avoids the caller having to read it.
-- scripts/lib/rpcResult.mjs classifies it and all 34 call sites now do.
--
-- ⚠ data_source is indexed twice (idx_budgets_data_source_id,
-- idx_budgets_data_source_fy_id), so the existence probe is an index hit,
-- not a scan of 585,631 rows on every single write.

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
  v_known_family boolean;
  v_unmatched text;
BEGIN
  -- ── THE REGISTRY GATE ────────────────────────────────────────────────────
  -- Runs before anything is written, and before the ambiguity check, so a
  -- refusal costs one index probe and nothing else.
  SELECT EXISTS (
    SELECT 1 FROM treasury.budgets WHERE data_source = p_data_source_name
  ) INTO v_known_family;

  IF NOT v_known_family THEN
    SELECT string_agg(a.axis, ', ' ORDER BY a.axis) INTO v_unmatched
    FROM unnest(ARRAY['audit_grade', 'fund_scope', 'basis']) AS a(axis)
    WHERE NOT EXISTS (
      SELECT 1 FROM treasury.registered_source_families r
      WHERE r.axis = a.axis AND p_data_source_name ~ r.pattern
    );

    IF v_unmatched IS NOT NULL THEN
      RETURN jsonb_build_object('error', format(
        'unregistered source family: %s (unmatched: %s). Nothing was written. '
        || 'This family has never been classified, so its rows would publish with no '
        || 'provenance label and no gate would notice. Add an entry to each unmatched '
        || 'axis registry under scripts/data/, then run '
        || 'scripts/syncRegisteredFamilies.mjs. '
        || 'If you believe it IS registered, your mirror is stale — '
        || 'scripts/syncRegisteredFamilies.mjs --check will say so.',
        p_data_source_name, v_unmatched));
    END IF;

    -- ⚠ A new family must also bring a link. NULL and '' are both checked:
    -- 24,947 existing rows are `source_url is null OR = ''`, so a NOT NULL
    -- test alone misses half the shape.
    IF p_source_url IS NULL OR btrim(p_source_url) = '' THEN
      RETURN jsonb_build_object('error', format(
        'no source_url for new family %s. Nothing was written. A figure a reader '
        || 'cannot trace is one they have to take on trust, which is the thing '
        || 'Treasury Tracker does not ask of them.', p_data_source_name));
    END IF;
  END IF;

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
    -- ── Resolve the fiscal calendar for a row that does not exist yet ────────
    -- Only reached on INSERT. An existing row keeps whatever month it already
    -- carries, so a reload can never undo a correction like PR #60's.
    IF p_fiscal_year_start_month IS NOT NULL THEN
      IF p_fiscal_year_start_month < 1 OR p_fiscal_year_start_month > 12 THEN
        RETURN jsonb_build_object('error',
          format('fiscal_year_start_month %s is not a month (expected 1-12)',
                 p_fiscal_year_start_month));
      END IF;
      v_fysm := p_fiscal_year_start_month;
    ELSE
      -- Inherit from the same DATASET FAMILY, and only when it is unanimous.
      -- COUNT(DISTINCT) first so a family that disagrees with itself refuses
      -- rather than picking a winner.
      SELECT count(DISTINCT fiscal_year_start_month) INTO v_family_months
        FROM treasury.budgets
       WHERE municipality_id = p_municipality_id
         AND data_source     = p_data_source_name;

      IF v_family_months = 1 THEN
        SELECT DISTINCT fiscal_year_start_month INTO v_fysm
          FROM treasury.budgets
         WHERE municipality_id = p_municipality_id
           AND data_source     = p_data_source_name;
      ELSE
        RETURN jsonb_build_object('error',
          format('cannot determine fiscal_year_start_month: %s existing month(s) for '
                 || '(muni=%s data_source=%s). Pass p_fiscal_year_start_month explicitly '
                 || '— it must come from the entity''s own financial report, never a default.',
                 v_family_months, p_municipality_id, p_data_source_name));
      END IF;
    END IF;

    INSERT INTO treasury.budgets (municipality_id, fiscal_year, dataset_type, total_budget,
                                  data_source, fiscal_year_start_month, fund_scope, basis,
                                  derivation)
    VALUES (p_municipality_id, p_fiscal_year, p_dataset_type, p_total,
            p_data_source_name, v_fysm, p_fund_scope, p_basis, p_derivation)
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

-- ⛔ CREATE OR REPLACE re-grants EXECUTE to PUBLIC. The original function was
-- already swept; re-assert it so this migration cannot reopen the hole.
-- npm run verify:grants checks the live state.
-- Measured before this change: anon / authenticated / ev_api all had NO
-- execute, postgres and service_role did. Revoking from PUBLIC restores
-- exactly that, and the explicit grant makes service_role's access a stated
-- fact rather than a side effect of whatever PUBLIC happened to hold.
REVOKE ALL ON FUNCTION public.treasury_sync_city_budget(
  uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text, integer
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.treasury_sync_city_budget(
  uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text, integer
) TO service_role;
