-- Record the VINTAGE of Michigan's population figures.
--
-- Every Michigan local government's `population` came from Census Population
-- Estimates Program **Vintage 2024** — `POPESTIMATE2024`, read from
-- `sub-est2024_26.csv` (SUMLEV 162 for cities and villages, SUMLEV 061 for
-- townships) and `co-est2024-alldata.csv` (SUMLEV 050) for the counties. The
-- same program and vintage as the NC, FL, GA, PA and IN entities.
--
-- ⚠ TT already SHOWED these figures and could not say how old they were.
--   `population_year` is the "as of" for a number a reader sees, and it was
--   NULL on all 1,856 -- while MA has it on 356 of 356 and UT on 15 of 15.
--   Nothing had to be fetched: the vintage was known at load time and simply
--   never written down.
--
-- ⚠ The MI state node is deliberately EXCLUDED: it already carries a
--   population_year, and its figure has a different provenance.
--
-- ⚠ INVARIANT-NEUTRAL. No budget row is touched and no figure moves;
--   `treasury.frozen_invariant_status()` digests `budgets.id || total_budget`.
--   Verified byte-identical either side: 62654 / 3a48ac28...

DO $$
DECLARE v_moved integer;
BEGIN
  UPDATE treasury.municipalities
     SET population_year = 2024
   WHERE state = 'MI'
     AND entity_type IN ('city', 'village', 'township', 'county')
     AND population_year IS NULL
     AND population > 0;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  -- 1,240 townships + 280 cities + 253 villages + 83 counties.
  IF v_moved <> 1856 THEN
    RAISE EXCEPTION
      'Expected exactly 1856 Michigan rows to stamp, moved %. The roster changed '
      'underneath this -- re-measure before re-running.', v_moved;
  END IF;
END $$;
