-- Maryland Comptroller — the FY2022 ACFR the Comptroller retired.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT HAPPENED: A BACK-CATALOGUE PURGE, NOT A RENAME AND NOT A CASE CHANGE
-- ─────────────────────────────────────────────────────────────────────────────
-- One of four MD citations is dead and three are fine, which is the finding.
-- Measured 2026-11-10 with HEAD *and* a real GET (so this is not #376's
-- HEAD-404 defect), all from the same /content/dam/ directory:
--
--     ACFR2022.pdf   HEAD 404   GET 404
--     ACFR2023.pdf   HEAD 200   GET 206 application/pdf
--     acfr2024.pdf   HEAD 200   GET 206 application/pdf
--     acfr2025.pdf   HEAD 200   GET 206 application/pdf
--
-- The publisher is UP and the folder still serves. The Comptroller's own ACFR
-- index (reports/annual-comprehensive-financial-report-acfr.html, 200) lists
-- exactly three years — FY2023, FY2024, FY2025. FY2022 is off the catalogue.
--
-- ⚠ IT IS NOT THE FY2024 CASE CHANGE. `acfr2022.pdf` 404s too, and so do
-- `ACFR_2022.pdf`, `acfr-2022.pdf`, `ACFR2022.PDF` and `acfr2022-1.pdf` — each
-- probed INDIVIDUALLY rather than inferred from the case rule, which is the
-- South Carolina lesson (#374) applied before guessing instead of after. The
-- proof that case cannot be extrapolated here: `ACFR2023.pdf` is live
-- upper-case while `acfr2023.pdf` 404s.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐ THE REPLACEMENT IS LIVE, NOT ARCHIVED
-- ─────────────────────────────────────────────────────────────────────────────
-- Maryland files its Single Audit with the Federal Audit Clearinghouse, and
-- that filing OPENS with the ACFR — page 1 reads "ANNUAL COMPREHENSIVE
-- FINANCIAL REPORT , STATE OF MARYLAND / FOR THE YEAR ENDED JUNE 30, 2022" —
-- with the single audit appended (370 pp against the ACFR's 193).
--
-- ⚠⚠ FAC IS NOT AUTOMATICALLY THE ACFR. Cornelius OR's FY2022 filing turned out
-- to be a 3-page CSLFRF compliance examination with zero fund statements (#376).
-- This one was downloaded, read and measured before it was believed:
--
--     23,672,330 bytes · %%EOF intact · 370 pages
--     front matter names the ENTITY and the PERIOD
--     EIN 526002033, auditee "STATE OF MARYLAND", fy_end_date 2022-06-30
--
-- ⭐⭐ VERIFIED TO THE DOLLAR, AND RE-DERIVED. All 28 figures TT publishes for
-- FY2022 were found inside the governmental-funds operating statement — not
-- merely somewhere in 2.2 million characters, but inside the statement region
-- itself, so a number repeated in the MD&A cannot vouch for a fund figure. And
-- the sixteen expenditure components RE-DERIVE the publisher's own total:
--
--     sum(16 components) = 45,744,096 (thousands)
--     printed total      = 45,744,096
--     delta              = $0
--
-- ⚠ TT stores "Interest and other investment income" at 0 for FY2022 because the
-- statement prints a NET LOSS of (275,992). That is recorded in the category
-- label rather than hidden, and the loss figure was confirmed present too.
--
-- ⚠ THE ARCHIVE WAS THE RUNNER-UP, NOT THE CHOICE. web.archive.org holds two
-- captures of the Comptroller's own file (both 18,076,907 B, %%EOF, 193 pp,
-- identical) and both pass the same 30-figure check. FAC is preferred because it
-- answers 200 TODAY; the archive rate-limits automated clients and would probe
-- `unreachable` — the honest verdict for "could not ask", but a worse citation
-- when a live one exists. Compare Cornelius (#376) and Nevada FY2021 (#377),
-- where no live copy existed and the archive was the right answer.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. #372 is the worked example.
-- scripts/processMDAcfr.js and scripts/processMDRevenueAcfr.js BUILD this URL
-- from a template, so both gain a RETIRED_BY_PUBLISHER override in the same
-- commit — otherwise the next run re-mints the dead link, exactly as
-- loadWICMREB.js would have for FY2020-FY2022 (#379).

do $$
declare
  v_rows     int;
  v_budgets  int;
  v_expected int := 2;  -- FY2022 x {operating, revenue}
  v_old text := 'https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/ACFR2022.pdf';
  v_new text := 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000147719';
begin
  -- FENCE 1: the old URL must still be in use.
  select count(*) into v_budgets from treasury.budgets where source_url = v_old;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) citing the retired FY2022 ACFR, found %',
      v_expected, v_budgets;
  end if;

  -- FENCE 2: nothing may already cite the replacement — that would merge
  -- citations rather than repair one.
  select count(*) into v_rows from treasury.budgets where source_url = v_new;
  if v_rows <> 0 then
    raise exception '% budget(s) already cite the replacement URL', v_rows;
  end if;

  -- FENCE 3: ⚠⚠ THE REPAIR MUST LAND ON FY2022 AND NOTHING ELSE. Maryland has
  -- four ACFR years in TT and they differ only by a digit in the filename, so a
  -- predicate one character wrong would repoint a live year at FY2022's
  -- document — a wrong citation that moves no dollar and fails no tie gate.
  select count(*) into v_rows
    from treasury.budgets
   where source_url = v_old and fiscal_year <> 2022;
  if v_rows <> 0 then
    raise exception '% budget(s) cite the FY2022 document under another fiscal year', v_rows;
  end if;

  -- FENCE 4: ⚠ THE THREE LIVE YEARS MUST NOT BE TOUCHED. FY2023/24/25 answer
  -- 200 from the Comptroller and must keep citing the Comptroller directly.
  select count(*) into v_rows
    from treasury.budgets
   where source_url in (
     'https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/ACFR2023.pdf',
     'https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/acfr2024.pdf',
     'https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/acfr2025.pdf'
   );
  if v_rows <> 6 then
    raise exception
      'expected FY2023+FY2024+FY2025 to cover 6 budgets citing the Comptroller, found % — '
      'do NOT proceed: the live years have moved or been rewritten', v_rows;
  end if;

  update treasury.budgets
     set source_url = v_new
   where source_url = v_old;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 5: nothing may still cite the retired document.
  select count(*) into v_rows from treasury.budgets where source_url = v_old;
  if v_rows <> 0 then
    raise exception '% budget(s) still cite the retired FY2022 ACFR', v_rows;
  end if;

  raise notice 'Maryland: re-cited FY2022 across % budget(s); FY2023-FY2025 untouched', v_expected;
end $$;
