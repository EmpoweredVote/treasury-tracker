-- Wisconsin DOR CMREB — the three bulletins the Department retired, FY2020–FY2022.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT HAPPENED: THE CATALOGUE SHRANK, THE TEMPLATE DID NOT BREAK
-- ─────────────────────────────────────────────────────────────────────────────
-- Five CMREB citations exist (FY2020–FY2024). Three are dead and two are fine,
-- which is itself the finding: this is not a path change, a rename or a CMS
-- move. The URL template still works — FY2023 and FY2024 answer 200
-- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` from
-- exactly the form the loader builds. What changed is WHICH YEARS DOR PUBLISHES.
--
-- Measured 2026-11-10, each asked with HEAD *and* a real GET (so this is not
-- #376's HEAD-404 defect):
--
--     CMREB2020.xlsx   HEAD 404   GET 404
--     CMREB2021.xlsx   HEAD 404   GET 404
--     CMREB2022.xlsx   HEAD 404   GET 404
--     CMREB2023.xlsx   HEAD 200   GET 206 …spreadsheetml.sheet
--     CMREB2024.xlsx   HEAD 200   GET 206 …spreadsheetml.sheet
--
-- The publisher is UP and the folder still serves. The DOR's own CMRE page
-- (Pages/Report/county-municipal-revenues-expenditures.aspx) is a SharePoint
-- list, and its embedded inventory names exactly four files: cmreb2023.pdf,
-- cmreb2023.xlsx, cmreb2024.pdf, CMREB2024.xlsx. FY2020–FY2022 are not on it.
--
-- ⚠ No live variant exists. lower-case, .XLSX, .xls, .pdf, CMREB20, CMREB_2020
-- and 2020CMREB were each probed individually and all 404 — the South Carolina
-- lesson applied before guessing a rule rather than after.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐⭐⭐ THESE WERE NOT MERELY "REACHABLE". THEY WERE RE-DERIVED.
-- ─────────────────────────────────────────────────────────────────────────────
-- #377 and #378 raised the bar to "find the exact published figure inside the
-- replacement". A workbook allows something stronger, and the repo already had
-- the tool: scripts/rederiveWICMREB.py reads the workbook in a different
-- language with a different XLSX reader (openpyxl, not ExcelJS), rebuilds the
-- column groupings from the sheet's OWN printed subtotals rather than copying
-- the loader's registry, pulls what production holds over PostgREST, and diffs
-- totals, category counts and every category amount. Run against these three
-- archived captures plus the two live workbooks:
--
--     rows compared: 20/20
--     ALL CHECKS PASS — every re-derived figure ties to production at exactly $0
--
-- including, for the three retired years:
--
--     Dane County  2020 rev 555,798,846  ops 604,355,140   Δ$0
--     Dane County  2021 rev 582,556,509  ops 623,213,949   Δ$0
--     Dane County  2022 rev 612,639,637  ops 638,105,080   Δ$0
--     Madison      2020 rev 398,629,739  ops 452,661,706   Δ$0
--     Madison      2021 rev 444,175,651  ops 505,392,885   Δ$0
--     Madison      2022 rev 506,399,313  ops 539,027,518   Δ$0
--
-- That is not "the document contains our number"; it is "this workbook
-- regenerates every one of our numbers, category by category, at $0 delta".
-- The archived capture is the DOR's file.
--
-- ⚠ The cost, accepted knowingly: web.archive.org rate-limits automated
-- clients, so these three will probe 429 → `unreachable` rather than green.
-- That is the honest verdict for "could not ask today", a reader with a browser
-- can still open them, and it beats `dead`, which orders a repair that cannot
-- be performed. Same trade as Cornelius (#376) and Nevada FY2021 (#377).
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. #372 is the worked example.
-- scripts/loadWICMREB.js BUILDS this URL from a template rather than holding a
-- table, so it gains a RETIRED_BY_PUBLISHER override — otherwise the next run
-- would re-mint all three dead links. Two tests pin it.

do $$
declare
  v_rows     int;
  v_budgets  int;
  v_expected int := 12;  -- 3 workbooks x {Madison, Dane County} x {operating, revenue}
begin
  create temp table wi_citation_fix (
    old_url text primary key,
    new_url text not null
  ) on commit drop;

  insert into wi_citation_fix (old_url, new_url) values
    ('https://www.revenue.wi.gov/SLFReportscotvc/CMREB2020.xlsx',
     'https://web.archive.org/web/20250413192241id_/https://www.revenue.wi.gov/SLFReportscotvc/CMREB2020.xlsx'),
    ('https://www.revenue.wi.gov/SLFReportscotvc/CMREB2021.xlsx',
     'https://web.archive.org/web/20250414194705id_/https://www.revenue.wi.gov/SLFReportscotvc/CMREB2021.xlsx'),
    ('https://www.revenue.wi.gov/SLFReportscotvc/CMREB2022.xlsx',
     'https://web.archive.org/web/20250415104738id_/https://www.revenue.wi.gov/SLFReportscotvc/CMREB2022.xlsx');

  select count(*) into v_rows from wi_citation_fix;
  if v_rows <> 3 then
    raise exception 'expected 3 citation pairs, built %', v_rows;
  end if;

  -- FENCE 1: every old URL must still be in use.
  select count(*) into v_rows
    from wi_citation_fix f
   where not exists (select 1 from treasury.budgets b where b.source_url = f.old_url);
  if v_rows <> 0 then
    raise exception '% of 3 old citation(s) are no longer present — refusing to guess', v_rows;
  end if;

  -- FENCE 2: refuse to collapse two citations into one. The replacements differ
  -- only by a year and a timestamp, so a copy-paste slip would silently point
  -- two fiscal years at one workbook.
  select count(*) into v_rows from (
    select new_url from wi_citation_fix group by new_url having count(*) > 1
  ) d;
  if v_rows <> 0 then
    raise exception '% replacement URL(s) are duplicated across fiscal years', v_rows;
  end if;

  select count(*) into v_rows
    from treasury.budgets b
    join wi_citation_fix f on b.source_url = f.new_url;
  if v_rows <> 0 then
    raise exception '% budget(s) already cite a replacement URL — would merge citations', v_rows;
  end if;

  -- FENCE 3: each replacement must archive the DOR's OWN url for its OWN year.
  select count(*) into v_rows
    from wi_citation_fix
   where new_url !~ '^https://web\.archive\.org/web/[0-9]{14}id_/https://www\.revenue\.wi\.gov/SLFReportscotvc/CMREB[0-9]{4}\.xlsx$'
      or right(new_url, 9) <> right(old_url, 9);   -- 'CMREBnnnn.xlsx' tail must match
  if v_rows <> 0 then
    raise exception '% replacement(s) do not archive the same DOR file/year', v_rows;
  end if;

  -- FENCE 4: the blast radius must be exactly the 12 Madison + Dane budgets.
  select count(*) into v_budgets
    from treasury.budgets b
    join wi_citation_fix f on b.source_url = f.old_url;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) to repair, found %', v_expected, v_budgets;
  end if;

  -- FENCE 5: ⚠ THE TWO LIVE YEARS MUST NOT BE TOUCHED. FY2023 and FY2024 answer
  -- 200 from the publisher and must keep citing the publisher directly.
  select count(*) into v_rows
    from treasury.budgets
   where source_url in (
     'https://www.revenue.wi.gov/SLFReportscotvc/CMREB2023.xlsx',
     'https://www.revenue.wi.gov/SLFReportscotvc/CMREB2024.xlsx'
   );
  if v_rows <> 8 then
    raise exception
      'expected FY2023+FY2024 to cover 8 budgets citing the publisher, found % — '
      'do NOT proceed: the live years have moved or been rewritten', v_rows;
  end if;

  update treasury.budgets b
     set source_url = f.new_url
    from wi_citation_fix f
   where b.source_url = f.old_url;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 6: nothing may still cite a retired CMREB workbook directly.
  select count(*) into v_rows
    from treasury.budgets
   where source_url in (
     'https://www.revenue.wi.gov/SLFReportscotvc/CMREB2020.xlsx',
     'https://www.revenue.wi.gov/SLFReportscotvc/CMREB2021.xlsx',
     'https://www.revenue.wi.gov/SLFReportscotvc/CMREB2022.xlsx'
   );
  if v_rows <> 0 then
    raise exception '% budget(s) still cite a retired CMREB workbook', v_rows;
  end if;

  raise notice 'Wisconsin: re-cited % retired workbook(s) across % budget(s); FY2023+FY2024 untouched', 3, v_expected;
end $$;
