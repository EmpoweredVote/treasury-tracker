-- Move the adopted budget out of actual_amount and into approved_amount, for every
-- remaining budget row where the whole row is inverted.
--
-- The defect
-- ──────────
-- `_treasury_insert_tree` maps tree item `aa` -> budget_line_items.approved_amount and
-- `a` -> budget_line_items.actual_amount. Loaders that emitted `{ a: budget, aa: null }`
-- therefore stored an ADOPTED BUDGET in actual_amount and left approved_amount NULL.
-- The page then renders "Budgeted $0 / Actual $X" with a nonsense variance — the San
-- Francisco defect (PR #85) and the Dallas defect (PR #83).
--
-- PR #85 fixed the four shared tree loaders and PR #91 re-loaded Sacramento and
-- San Diego, which were 97% of the affected line items. But the defect was never four
-- loaders wide: it reaches every per-city PDF/CSV script, and those write one source
-- per city per year. What is left is a long tail:
--
--     105 budget rows, 102 data sources, 2,630 line items
--
-- roughly a hundred cities — San Jose, Portland, Troutdale, Fresno, Santa Ana,
-- Gresham, Long Beach, Richardson, Plano, Leonardtown, Oakland, Riverside, Anaheim,
-- Bakersfield, Fremont and several Massachusetts counties — each rendering
-- "Budgeted $0" today. Re-loading them would mean fixing ~100 separate scripts and
-- re-running each against sources that in several cases are hand-transcribed PDFs.
-- The stored figures are already correct; only the column holding them is wrong, so
-- this repairs the column and leaves the figures untouched.
--
-- Why this is safe to do as one blanket statement
-- ───────────────────────────────────────────────
-- The qualifying set is a PREDICATE, not a list of cities:
--
--   basis = 'adopted'        -- the row is an adopted budget. `basis` is not a guess:
--                            -- SCOPE-01/02 classified it per source WITH EVIDENCE.
--   AND every line item has approved_amount IS NULL
--   AND every line item has actual_amount IS NOT NULL
--
-- "every item" is what excludes the 2 PARTIALLY inverted rows (Plano FY2019/2020/2022,
-- Richardson FY2026 — some items carry an approved figure and some do not). A mixed
-- row is not a mechanical swap and is deliberately left for individual attention.
--
-- ⚠ The corroborating check, and the reason this is not merely plausible: for all 105
-- qualifying rows, SUM(actual_amount) ALREADY EQUALS total_budget EXACTLY. If those
-- columns held genuine year-end actuals they would not sum, to the cent, to the
-- adopted total of the very same row. They are the adopted budget, in the wrong column.
-- The migration asserts this before writing and refuses if it is not true.
--
-- budget_categories needs NO change: its rollup `amount` already equals total_budget on
-- inverted and correct rows alike (the tree's node amount was computed from the figure
-- regardless of which item field it landed in), and its actual_amount sums to 0 in both.
-- Only budget_line_items is wrong.
--
-- ⚠ NOT ONE DOLLAR MOVES. total_budget is not written, budget_categories is not
-- written, and no line-item value changes — each figure only changes which column it
-- sits in. Which is precisely why the Σ-items == total gate never caught this.
--
-- Monroe County is deliberately NOT here. Its Gateway sources are actual receipts and
-- actual disbursements, where actual_amount populated with approved_amount NULL is the
-- CORRECT representation; its basis is 'unknown', so the predicate above excludes it.
-- Swapping it would have corrupted correct data.

DO $$
DECLARE
  v_budgets   int;
  v_items     int;
  v_mismatch  int;
  v_updated   int;
  v_remaining int;
  v_bad_tie   int;
BEGIN
  -- ── Identify the fully inverted adopted rows ────────────────────────────────
  CREATE TEMP TABLE _uninvert_targets ON COMMIT DROP AS
  WITH per_budget AS (
    SELECT b.id, b.total_budget,
           count(li.id)                  AS items,
           count(li.approved_amount)     AS approved_nonnull,
           count(li.actual_amount)       AS actual_nonnull,
           sum(li.actual_amount)         AS sum_actual
    FROM treasury.budgets b
    JOIN treasury.budget_categories bc ON bc.budget_id = b.id
    JOIN treasury.budget_line_items li ON li.category_id = bc.id
    WHERE b.basis = 'adopted'
    GROUP BY b.id, b.total_budget
  )
  SELECT id, total_budget, items, sum_actual
  FROM per_budget
  WHERE approved_nonnull = 0 AND actual_nonnull = items AND items > 0;

  SELECT count(*), coalesce(sum(items), 0) INTO v_budgets, v_items FROM _uninvert_targets;

  IF v_budgets = 0 THEN
    RAISE NOTICE 'Nothing to do: no fully inverted adopted budget rows found.';
    RETURN;
  END IF;

  -- ── Refuse unless the figure really is the budget ───────────────────────────
  -- Σ actual_amount must equal the row's own adopted total. Anything else means the
  -- column may hold real actuals, and swapping it would destroy them.
  SELECT count(*) INTO v_mismatch
  FROM _uninvert_targets
  WHERE abs(coalesce(total_budget, 0) - coalesce(sum_actual, 0)) > 0.01;

  IF v_mismatch > 0 THEN
    RAISE EXCEPTION
      'Refusing to swap: % of % candidate rows have SUM(actual_amount) <> total_budget. '
      'Those may hold genuine actuals rather than a misfiled budget, and this migration '
      'would destroy them. Investigate individually.', v_mismatch, v_budgets;
  END IF;

  RAISE NOTICE 'Un-inverting % budget rows / % line items.', v_budgets, v_items;

  -- ── The swap ────────────────────────────────────────────────────────────────
  UPDATE treasury.budget_line_items li
     SET approved_amount = li.actual_amount,
         actual_amount   = NULL
    FROM treasury.budget_categories bc
   WHERE li.category_id = bc.id
     AND bc.budget_id IN (SELECT id FROM _uninvert_targets);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> v_items THEN
    RAISE EXCEPTION 'Expected to update % line items, updated % — aborting.',
      v_items, v_updated;
  END IF;

  -- ── Post-conditions ─────────────────────────────────────────────────────────
  -- 1. Every target now ties: SUM(approved_amount) = total_budget.
  SELECT count(*) INTO v_bad_tie
  FROM _uninvert_targets t
  JOIN LATERAL (
    SELECT sum(li.approved_amount) AS s, count(li.actual_amount) AS a
    FROM treasury.budget_categories bc
    JOIN treasury.budget_line_items li ON li.category_id = bc.id
    WHERE bc.budget_id = t.id
  ) x ON true
  WHERE abs(coalesce(t.total_budget, 0) - coalesce(x.s, 0)) > 0.01 OR x.a <> 0;

  IF v_bad_tie > 0 THEN
    RAISE EXCEPTION '% rows failed the post-swap tie or still hold actual_amount.', v_bad_tie;
  END IF;

  -- 2. No fully inverted adopted row is left anywhere.
  SELECT count(*) INTO v_remaining
  FROM (
    SELECT b.id
    FROM treasury.budgets b
    JOIN treasury.budget_categories bc ON bc.budget_id = b.id
    JOIN treasury.budget_line_items li ON li.category_id = bc.id
    WHERE b.basis = 'adopted'
    GROUP BY b.id
    HAVING count(li.approved_amount) = 0 AND count(li.actual_amount) = count(li.id)
       AND count(li.id) > 0
  ) r;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION '% fully inverted adopted rows remain after the swap.', v_remaining;
  END IF;

  RAISE NOTICE 'Done: % rows / % line items un-inverted, all tie, none remaining.',
    v_budgets, v_updated;
END $$;
