-- West Hollywood's four budget sources: correct the mappings and declare year_columns.
--
-- All four were configured against columns that partly do not exist, over fiscal years
-- the datasets do not contain. Verified 2026-08-27 by reading each dataset's own
-- /api/views/<id>.json column list and summing every year column over the SODA API.
--
--   6pse-xeqx  "Budget Expenditure Detail FY17 - 21"   7,913 rows
--              _2017_actuals _2018_actuals _2019_actuals _2020_approved _2021_recommended
--   khr4-cuqj  "Budget Revenue Detail FY17 -21"          618 rows   same five columns
--   xxix-2i77  "Budget Expenditure Detail FY15 - 18"   2,466 rows
--              _2013_actuals _2014_budget _2015_proposed _2016_proposed
--   c3hb-db2f  "Budget Revenue Detail FY15 -18"          264 rows   same four columns
--
-- What was wrong
-- ──────────────
-- 1. The two "FY15-18" sources named `amount_column: "_2018_actuals"`, a column that
--    does not exist in either dataset, and listed fiscal_years [2015,2016,2017,2018]
--    when the real coverage is 2013-2016. Every row would have read 0.
-- 2. c3hb-db2f's hierarchy_columns named `account_category_title`, which that dataset
--    does not have either — its revenue hierarchy is account_major_category /
--    account_sub_category. Every row would have keyed to "Unknown".
-- 3. The two FY17-21 sources had no skip_fy_filter, so the loader emitted
--    `fiscal_year='2020'` against a dataset with no fiscal_year column: HTTP 400.
-- 4. All four named ONE amount column for four or five fiscal years, which is what
--    year_columns now replaces.
-- 5. The FY17-21 pair carried `actual_amount_column: "_2019_actuals"` at the top
--    level — a single hard-coded year that would have been reported as the actual for
--    every year loaded, FY2017's row claiming FY2019's outturn.
--
-- What is deliberately NOT loaded
-- ───────────────────────────────
-- `_2015_proposed`, `_2016_proposed` and `_2021_recommended`. A proposal the council
-- never adopted is neither an actual nor an adopted budget; treasury.budgets.basis has
-- no value for it, and inventing one would put an unconfirmed figure on the same chart
-- line as audited ones. Six of the nine available years load; three do not.
--
-- fund_scope stays 'unknown', deliberately
-- ────────────────────────────────────────
-- These totals are GROSS OF INTERFUND TRANSFERS and are not comparable to the CA State
-- Controller rows the same city already has. FY2019 expenditure is $197.6M here against
-- SCO's $149.4M, because "Other Financing Uses" — transfers out — is $33.5M of it; FY2014
-- revenue is $244.7M against SCO's $130.7M, 48% of it "Other Financing Sources". Both
-- publishers are right about different questions. Claiming all_funds would assert a
-- comparability that does not hold, so the scope stays honestly unestablished.
--
-- Source names are left exactly as they are, including "FY15-18" on the datasets that
-- actually hold FY2013-2016 figures. That is the publisher's own dataset title; the
-- house rule is to transcribe what a publisher says rather than correct it silently,
-- and the note field now records the real coverage.

-- ── 6pse-xeqx — expenditure, FY2017-2020 ────────────────────────────────────────
UPDATE treasury.data_sources SET
  fiscal_years = ARRAY[2017, 2018, 2019, 2020],
  column_mapping = jsonb_build_object(
    'note', 'WIDE FORMAT: one row per line item, one column per fiscal year, and no '
         || 'fiscal_year column to filter on — hence skip_fy_filter. Publisher title: '
         || '"Budget Expenditure Detail FY17 - 21". Available columns: _2017_actuals, '
         || '_2018_actuals, _2019_actuals, _2020_approved, _2021_recommended. '
         || '_2021_recommended is excluded on purpose: never adopted, so it is neither '
         || 'an actual nor an adopted budget. Totals are gross of interfund transfers '
         || '("Other Financing Uses"), so fund_scope is not all_funds.',
    'fund_column', 'fund_title',
    'skip_fy_filter', true,
    'hierarchy_columns', jsonb_build_array(
      'fund_title', 'department_title', 'division_title', 'account_category_title'),
    'description_column', 'account_title',
    'expense_type_column', 'account_category_title',
    'year_columns', jsonb_build_object(
      '2017', jsonb_build_object('amount_column', '_2017_actuals',  'basis', 'actual'),
      '2018', jsonb_build_object('amount_column', '_2018_actuals',  'basis', 'actual'),
      '2019', jsonb_build_object('amount_column', '_2019_actuals',  'basis', 'actual'),
      '2020', jsonb_build_object('amount_column', '_2020_approved', 'basis', 'adopted')
    )
  ),
  updated_at = now()
