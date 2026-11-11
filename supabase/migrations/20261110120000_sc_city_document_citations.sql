-- South Carolina cities — the citation was the LANDING PAGE, not the document.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠⚠ WHAT HAPPENED, AND IT IS NOT MAINLY ABOUT DEAD LINKS
-- ─────────────────────────────────────────────────────────────────────────────
-- `loadScCityAcfrs.mjs` wrote `p_source_url: entity.publicationPage` — the
-- city's finance landing page — for EVERY fiscal year, while
-- scCityAcfrEntities.mjs held the exact per-year document the loader had just
-- parsed. Eleven governments, 186 budgets, 93 government-years, each
-- pointing at one page instead of its own audited statements.
--
-- ⭐ THREE OF THOSE PAGES 404 AND REACHED THE REPAIR BACKLOG (Charleston,
-- North Charleston, Greenville). THE OTHER EIGHT ANSWER 200 AND ARE EXACTLY AS
-- WRONG. A landing page carries no file extension, so `citationShape` asserts
-- nothing about its content-type and a themed index passes as a citation.
-- verify:source-urls could never have found them — only reading the loader could.
-- ⛔ Repairing only the three dead ones would have left eight cities citing a
-- page while LOOKING fixed, which is the Milledgeville rule in reverse.
--
-- ⚠ The pattern was already right in this repo: Columbia and Myrtle Beach,
-- loaded earlier from scAcfrSources.mjs, cite the per-year FAC PDF. Wave 1 lost
-- it and the loss propagated through five waves. Those two are NOT touched here
-- and FENCE 6 proves it.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐⭐⭐ NOT "REACHABLE", NOT "CONTAINS OUR NUMBER" — BYTE-IDENTICAL.
-- ─────────────────────────────────────────────────────────────────────────────
-- #377 asked that the exact published figure be found inside the replacement;
-- #379 asked that the file re-derive every figure. South Carolina allows the
-- strongest claim of the campaign, because the original fetch left a manifest
-- recording, per fiscal year, the URL, the byte count, the page count and the
-- **sha256 of the document that was actually parsed**.
--
-- So the question was not whether the replacement contains TT's figures but
-- whether it IS the same document. Every URL below was downloaded fresh from
-- the publisher on 2026-11-10 and its digest compared:
--
--     documents compared: 99/99
--     loaded government-years citing a landing page: 93
--     of those, proven byte-identical at the replacement url: 93
--
-- ⚠ The cached PDFs under _acfr-work/ are OUR copy and prove nothing about a
-- URL. Every byte compared was fetched from the publisher in that run.
--
-- Independently, FAC's own metadata was asked for all 92 federal filings:
-- auditee EIN, state and fy_end_date match the registry for every one.
-- ⚠⚠ THE EIN IS THE JOIN, NEVER THE NAME — 576000226 is the City of Charleston
-- and 576000227 is its Commissioners of Public Works, one digit apart.
-- ⚠ The period check is PER ENTITY-YEAR: Charleston runs January, and
-- Summerville moved from January to July inside the window, so a single
-- per-entity month reports two correct filings as mismatches.
--
-- Blast radius, by government:
--   Charleston            20 budgets
--   Florence              20 budgets
--   Goose Creek           12 budgets
--   Greenville            20 budgets
--   Hilton Head Island    18 budgets
--   Mount Pleasant        16 budgets
--   North Charleston       8 budgets
--   Rock Hill             20 budgets
--   Spartanburg           20 budgets
--   Summerville           12 budgets
--   Sumter                20 budgets
--
-- ⚠ 1 year is self-published rather than federal: Hilton Head Island FY2020 has
-- no Single Audit filing under its EIN and the town publishes that year itself.
-- Nothing may rebuild a FAC URL for it, so it keeps the town's own PDF.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. #372 is the worked example. The loader
-- is corrected in the same commit — `scCityDocumentFor` is now the single
-- resolver, used by BOTH the fetcher and the citation so they cannot drift
-- apart again, and four tests pin it.

