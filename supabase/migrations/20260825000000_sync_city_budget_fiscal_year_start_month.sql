-- Remove the hardcoded `fiscal_year_start_month = 7` from treasury_sync_city_budget.
--
-- ── The defect ───────────────────────────────────────────────────────────────
-- The INSERT branch wrote a literal `7`. The function took no parameter for the
-- column, so EVERY row it has ever created asserts a July-June fiscal year —
-- whatever the entity's actual calendar. Inglewood, CA closes September 30; its
-- 60 rows claimed July until PR #60 corrected them to 10.
--
-- The column moves no dollar figure, so no tie test can see this: every gate
-- stays at $0 while the period the figures describe is wrong by a quarter. That
-- is exactly how it survived SCOPE-04, whose loader gate asserted `=== 7` and
-- passed 7,664 rows — validating CONFORMITY TO THE HARDCODE, not correctness.
-- Migration 20260821000100's own header called the 7 "CORRECT here ... all 7,664
-- eligible rows measure 7 uniformly". Uniform is not correct; it was uniform
-- because one line of SQL made it so.
--
-- Fixing the 60 rows was not enough. The hardcode only ran on INSERT, so
-- corrected rows survive a reload — but any NEW fiscal year re-inserted 7, which
-- would have silently re-broken Inglewood the moment SCO published FY2025.
--
-- ── How the month is resolved now, in order ─────────────────────────────────
--   1. `p_fiscal_year_start_month`, when the caller passes it. Validated 1-12.
--   2. INHERITED from the rows that municipality already has under the SAME
--      `data_source`, when they agree on exactly one month. This is what makes a
--      new fiscal year safe: Inglewood's FY2025 SCO row now picks up 10 from its
--      22 siblings instead of reverting to 7.
--   3. REFUSE. No sibling rows and no parameter means nobody has established
--      this entity's fiscal calendar, and inventing one is the whole defect.
--      Returns `{'error': ...}` naming the parameter, consistent with the
--      ambiguity guard above it, and surfaces through scripts/lib/rpcResult.mjs
--      the same way every other RPC error already does.
--
-- ⚠ Step 2 is keyed on (municipality_id, data_source) — the DATASET FAMILY, not
-- the entity. An entity has one fiscal calendar, but its datasets need not share
-- it: Inglewood's SCO rows are an October year while its publicpay salaries rows
-- are a CALENDAR year (GCC reports by calendar year, 7,682 such rows across 482
-- entities still sit at 7 pending their own fix). Keying on municipality alone
-- would make those two families contradict each other, and step 2 would fall
-- through to a refusal on an entity whose calendar is perfectly well known.
--
-- ⚠ BEHAVIOUR CHANGE, intended. A brand-new (entity, data_source) pair whose
-- loader passes no month now FAILS instead of silently storing 7.
--
-- Measured blast radius before applying: of the 7,741 (municipality_id,
-- data_source) families in treasury.budgets, ZERO are split across more than one
-- month. So step 2 resolves for EVERY family that already exists — adding a new
-- fiscal year to any current entity/dataset needs no loader change at all, which
-- is the common case and the one that re-broke Inglewood. Only a genuinely new
-- pair reaches step 3.
--
-- 14 scripts call this RPC and NONE is updated here:
--   bulkLoadStateController, deriveTotalGovernmental, loadCASalaries,
--   loadCountyBudget, loadLACountyOperating, loadLACountyRevenue,
--   loadLACountySalaries, loadMNOSA, loadOhioAOS, loadUtahTransparency,
--   loadVAComparativeReport, loadWICMREB, sweepCASalaries, sweepOCSalaries.
-- Each should pass its entity's verified month; wiring them is a follow-up.
--
-- ⚠ scripts/lib/acfrGfLoad.mjs is NOT among them and must not be added: it
-- deliberately avoids this RPC ("Never treasury_sync_city_budget — that RPC
-- overwrites existing (muni, fy, dataset) rows and keeps the stale data_source
-- label") and goes through treasury_sync_budget_tree, which already resolves the
-- month correctly from `v_ds.fiscal_year_start_month`. That function is the
-- pattern this one is being brought up to, not a caller to change.
--
-- ⚠ Adding a param changes the arity, so CREATE OR REPLACE does NOT replace the
-- 12-arg function — it creates a second overload, and two overloads make a
-- named-arg PostgREST call ambiguous (PGRST203). SCOPE-02 hit this with the
-- 9-arg version and SCOPE-04 with the 11-arg. Drop the 12-arg one; the 13-arg
-- version covers every old call shape through its DEFAULTs.
--
-- The body below was copied from the LIVE function, not from a migration file:
-- prosrc md5 534cb2a324b53df1cefd8078074a7517, length 2417. The only changes are
-- the new parameter, the v_fysm resolution block, and `v_fysm` replacing the
-- literal 7 in the INSERT. The ambiguity guard, the delete/insert branches, the
-- _treasury_insert_tree call and the trailing UPDATE are untouched.

DROP FUNCTION IF EXISTS public.treasury_sync_city_budget(
  uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text);

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
  p_basis text DEFAULT 'unknown'::text,
  p_derivation text DEFAULT 'published'::text,
  p_fiscal_year_start_month integer DEFAULT NULL
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
  v_fysm int;
  v_family_months int;
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