WHERE dataset_id = '6pse-xeqx';

-- ── khr4-cuqj — revenue, FY2017-2020 ────────────────────────────────────────────
UPDATE treasury.data_sources SET
  fiscal_years = ARRAY[2017, 2018, 2019, 2020],
  column_mapping = jsonb_build_object(
    'note', 'WIDE FORMAT, same shape as 6pse-xeqx. Publisher title: "Budget Revenue '
         || 'Detail FY17 -21". _2021_recommended excluded — never adopted. Totals are '
         || 'gross of interfund transfers ("Other Financing Sources").',
    'fund_column', 'fund_title',
    'skip_fy_filter', true,
    'hierarchy_columns', jsonb_build_array('fund_title', 'account_category_title'),
    'description_column', 'account_title',
    'year_columns', jsonb_build_object(
      '2017', jsonb_build_object('amount_column', '_2017_actuals',  'basis', 'actual'),
      '2018', jsonb_build_object('amount_column', '_2018_actuals',  'basis', 'actual'),
      '2019', jsonb_build_object('amount_column', '_2019_actuals',  'basis', 'actual'),
      '2020', jsonb_build_object('amount_column', '_2020_approved', 'basis', 'adopted')
    )
  ),
  updated_at = now()
WHERE dataset_id = 'khr4-cuqj';

-- ── xxix-2i77 — expenditure, FY2013-2014 (NOT FY2015-2018) ──────────────────────
UPDATE treasury.data_sources SET
  fiscal_years = ARRAY[2013, 2014],
  column_mapping = jsonb_build_object(
    'note', 'WIDE FORMAT. Publisher title says "FY15 - 18" but the dataset holds '
         || '_2013_actuals, _2014_budget, _2015_proposed and _2016_proposed — FY2013-2016, '
         || 'not FY2015-2018. The two proposed years are excluded: never adopted. The '
         || 'previous mapping named _2018_actuals, which does not exist in this dataset.',
    'fund_column', 'fund_title',
    'skip_fy_filter', true,
    'hierarchy_columns', jsonb_build_array(
      'fund_title', 'department_title', 'division_title', 'account_category_title'),
    'description_column', 'account_title',
    'expense_type_column', 'account_category_title',
    'year_columns', jsonb_build_object(
      '2013', jsonb_build_object('amount_column', '_2013_actuals', 'basis', 'actual'),
      '2014', jsonb_build_object('amount_column', '_2014_budget',  'basis', 'adopted')
    )
  ),
  updated_at = now()
WHERE dataset_id = 'xxix-2i77';

-- ── c3hb-db2f — revenue, FY2013-2014 (NOT FY2015-2018) ──────────────────────────
UPDATE treasury.data_sources SET
  fiscal_years = ARRAY[2013, 2014],
  column_mapping = jsonb_build_object(
    'note', 'WIDE FORMAT. Publisher title says "FY15 -18"; real coverage is FY2013-2016 '
         || '(_2013_actuals, _2014_budget, _2015_proposed, _2016_proposed), proposed years '
         || 'excluded. This dataset has NO account_category_title — the previous mapping '
         || 'named it and would have keyed every row to "Unknown". Its revenue hierarchy '
         || 'is account_major_category / account_sub_category.',
    'fund_column', 'fund_title',
    'skip_fy_filter', true,
    'hierarchy_columns', jsonb_build_array(
      'fund_title', 'account_major_category', 'account_sub_category'),
    'description_column', 'account_title',
    'year_columns', jsonb_build_object(
      '2013', jsonb_build_object('amount_column', '_2013_actuals', 'basis', 'actual'),
      '2014', jsonb_build_object('amount_column', '_2014_budget',  'basis', 'adopted')
    )
  ),
  updated_at = now()
WHERE dataset_id = 'c3hb-db2f';

-- Refuse to have touched anything unexpected: exactly four rows, all West Hollywood.
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM treasury.data_sources ds
  JOIN treasury.municipalities m ON m.id = ds.municipality_id
  WHERE ds.dataset_id IN ('6pse-xeqx', 'khr4-cuqj', 'xxix-2i77', 'c3hb-db2f')
    AND m.name = 'West Hollywood'
    AND ds.column_mapping ? 'year_columns';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'Expected 4 West Hollywood sources carrying year_columns, found %', v_n;
  END IF;
END $$;
