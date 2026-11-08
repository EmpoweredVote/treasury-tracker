-- McKinney and Plano: the FY2026 check registers, closed and unheld.
--
-- ⚠⚠⚠ ASKED THE PUBLISHERS WHAT THEY HAVE EVER SERVED, not what TT declares.
-- PR #360 gave TT a gate that compares every xlsx budget to its publisher's
-- file, and it went green on all 22 — because it iterates the sources TT has
-- DECLARED. A year a publisher serves that TT never created a data_source for
-- is invisible to it. That is the blind spot which hid eight LA years and two
-- West Hollywood years, and it was hiding two more.
--
-- Probed 2026-11-08, from the publishers' own listings:
--
--   McKinney  Archive.aspx?AMID=39 ("Check Register") lists FY22, FY23, FY24,
--             FY25 and FY26. TT held four of the five. FY26 is ADID 2849.
--             ⚠ Nothing older exists: the category BEGINS at FY22, so TT was
--             not missing early McKinney years — the city has none to give.
--   Plano     ReportExport.aspx takes SD/ED date parameters, so FY2026 was one
--             URL edit away, exactly as FY2017-FY2019 were in #358.
--
-- ⚠ ALL THREE TEXAS CITIES RUN OCTOBER-SEPTEMBER, so FY2026 ended 2026-09-30
-- and is a CLOSED, COMPLETE year — not a live one. Frisco's FY2026 last
-- payment is 2026-09-30 and McKinney's and Plano's both land in late September.
-- The live year is FY2027, which is deliberately NOT loaded here for the same
-- reason LA FY2027 is not: a year that grows weekly re-triggers
-- verify:out-of-period every month.
--
-- ⚠⚠ McKinney keeps `dedup: 'occurrence'` — four police Tahoes at $52,962.25
-- on one purchase order are four payments, not one — which also means the
-- doubled-export guard in scripts/lib/xlsxPolicies.mjs must pass before this
-- year can load at all. Plano keeps the default CONTENT dedup and is keyed
-- FUND-FIRST, matching 20261107210529_plano_keys_on_fund_first.sql: only a
-- LEADING key segment is matchable in the drill-down, so the order decides
-- which axis a reader can ever be given.
--
-- ⚠ Both enrol in the transaction-tree gate automatically — it matches on
-- `^McKinney Check Register FY(\d{4})$` and `^Plano Check Register FY(\d{4})$`
-- — and both must be added to scripts/data/xlsxRowCoverage.mjs, or
-- verify:xlsx-row-coverage will fail them as undeclared. That is the gate
-- working: a budget nobody registered is a budget nobody checked.

insert into treasury.data_sources (
  municipality_id, name, description, api_type, base_url, dataset_id,
  dataset_type, column_mapping, fiscal_year_start_month, fiscal_years,
  default_filters, is_enabled, sync_frequency, priority
) values (
  'a7e3459c-cb55-4f74-9ba9-f40e23323767',
  'McKinney Check Register FY2026',
  'McKinney accounts-payable check register, fiscal year 2026 (Oct 2025 - Sep 2026).',
  'xlsx_download',
  -- ⚠ mckinneytexas.org's WAF refuses Node with a flat 403 and lets curl
  -- through; downloadXLSX already falls back. Expected every run, not a fault.
  'https://www.mckinneytexas.org/Archive.aspx?ADID=2849',
  'fy2026',
  'transactions',
  jsonb_build_object(
    'dedup', 'occurrence',
    'date_column', 'payment_date',
    'amount_column', 'net_amount',
    'vendor_column', 'description_1',
    'department_column', 'department',
    'description_column', 'description_2',
    'invoice_number_column', 'payment_number'
  ),
  10,
  array[2026],
  -- ⚠ Seeded enabled here and DISABLED by the very next migration, because
  -- probing the file is what revealed it covers only eleven months. The two
  -- steps are kept apart so the record shows what was learned and when, rather
  -- than pretending the hold was foreseen.
  '{}'::jsonb, true, 'monthly', 0
);

insert into treasury.data_sources (
  municipality_id, name, description, api_type, base_url, dataset_id,
  dataset_type, column_mapping, fiscal_year_start_month, fiscal_years,
  default_filters, is_enabled, sync_frequency, priority
) values (
  'e02a955e-74af-4643-8f69-aa203d4f315b',
  'Plano Check Register FY2026',
  'Plano accounts-payable check register, fiscal year 2026 (Oct 2025 - Sep 2026).',
  'xlsx_download',
  'https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/2025&ED=10/1/2026',
  'fy2026',
  'transactions',
  jsonb_build_object(
    'date_column', 'checkdate',
    'fund_column', 'fundname',
    'amount_column', 'amount',
    'link_key_columns', jsonb_build_array('fund_column', 'department_column'),
    'department_column', 'costcentername',
    'description_column', 'description',
    'payment_method_column', 'documenttype'
  ),
  10,
  array[2026],
  '{}'::jsonb, true, 'monthly', 0
);

-- ⚠ Guards the three things that would silently change what a reader can see:
-- McKinney's occurrence dedup, Plano's fund-first key order, and the October
-- fiscal year on both.
do $$
declare n int;
begin
  select count(*) into n from treasury.data_sources
   where name = 'McKinney Check Register FY2026'
     and fiscal_year_start_month = 10
     and column_mapping->>'dedup' = 'occurrence';
  if n <> 1 then
    raise exception 'expected McKinney FY2026 keyed by occurrence on an October year, found %', n;
  end if;

  select count(*) into n from treasury.data_sources
   where name = 'Plano Check Register FY2026'
     and fiscal_year_start_month = 10
     and column_mapping->'link_key_columns' = jsonb_build_array('fund_column','department_column');
  if n <> 1 then
    raise exception 'expected Plano FY2026 keyed fund-first on an October year, found %', n;
  end if;
end $$;
