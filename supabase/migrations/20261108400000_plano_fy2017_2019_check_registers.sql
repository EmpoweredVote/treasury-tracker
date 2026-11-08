-- Plano: three more check-register years, available by editing two dates.
--
-- ⚠⚠ THE SOURCE URL IS A PARAMETERISED DATE RANGE, NOT A FILE. Plano's
-- `checkregister.plano.gov/ReportExport.aspx` takes `SD`/`ED`, so every year
-- the system holds is reachable by changing them. TT held FY2020-FY2025 and
-- nobody had asked the endpoint for anything earlier. Probed 2026-11-08:
--
--     FY2013  header only, 116 bytes      FY2017  14,771,934 bytes
--     FY2016  header only, 116 bytes      FY2018  14,258,656 bytes
--                                         FY2019  11,680,851 bytes
--
-- So Plano's history begins at FY2017 and TT was missing all three of its
-- earliest years. A coverage figure measures a DECLARATION, not a publisher.
--
--     FY      parsed      distinct    stored            total
--     2017    77,403      71,376      71,376    $445,237,328.32
--     2018    74,680      68,435      68,435    $572,679,482.87
--     2019    61,143      59,836      59,836    $461,530,302.77
--
-- Verified by re-parsing the publisher's own file with the repo's parser and
-- comparing: row for row and cent for cent, delta $0.00 on all three.
--
-- ── ⚠⚠⚠ THE DEDUP COLLAPSES A LOT, AND IT IS RIGHT ────────────────────
--
--     FY2017  6,027 duplicate lines   $44,345,825.02
--     FY2018  6,245 duplicate lines  $112,762,849.77
--     FY2019  1,307 duplicate lines    $4,109,217.67
--
-- Those are EXACT duplicate rows in the publisher's export, and Plano uses the
-- default CONTENT dedup (not `occurrence`), so they collapse. $112.7M in one
-- year looks alarming and is not: see reference row_dedup_and_export_doubling
-- and scripts/lib/doubledExportDays.mjs — a publisher that exports a day twice
-- doubles its own Total row too, so the Total cannot catch it and the dedup is
-- the only thing that does.
--
-- ⚠ `hashRow` hashes the WHOLE PARSED ROW — all ten columns, including
-- `payeename`, `documentnumber`, `accountname` and `batchnumber`, none of
-- which Plano's column_mapping uses. It is NOT a hash of the mapped columns.
-- I assumed otherwise while checking this and briefly "found" thousands of
-- wrongly-collapsed rows that do not exist. Two payments differing only in
-- document number survive as two rows.
--
-- ⭐ 13 rows across the three years are collapsed although their RAW TEXT
-- differs. Every one differs only by leading whitespace inside `description`
-- — " photos" beside "photos", " Visit Plano" beside "Visit Plano" — with
-- date, fund, cost centre, batch number, document number, payee and amount
-- byte-identical. The parser trims, so they hash the same. That is the
-- publisher writing one payment twice with inconsistent padding; keeping both
-- would double-count.
--
-- ⚠ Keyed FUND-FIRST (`link_key_columns` = fund, department), matching
-- 20261107210529_plano_keys_on_fund_first.sql. Only a LEADING segment is
-- matchable in the drill-down, so the key order decides which axis a reader
-- can ever be given. Fiscal year starts in MONTH 10.
--
-- ⚠⚠ `verify:source-row-coverage` DOES NOT SEE THESE. That gate filters
-- `api_type = 'socrata'`; Plano is `xlsx_download`. The tree gate does cover
-- them — `^Plano Check Register FY[0-9]{4}$` enrols them automatically, and
-- all three reported 67/70/67 keys against 67/70/67 roots. The xlsx coverage
-- gap predates this change and is not closed by it.
insert into treasury.data_sources (
  municipality_id, name, description, api_type, base_url, dataset_id,
  dataset_type, column_mapping, fiscal_year_start_month, fiscal_years,
  default_filters, is_enabled, sync_frequency, priority
)
select
  'e02a955e-74af-4643-8f69-aa203d4f315b',
  format('Plano Check Register FY%s', y),
  format('Plano accounts-payable check register, fiscal year %s (Oct %s - Sep %s).', y, y - 1, y),
  'xlsx_download',
  format('https://checkregister.plano.gov/ReportExport.aspx?ET=AP&Detail=T&A=-1&C=-1&F=-1&P=-1&PS=&SD=9/30/%s&ED=10/1/%s', y - 1, y),
  format('fy%s', y),
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
  array[y],
  '{}'::jsonb, true, 'manual', 0
from unnest(array[2017, 2018, 2019]) as y;

-- ⚠ Guards the two things that would silently change what a reader can see:
-- the fund-first key order, and the October fiscal year.
do $$
declare n int;
begin
  select count(*) into n from treasury.data_sources
   where name in ('Plano Check Register FY2017','Plano Check Register FY2018','Plano Check Register FY2019')
     and fiscal_year_start_month = 10
     and column_mapping->'link_key_columns' = jsonb_build_array('fund_column','department_column');
  if n <> 3 then
    raise exception 'expected 3 Plano sources keyed fund-first on an October year, found %', n;
  end if;
end $$;
