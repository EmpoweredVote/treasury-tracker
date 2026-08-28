-- Swap approved_amount and actual_amount on the adopted budget rows that hold BOTH.
--
-- The last 22 rows of the a/aa inversion
-- ──────────────────────────────────────
-- PR #92 repaired the rows where approved_amount was NULL and the budget sat alone in
-- actual_amount. It deliberately skipped rows with BOTH columns populated, because a
-- blanket "move actual into approved" would have destroyed the second figure. Those
-- rows are this migration:
--
--     22 budget rows across 7 publishers
--     Fremont (12), Plano (3), Richardson (3), Garland, Longview, Sachse, Wylie
--
-- They surfaced as failures of `SUM(approved_amount) = total_budget` — differences up
-- to $52.8M, signed in both directions, which is what made them look like a separate
-- "headline total disagrees with its line items" bug. They are not. They are the same
-- inversion, with a second column along for the ride.
--
-- What the loaders actually did
-- ─────────────────────────────
-- All seven emit their line items as `{ a: adopted, aa: actual }`, e.g.
-- scripts/processLongviewBudget.js, whose own comments read:
--
--     a:  adopted,      // adopted_amount
--     aa: actual,       // actual_amount (2023-24 ACTUAL)
--
-- which is exactly inverted: `_treasury_insert_tree` maps `aa` -> approved_amount and
-- `a` -> actual_amount. So the ADOPTED BUDGET was written to actual_amount and the
-- est-actual to approved_amount — both figures real, both in the wrong column.
--
-- ⚠ The trap that produced this, and it is a good one: at NODE level the tree key `a`
-- IS the rollup amount and correctly holds the adopted figure, while at ITEM level `a`
-- is actual_amount. The same letter means two different things one line apart, and
-- every one of these seven loaders read it as "approved" in both places.
--
-- The evidence that this is a swap and not a coincidence
-- ─────────────────────────────────────────────────────
-- For all 22 rows, SUM(actual_amount) EQUALS total_budget EXACTLY, while
-- SUM(approved_amount) does not. total_budget was computed by each loader as the sum
-- of its `adopted` variable — so whatever now sits in actual_amount is, provably, the
-- adopted budget. This migration asserts that per row and refuses the whole swap if
-- any row fails it.
--
-- ⚠ NOT ONE DOLLAR MOVES, and unlike PR #92 nothing is discarded either: this is a
-- symmetric exchange of two populated columns. NULLs swap cleanly too, which is what
-- correctly repairs the two PARTIALLY inverted rows (Plano FY2020, 56 of 69 items had
-- an approved figure; Richardson FY2026, 38 of 46). After the swap every item carries
-- an adopted figure and only some carry an est-actual — the right shape.

DO $$
DECLARE
  v_budgets  int;
  v_items    int;
  v_mismatch int;
  v_updated  int;
  v_bad_tie  int;
BEGIN
  CREATE TEMP TABLE _swap_targets ON COMMIT DROP AS
  WITH per_budget AS (
    SELECT b.id, b.total_budget,
           count(li.id)              AS items,
           count(li.actual_amount)   AS actual_nonnull,
           sum(li.approved_amount)   AS sum_approved,
           sum(li.actual_amount)     AS sum_actual
    FROM treasury.budgets b
    JOIN treasury.budget_categories bc ON bc.budget_id = b.id
    JOIN treasury.budget_line_items li ON li.category_id = bc.id
    WHERE b.basis = 'adopted'
    GROUP BY b.id, b.total_budget
  )
  SELECT id, total_budget, items, sum_approved, sum_actual
  FROM per_budget
  WHERE items > 0
    -- currently failing the tie...
    AND abs(coalesce(total_budget, 0) - coalesce(sum_approved, 0)) > 0.01
    -- ...and the figure that DOES tie is sitting in actual_amount
    AND abs(coalesce(total_budget, 0) - coalesce(sum_actual, 0)) <= 0.01
    -- every item carries the adopted figure, so the swap loses nothing
    AND actual_nonnull = items;

  SELECT count(*), coalesce(sum(items), 0) INTO v_budgets, v_items FROM _swap_targets;

  IF v_budgets = 0 THEN
    RAISE NOTICE 'Nothing to do: no adopted rows are holding the budget in actual_amount.';
    RETURN;
  END IF;

  -- Refuse if any row that currently fails the tie is NOT explained by the swap.
  -- Such a row is a genuine total-vs-items disagreement and must not be touched here.
  SELECT count(*) INTO v_mismatch
  FROM (
    SELECT b.id, b.total_budget,
           sum(li.approved_amount) AS sum_approved,
           sum(li.actual_amount)   AS sum_actual
    FROM treasury.budgets b
    JOIN treasury.budget_categories bc ON bc.budget_id = b.id
    JOIN treasury.budget_line_items li ON li.category_id = bc.id
    WHERE b.basis = 'adopted'
    GROUP BY b.id, b.total_budget
  ) q
  WHERE abs(coalesce(q.total_budget, 0) - coalesce(q.sum_approved, 0)) > 0.01
    AND abs(coalesce(q.total_budget, 0) - coalesce(q.sum_actual, 0)) > 0.01;

  IF v_mismatch > 0 THEN
    RAISE EXCEPTION
      'Refusing to swap: % adopted row(s) fail the tie on BOTH columns, so the budget is '
      'not simply in the wrong place. Investigate those individually.', v_mismatch;
  END IF;

  RAISE NOTICE 'Swapping approved/actual on % budget rows / % line items.', v_budgets, v_items;

  -- Symmetric exchange. approved_amount is nullable, so the two-way move is safe.
  UPDATE treasury.budget_line_items li
     SET approved_amount = li.actual_amount,
         actual_amount   = li.approved_amount
    FROM treasury.budget_categories bc
   WHERE li.category_id = bc.id
     AND bc.budget_id IN (SELECT id FROM _swap_targets);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> v_items THEN
    RAISE EXCEPTION 'Expected to update % line items, updated % - aborting.', v_items, v_updated;
  END IF;

  -- Post-condition: every swapped row now ties on approved_amount.
  SELECT count(*) INTO v_bad_tie
  FROM _swap_targets t
  JOIN LATERAL (
    SELECT sum(li.approved_amount) AS s
    FROM treasury.budget_categories bc
    JOIN treasury.budget_line_items li ON li.category_id = bc.id
    WHERE bc.budget_id = t.id
  ) x ON true
  WHERE abs(coalesce(t.total_budget, 0) - coalesce(x.s, 0)) > 0.01;

  IF v_bad_tie > 0 THEN
    RAISE EXCEPTION '% rows still fail the tie after the swap.', v_bad_tie;
  END IF;

  RAISE NOTICE 'Done: % rows / % line items swapped, all tie.', v_budgets, v_updated;
END $$;
