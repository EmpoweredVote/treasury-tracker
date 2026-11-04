-- Frisco and McKinney check registers move from `operating` to `transactions`.
--
-- ⚠⚠ WHAT THIS FIXES. Frisco FY2026 had TWO enabled sources claiming the same
-- (municipality, fiscal_year, dataset_type) row:
--
--     Frisco Check Register FY2026   xlsx   actual cash disbursed
--     Frisco Operating Budget FY2026 pdf    the ADOPTED BUDGET
--
-- They are different things. They collided, and the collision is what left
-- that budget publishing total_budget = 0 while holding 6,506 transactions
-- worth $408,787,217.99.
--
-- ⭐ TT ALREADY HAD THE RIGHT ANSWER — in Plano, which is the model:
--
--     Plano FY2024  operating      216,006,658   Plano Operating Budget FY2024
--                   revenue        337,326,494   Plano Revenue FY2024
--                   transactions   461,886,142   Plano Check Register FY2024
--
-- Plano's and West Hollywood's registers are `transactions`. Frisco's and
-- McKinney's 13 register sources were the outliers, sitting in `operating` —
-- so an adopted budget had nowhere to go.
--
-- ⚠ CONSEQUENCE, STATED PLAINLY. Neither city has an adopted-budget source
-- (Frisco only for FY2026), so after this McKinney shows NO operating budget
-- for FY2022-25 and Frisco none for FY2018-25. That is the honest position: a
-- check register is a record of money paid out, not a budget, and presenting
-- one as the other told readers something the publisher never said.
--
-- Nothing is deleted. Every transaction, tree and figure is retained; only the
-- axis they hang from changes. No frozen figure is involved — neither city has
-- a row in treasury.frozen_figure_snapshot, verified before writing.

do $$
declare
  v_sources int;
  v_budgets int;
begin
  update treasury.data_sources
     set dataset_type = 'transactions'
   where dataset_type = 'operating'
     and name ~ '^(Frisco|McKinney) Check Register FY[0-9]{4}$';
  get diagnostics v_sources = row_count;

  -- ⚠ Budgets are matched by the SOURCE NAME they record, not by a join on
  -- dataset_type — which has just changed on one side and not yet the other.
  update treasury.budgets b
     set dataset_type = 'transactions'
   where b.dataset_type = 'operating'
     and b.data_source ~ '^(Frisco|McKinney) Check Register FY[0-9]{4}$';
  get diagnostics v_budgets = row_count;

  -- ⚠⚠ Assert the blast radius. 9 Frisco (FY2018-26) + 4 McKinney (FY2022-25).
  -- A migration that silently touched a different number of rows than intended
  -- is how a quiet data defect starts.
  if v_sources <> 13 or v_budgets <> 13 then
    raise exception 'expected 13 sources and 13 budgets, retyped % and %', v_sources, v_budgets;
  end if;
end $$;
