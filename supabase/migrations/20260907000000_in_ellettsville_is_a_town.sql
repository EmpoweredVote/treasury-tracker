-- Retype Ellettsville, Indiana from `city` to `town`.
--
-- Gateway names it `ELLETTSVILLE CIVIL TOWN` and files it under
-- `afr_unit_type` 3 (449 towns), not 2 (119 cities). Indiana's own publisher
-- distinguishes the two classes, and Chris's call 2026-09-07 is to keep that
-- distinction rather than flatten 449 towns into `city` — the same call already
-- made for Michigan's `village` (#124) and Pennsylvania's `borough` (#133).
--
-- ── ⚠⚠ WHY THIS MUST HAPPEN BEFORE THE STATEWIDE SWEEP WRITES ──────────────
--
-- `treasury_ensure_municipality` keys on (name, state, ENTITY_TYPE) — all three.
-- With Ellettsville left as `city`, the sweep's `town` roster entry would not
-- match it and would INSERT A SECOND Ellettsville, leaving one 0-row `city` and
-- one `town` carrying the data. That is the identity defect this repo has now hit
-- three times: Michigan's same-named townships, Pennsylvania's State College
-- (typed `municipality` as a source-chip workaround while the database held
-- `borough`), and here.
--
-- Validated against the full roster before writing this: applying
-- scripts/data/inNameRules.mjs to all 660 Indiana governments produces 660
-- DISTINCT (name, state, entity_type) keys and matches what TT already stores for
-- seven of its eight overlapping entities — Allen County, Bloomington, Fort
-- Wayne, Gary, Lake County, Monroe County and Stinesville. **Ellettsville is the
-- only disagreement.**
--
-- ⭐ Stinesville is ALREADY `town` and already agrees, so TT's Indiana data
-- contains both conventions today and this makes them consistent.
--
-- ── BLAST RADIUS: NIL ──────────────────────────────────────────────────────
--
-- Measured 2026-09-07. Ellettsville (e4934a3c-096b-4453-8e5a-807e4f80ab9d) has:
--   * 0 budget rows — its 9 legacy Gateway-vintage rows were deleted by
--     migration 20260905000100, so there is no figure to carry across and no
--     cascade to consider.
--   * 1 data_sources row (`Ellettsville Budget & Disbursements`), DISABLED by
--     migration 20260905000000. It points at municipality_id, which does not
--     change here.
--   * population 0, population_year NULL, county_id NULL — nothing else to move.
--
-- `entity_type` lives on `municipalities`, not `budgets`, so **$0 moves** and the
-- frozen digest cannot be affected.
--
-- ⚠ `town` needs no DDL: it has been in `municipalities_entity_type_check` since
-- before this change, and PR #150 put it in every product list that gates
-- behaviour (CITY_TIER_TYPES, SOURCE_CHIP_ENTITY_TYPES, the county children
-- panel). A town renders its source chip and appears under its county.

UPDATE treasury.municipalities
   SET entity_type = 'town'
 WHERE id = 'e4934a3c-096b-4453-8e5a-807e4f80ab9d'
   AND state = 'IN'
   AND name = 'Ellettsville'
   AND entity_type = 'city';

DO $$
DECLARE n integer;
BEGIN
  -- It is a town now...
  SELECT count(*) INTO n FROM treasury.municipalities
   WHERE state = 'IN' AND name = 'Ellettsville' AND entity_type = 'town';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 Ellettsville typed `town`, found %', n;
  END IF;

  -- ...and there is not a second one left behind under any other type.
  SELECT count(*) INTO n FROM treasury.municipalities
   WHERE state = 'IN' AND name = 'Ellettsville';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 Ellettsville row in total, found % — a duplicate exists', n;
  END IF;

  -- And it still carries no budget rows, so nothing was silently re-parented.
  SELECT count(*) INTO n FROM treasury.budgets b
    JOIN treasury.municipalities m ON m.id = b.municipality_id
   WHERE m.state = 'IN' AND m.name = 'Ellettsville';
  IF n <> 0 THEN
    RAISE EXCEPTION 'Expected 0 Ellettsville budget rows, found %', n;
  END IF;
END $$;
