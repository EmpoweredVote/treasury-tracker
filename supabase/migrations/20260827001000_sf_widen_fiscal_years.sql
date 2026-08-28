-- San Francisco: widen fiscal_years to include FY2027 and FY2028.
--
-- Both SF sources read dataset xdgd-c79v ("Budget", data.sfgov.org) and were pinned to
-- fiscal_years [2025, 2026]. The publisher now carries FY2027 and FY2028, so the cron
-- has been re-loading two stale years and ignoring the two current ones.
--
-- Are the out-years adopted, or proposals?
-- ────────────────────────────────────────
-- Adopted. This matters because the house rule — set when West Hollywood's
-- `_2021_recommended` column was deliberately excluded — is that a figure the
-- legislature never adopted does not get loaded as a budget. SF's out-years are not
-- that. The publisher's own column note reads:
--
--     budget: "The amount published in the City and County of San Francisco's
--              Annual Appropriation Ordinance."
--
-- and the dataset description: "a budget is proposed by the Mayor, and then modified
-- and approved by the Board of Supervisors as the Appropriation Ordinance." Every row
-- in this dataset is an AAO figure, i.e. approved. basis is therefore 'adopted' for all
-- four years — declared on the source at the end of this migration so that every future
-- year is labelled on arrival rather than backfilled afterwards.
--
-- ⚠ ONE REAL CAVEAT, recorded in the note below rather than discovered later.
-- SF budgets in two-year cycles, and per the publisher: "Enterprise departments do not
-- submit a budget for the second year of the two year budget; rather, estimates of
-- enterprise department budgets in the second year of the budget are incorporated into
-- high-level spending and revenue figures."
--
-- That is visible in the data. Spending rows per fiscal year:
--
--     FY2025  23,729      FY2027  14,792
--     FY2026  24,048      FY2028   7,107
--
-- FY2028 is the second year of the current cycle, so its enterprise departments are
-- high-level estimates rather than departmental detail. The TOTAL is still the adopted
-- appropriation; the granularity underneath it is thinner. It will be re-approved with
-- full detail next cycle and this source will pick that up on its next sync.
--
-- ⚠ The dataset also carries FY2010-FY2024 — 15 further years TT has never loaded,
-- roughly 250,000 source rows. That is a much larger change than widening to the two
-- current years and is deliberately NOT done here.

UPDATE treasury.data_sources SET
  fiscal_years = ARRAY[2025, 2026, 2027, 2028],
  column_mapping = column_mapping || jsonb_build_object(
    'note',
    'Dataset xdgd-c79v holds every Annual Appropriation Ordinance figure from FY2010 '
    || 'forward, so every row is an ADOPTED appropriation, not a proposal. SF budgets '
    || 'in two-year cycles: in the SECOND year of a cycle, enterprise departments do '
    || 'not submit departmental detail and their figures arrive as high-level '
    || 'estimates instead (publisher''s own wording). FY2028 is such a year - 7,107 '
    || 'spending rows against FY2026''s 24,048 - so its total is the adopted '
    || 'appropriation while the detail beneath it is thinner. FY2010-FY2024 are '
    || 'available and not yet loaded.'
  ),
  updated_at = now()
WHERE dataset_id = 'xdgd-c79v'
  AND name IN ('San Francisco Operating Budget', 'San Francisco Revenue Budget');

-- Refuse to have touched anything else, and refuse to have widened only one direction:
-- the spending and revenue sources read the SAME dataset and must stay in step, or the
-- Money In and Money Out views would cover different years.
DO $$
DECLARE v_n int; v_years int;
BEGIN
  SELECT count(*) INTO v_n
  FROM treasury.data_sources
  WHERE dataset_id = 'xdgd-c79v'
    AND fiscal_years @> ARRAY[2025, 2026, 2027, 2028]
    AND array_length(fiscal_years, 1) = 4;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 San Francisco sources on FY2025-2028, found %', v_n;
  END IF;

  SELECT count(DISTINCT fiscal_years) INTO v_years
  FROM treasury.data_sources WHERE dataset_id = 'xdgd-c79v';
  IF v_years <> 1 THEN
    RAISE EXCEPTION 'The two San Francisco sources disagree on fiscal_years';
  END IF;
END $$;

-- ── Declare the basis on the source itself ──────────────────────────────────────
--
-- The FY2025/FY2026 rows carry basis='adopted', set by the SCOPE-02 classification
-- pass. Rows created by a later sync do NOT: treasury_sync_budget_tree defaults an
-- INSERT to 'unknown' unless the caller passes p_basis, so FY2027 and FY2028 landed as
-- "Basis not established" while FY2025 and FY2026 beside them read "Adopted budget" —
-- the same source, two different labels, and the chip and the spent/budgeted verb both
-- read that field.
--
-- Backfilling those two rows would fix today and break again on the next new year.
-- Instead the source now DECLARES its basis, and both loaders pass it through
-- (`cm.basis`, with a wide-format source's per-year basis taking precedence). Every
-- future SF fiscal year is labelled on arrival.
--
-- The evidence is the publisher's own column note, quoted in full:
--   budget: "The amount published in the City and County of San Francisco's Annual
--            Appropriation Ordinance."
-- and the AAO is what the Board of Supervisors approves. That is an adopted budget.
UPDATE treasury.data_sources
   SET column_mapping = column_mapping || jsonb_build_object('basis', 'adopted'),
       updated_at = now()
 WHERE dataset_id = 'xdgd-c79v'
   AND name IN ('San Francisco Operating Budget', 'San Francisco Revenue Budget');

DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM treasury.data_sources
  WHERE dataset_id = 'xdgd-c79v' AND column_mapping->>'basis' = 'adopted';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'Expected both San Francisco sources to declare basis=adopted, found %', v_n;
  END IF;
END $$;