do $$
declare
  v_rows     int;
  v_budgets  int;
  v_expected int := 186;
  v_pairs    int := 93;
begin
  create temp table sc_citation_fix (
    old_url text not null,
    fiscal_year int not null,
    new_url text not null,
    primary key (old_url, fiscal_year)
  ) on commit drop;

  insert into sc_citation_fix (old_url, fiscal_year, new_url) values
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2016, 'https://app.fac.gov/dissemination/report/pdf/2016-12-CENSUS-0000170474'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2017, 'https://app.fac.gov/dissemination/report/pdf/2017-12-CENSUS-0000170474'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-12-CENSUS-0000170474'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-12-CENSUS-0000170474'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-12-CENSUS-0000170474'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-12-CENSUS-0000170474'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-12-CENSUS-0000170474'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-12-GSAFAC-0000058413'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-12-GSAFAC-0000394878'),
    ('https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-12-GSAFAC-0000427683'),
    ('https://www.cityofflorencesc.gov/finance-department', 2016, 'https://app.fac.gov/dissemination/report/pdf/2016-06-CENSUS-0000170511'),
    ('https://www.cityofflorencesc.gov/finance-department', 2017, 'https://app.fac.gov/dissemination/report/pdf/2017-06-CENSUS-0000170511'),
    ('https://www.cityofflorencesc.gov/finance-department', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000170511'),
    ('https://www.cityofflorencesc.gov/finance-department', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000170511'),
    ('https://www.cityofflorencesc.gov/finance-department', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-06-CENSUS-0000170511'),
    ('https://www.cityofflorencesc.gov/finance-department', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000170511'),
    ('https://www.cityofflorencesc.gov/finance-department', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000170511'),
    ('https://www.cityofflorencesc.gov/finance-department', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000019341'),
    ('https://www.cityofflorencesc.gov/finance-department', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000356681'),
    ('https://www.cityofflorencesc.gov/finance-department', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000397355'),
    ('https://www.cityofgoosecreek.com/departments/finance', 2016, 'https://app.fac.gov/dissemination/report/pdf/2016-12-CENSUS-0000170470'),
    ('https://www.cityofgoosecreek.com/departments/finance', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-12-CENSUS-0000170470'),
    ('https://www.cityofgoosecreek.com/departments/finance', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-12-CENSUS-0000170470'),
    ('https://www.cityofgoosecreek.com/departments/finance', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-12-GSAFAC-0000044988'),
    ('https://www.cityofgoosecreek.com/departments/finance', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-12-GSAFAC-0000374202'),
    ('https://www.cityofgoosecreek.com/departments/finance', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-12-GSAFAC-0000420983'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2016, 'https://app.fac.gov/dissemination/report/pdf/2016-06-CENSUS-0000170520'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2017, 'https://app.fac.gov/dissemination/report/pdf/2017-06-CENSUS-0000170520'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000170520'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000170520'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-06-CENSUS-0000170520'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000170520'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000170520'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000008354'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000344512'),
    ('https://www.greenvillesc.gov/216/Financial-Reports', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000388925'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2017, 'https://app.fac.gov/dissemination/report/pdf/2017-06-CENSUS-0000201322'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000201322'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000201322'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2020, 'https://hiltonheadislandsc.gov/Documents/Government/Town%20Finances/ACFR/ACFRs/FY2020CAFR.pdf'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000201322'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000201322'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000017854'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000347727'),
    ('https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000397601'),
    ('https://www.tompsc.com/191/Financial-Reports', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000170477'),
    ('https://www.tompsc.com/191/Financial-Reports', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000170477'),
    ('https://www.tompsc.com/191/Financial-Reports', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-06-CENSUS-0000170477'),
    ('https://www.tompsc.com/191/Financial-Reports', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000170477'),
    ('https://www.tompsc.com/191/Financial-Reports', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000170477'),
    ('https://www.tompsc.com/191/Financial-Reports', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000009569'),
    ('https://www.tompsc.com/191/Financial-Reports', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000067811'),
    ('https://www.tompsc.com/191/Financial-Reports', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000396704'),
    ('https://www.northcharleston.org/residents/city-departments/finance/', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000170481'),
    ('https://www.northcharleston.org/residents/city-departments/finance/', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000170481'),
    ('https://www.northcharleston.org/residents/city-departments/finance/', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000061099'),
    ('https://www.northcharleston.org/residents/city-departments/finance/', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000397899'),
    ('https://www.cityofrockhill.com/departments/finance', 2016, 'https://app.fac.gov/dissemination/report/pdf/2016-06-CENSUS-0000170607'),
    ('https://www.cityofrockhill.com/departments/finance', 2017, 'https://app.fac.gov/dissemination/report/pdf/2017-06-CENSUS-0000170607'),
    ('https://www.cityofrockhill.com/departments/finance', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000170607'),
    ('https://www.cityofrockhill.com/departments/finance', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000170607'),
    ('https://www.cityofrockhill.com/departments/finance', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-06-CENSUS-0000170607'),
    ('https://www.cityofrockhill.com/departments/finance', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000170607'),
    ('https://www.cityofrockhill.com/departments/finance', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000170607'),
    ('https://www.cityofrockhill.com/departments/finance', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000016463'),
    ('https://www.cityofrockhill.com/departments/finance', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000347380'),
    ('https://www.cityofrockhill.com/departments/finance', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000406755'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2016, 'https://app.fac.gov/dissemination/report/pdf/2016-06-CENSUS-0000195157'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2017, 'https://app.fac.gov/dissemination/report/pdf/2017-06-CENSUS-0000195157'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000195157'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000195157'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-06-CENSUS-0000195157'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000195157'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000195157'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000014256'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000353147'),
    ('https://www.cityofspartanburg.org/287/Annual-Financial-Reports', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000405784'),
    ('https://www.summervillesc.gov/206/Finance', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-12-CENSUS-0000187544'),
    ('https://www.summervillesc.gov/206/Finance', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-12-CENSUS-0000187544'),
    ('https://www.summervillesc.gov/206/Finance', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000187544'),
    ('https://www.summervillesc.gov/206/Finance', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000022779'),
    ('https://www.summervillesc.gov/206/Finance', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000358242'),
    ('https://www.summervillesc.gov/206/Finance', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000408794'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2016, 'https://app.fac.gov/dissemination/report/pdf/2016-06-CENSUS-0000170600'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2017, 'https://app.fac.gov/dissemination/report/pdf/2017-06-CENSUS-0000170600'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2018, 'https://app.fac.gov/dissemination/report/pdf/2018-06-CENSUS-0000170600'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2019, 'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000170600'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2020, 'https://app.fac.gov/dissemination/report/pdf/2020-06-CENSUS-0000170600'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2021, 'https://app.fac.gov/dissemination/report/pdf/2021-06-CENSUS-0000170600'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2022, 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000170600'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2023, 'https://app.fac.gov/dissemination/report/pdf/2023-06-GSAFAC-0000012936'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2024, 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000392867'),
    ('https://www.sumtersc.gov/finance/financial-reports-budgets', 2025, 'https://app.fac.gov/dissemination/report/pdf/2025-06-GSAFAC-0000394755');

  select count(*) into v_rows from sc_citation_fix;
  if v_rows <> v_pairs then
    raise exception 'expected % citation pairs, built %', v_pairs, v_rows;
  end if;

  -- FENCE 1: every (landing page, fiscal year) must still be in use. If a year
  -- has already been repaired or re-loaded, stop rather than guess.
  select count(*) into v_rows
    from sc_citation_fix f
   where not exists (
     select 1 from treasury.budgets b
      where b.source_url = f.old_url and b.fiscal_year = f.fiscal_year);
  if v_rows <> 0 then
    raise exception '% of % (page, year) pair(s) are no longer present — refusing to guess',
      v_rows, v_pairs;
  end if;

  -- FENCE 2: ⚠⚠ ONE DOCUMENT PER GOVERNMENT-YEAR. The replacements differ only
  -- by a report id, so a copy-paste slip would silently point two fiscal years —
  -- or two CITIES — at one audited document, and every tie gate would still pass.
  select count(*) into v_rows from (
    select new_url from sc_citation_fix group by new_url having count(*) > 1
  ) d;
  if v_rows <> 0 then
    raise exception '% replacement URL(s) are reused across government-years', v_rows;
  end if;

  select count(*) into v_rows
    from treasury.budgets b
    join sc_citation_fix f on b.source_url = f.new_url;
  if v_rows <> 0 then
    raise exception '% budget(s) already cite a replacement URL — would merge citations', v_rows;
  end if;

  -- FENCE 3: every replacement must be a FAC report-pdf endpoint or the one
  -- declared self-published PDF. Nothing may wander onto another host, and
  -- nothing may keep a landing-page shape.
  select count(*) into v_rows
    from sc_citation_fix
   where new_url !~ '^https://app\.fac\.gov/dissemination/report/pdf/[0-9]{4}-[0-9]{2}-(CENSUS|GSAFAC)-[0-9]{10}$'
     and new_url !~ '^https://hiltonheadislandsc\.gov/.+\.pdf$';
  if v_rows <> 0 then
    raise exception '% replacement(s) are neither a FAC report pdf nor the declared self-published pdf', v_rows;
  end if;

  -- FENCE 4: exactly one self-published replacement is expected. If this ever
  -- reads 0 the Hilton Head FY2020 year has silently moved to FAC; if it reads
  -- more, a federal filing has been replaced by an issuer URL without a decision.
  select count(*) into v_rows
    from sc_citation_fix
   where new_url !~ '^https://app\.fac\.gov/';
  if v_rows <> 1 then
    raise exception 'expected 1 self-published replacement(s), found %', v_rows;
  end if;

  -- FENCE 5: the blast radius must be exactly the % budgets measured above.
  select count(*) into v_budgets
    from treasury.budgets b
    join sc_citation_fix f
      on b.source_url = f.old_url and b.fiscal_year = f.fiscal_year;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) to repair, found %', v_expected, v_budgets;
  end if;

  -- FENCE 6: ⚠⚠ COLUMBIA AND MYRTLE BEACH ALREADY CITE THE DOCUMENT and are not
  -- part of this repair. They are in the same source family, so a careless
  -- predicate would sweep them in. They must be untouched and already correct.
  select count(*) into v_rows
    from treasury.budgets b
    join treasury.municipalities m on m.id = b.municipality_id
   where m.state = 'SC'
     and m.name in ('Columbia', 'Myrtle Beach')
     and b.source_url like 'https://app.fac.gov/dissemination/report/pdf/%';
  if v_rows < 30 then
    raise exception
      'expected Columbia + Myrtle Beach to already cite FAC documents on at least 30 budgets, found % — '
      'do NOT proceed: the family that was already correct has changed', v_rows;
  end if;

  update treasury.budgets b
     set source_url = f.new_url
    from sc_citation_fix f
   where b.source_url = f.old_url
     and b.fiscal_year = f.fiscal_year;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 7: ⛔ NOT ONE BUDGET MAY STILL CITE A FINANCE LANDING PAGE. This is
  -- the whole point — including the eight cities whose pages answer 200 and
  -- which no gate would ever have flagged.
  select count(*) into v_rows
    from treasury.budgets
   where source_url in (select distinct old_url from sc_citation_fix);
  if v_rows <> 0 then
    raise exception '% budget(s) still cite a South Carolina finance landing page', v_rows;
  end if;

  raise notice 'South Carolina: re-cited % government-year(s) across % budget(s); 11 landing pages retired',
    v_pairs, v_expected;
end $$;
