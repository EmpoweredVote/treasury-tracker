-- Nevada State Controller — all five ACFR citations, FY2019–FY2023.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT HAPPENED: THE CONTROLLER PURGED ITS ENTIRE ACFR BACK-CATALOGUE
-- ─────────────────────────────────────────────────────────────────────────────
-- All five citations 404 — and this time they are genuinely dead. Measured
-- 2026-11-10, each asked with HEAD *and* a real GET, because #376 had just
-- shown that a HEAD 404 proves nothing:
--
--     FY2019  CAFR_Web_2019.pdf      HEAD 404   GET 404
--     FY2020  ACFR_FY2020.pdf        HEAD 404   GET 404
--     FY2021  FY21_ACFR.pdf          HEAD 404   GET 404
--     FY2022  2022_ACFR_Report.pdf   HEAD 404   GET 404
--     FY2023  2023-acfr-report.pdf   HEAD 404   GET 404
--
-- The publisher is UP (200, "Controller"). The folder
-- /siteassets/content/financialrpts/acfr/ still exists. But the Internet
-- Archive's CDX index — i.e. everything this host has EVER served out of that
-- folder — lists FY94All.pdf through FY18All.pdf, 1998-acfr-report.pdf,
-- AcfrReport.pdf and annual-comprehensive-financial-report.pdf, and EVERY ONE
-- OF THEM IS NOW 404. The Controller's own ACFR page lists exactly three
-- documents: FY2022, FY2023, FY2024.
--
-- So two of the five were RENAMED and three were WITHDRAWN.
--
-- ⚠⚠⚠ THE RENAME IS A TRAP, AND IT IS THE SOUTH CAROLINA TRAP AGAIN.
-- FY2022 and FY2023 are now fy-2022-acfr.pdf and fy-2023-acfr.pdf. That reads
-- as a site-wide kebab-case convention, and it is not: fy-2019-acfr.pdf,
-- fy-2020-acfr.pdf and fy-2021-acfr.pdf were each probed INDIVIDUALLY and all
-- three 404. Extrapolating the rule would have swapped three dead links for
-- three different dead links, exactly as de-spacing nearly did for SC in #374.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐⭐ EVERY FIGURE TT PUBLISHES WAS FOUND, TO THE EXACT DOLLAR, IN ITS
-- REPLACEMENT DOCUMENT. A 200 is not proof; neither is a matching cover date.
-- ─────────────────────────────────────────────────────────────────────────────
--   FY   expenditures        revenue             found in
--   2019 10,143,797,415      10,411,179,917      FAC Single Audit Report
--   2020 10,390,703,854      10,308,923,845      FAC Single Audit Report
--   2021 11,560,594,512      12,265,829,792      archived FY21_ACFR.pdf
--   2022 12,335,115,024      14,612,607,899      publisher fy-2022-acfr.pdf
--   2023 12,405,372,737      15,153,168,081      publisher fy-2023-acfr.pdf
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FY2022 + FY2023 → THE PUBLISHER, RENAMED
-- ─────────────────────────────────────────────────────────────────────────────
-- Verified live: 240 pp / 10,331,443 B stating "June 30, 2022" and 247 pp /
-- 11,864,671 B stating "June 30, 2023", both naming Nevada.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FY2021 → THE ARCHIVE'S CAPTURE OF THE CONTROLLER'S OWN ACFR
-- ─────────────────────────────────────────────────────────────────────────────
-- Withdrawn, but completely captured: 12,751,690 B, 235 pages, "June 30, 2021",
-- Nevada, %%EOF intact.
--
-- ⚠⚠ THE OBVIOUS SNAPSHOT WAS THE WRONG ONE. FY21_ACFR.pdf has TWO captures.
-- The newer (2026-02-12) is TRUNCATED AT EXACTLY 5 MiB with no %%EOF — it
-- opens as a broken file. The older (2025-10-28) is whole. Citing a truncated
-- capture is WORSE than citing a dead link: the reader gets something that
-- looks like a document and is not one. ⭐ ALWAYS CHECK %%EOF AND THE PAGE
-- COUNT, and when several captures exist, compare their stored lengths.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FY2019 + FY2020 → THE FEDERAL AUDIT CLEARINGHOUSE, AND IT IS A DIFFERENT
-- DOCUMENT. SAYING SO IS THE POINT.
-- ─────────────────────────────────────────────────────────────────────────────
-- Withdrawn by the Controller, and the ONLY archive capture of each is
-- truncated at 5 MiB — unusable, by the test above.
--
-- What FAC holds is titled "Single Audit Report, June 30, <FY>, State of
-- Nevada" (Eide Bailly). It is NOT the ACFR, and nothing here pretends it is.
-- What it IS, verified rather than assumed:
--
--   • complete — 358 pp / 15,064,719 B and 356 pp / 11,498,387 B, %%EOF intact
--   • the audited basic financial statements are inside it: "Basic Financial
--     Statements" ×16, "Statement of Net Position" ×23, "Balance Sheet" ×8,
--     "General Fund" ×43 and ×48
--   • ⭐ and all four of TT's published figures appear in it TO THE DOLLAR
--
-- ⚠⚠ FAC IS NOT AUTOMATICALLY THE ACFR — #376 proved it days ago, when
-- Cornelius's FY2022 FAC filing turned out to be a THREE-PAGE CSLFRF
-- compliance examination with zero fund statements. That is exactly why the
-- figures above were searched for rather than the filing being trusted.
--
-- ⭐ FAC is also a better host than web.archive.org: permanent, unauthenticated
-- and it does not rate-limit, so unlike the Cornelius pair these two will probe
-- green rather than 429.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. #372 is the worked example. The
-- hardcoded tables in scripts/processNVAcfr.js and scripts/processNVRevenueAcfr.js
-- are corrected in the same commit.
--
-- ⭐ base_url checked by hand (no gate reads it):
-- controller.nv.gov/financial-reports/annual-comprehensive-financial-report-acfr/
-- returns 200 and is still the right landing page.
--
-- ⚠ NOTED, NOT ACTED ON: the Controller now publishes FY2024, which TT does
-- not have. Loading a year is a load, not a citation repair.

do $$
declare
  v_rows     int;
  v_budgets  int;
  v_expected int := 10;  -- 5 documents x {operating, revenue}
begin
  create temp table nv_citation_fix (
    old_url text primary key,
    new_url text not null
  ) on commit drop;

  insert into nv_citation_fix (old_url, new_url) values
    -- renamed by the publisher
    ('https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2022_ACFR_Report.pdf',
     'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/fy-2022-acfr.pdf'),
    ('https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2023-acfr-report.pdf',
     'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/fy-2023-acfr.pdf'),
    -- withdrawn; the archive holds the Controller's own ACFR, whole
    ('https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/FY21_ACFR.pdf',
     'https://web.archive.org/web/20251028004655id_/https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/FY21_ACFR.pdf'),
    -- withdrawn; every capture truncated. FAC's Single Audit Report carries the
    -- same audited statements, and TT's figures were found in it to the dollar.
    ('https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/CAFR_Web_2019.pdf',
     'https://app.fac.gov/dissemination/report/pdf/2019-06-CENSUS-0000155928'),
    ('https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/ACFR_FY2020.pdf',
     'https://app.fac.gov/dissemination/report/pdf/2020-06-CENSUS-0000155928');

  select count(*) into v_rows from nv_citation_fix;
  if v_rows <> 5 then
    raise exception 'expected 5 citation pairs, built %', v_rows;
  end if;

  -- FENCE 1: every old URL must still be in use.
  select count(*) into v_rows
    from nv_citation_fix f
   where not exists (select 1 from treasury.budgets b where b.source_url = f.old_url);
  if v_rows <> 0 then
    raise exception '% of 5 old citation(s) are no longer present — refusing to guess', v_rows;
  end if;

  -- FENCE 2: refuse to collapse two citations into one.
  select count(*) into v_rows
    from treasury.budgets b
    join nv_citation_fix f on b.source_url = f.new_url;
  if v_rows <> 0 then
    raise exception '% budget(s) already cite a replacement URL — would merge citations', v_rows;
  end if;

  -- FENCE 3: the blast radius must be exactly Nevada's 10 budgets.
  select count(*) into v_budgets
    from treasury.budgets b
    join nv_citation_fix f on b.source_url = f.old_url;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) to repair, found %', v_expected, v_budgets;
  end if;

  -- FENCE 4: every replacement must be reachable from a reader's point of view,
  -- i.e. nothing here may be a bare host or an obviously wrong shape.
  select count(*) into v_rows
    from nv_citation_fix
   where new_url !~ '^https://(www\.controller\.nv\.gov/siteassets/|web\.archive\.org/web/|app\.fac\.gov/dissemination/report/pdf/)';
  if v_rows <> 0 then
    raise exception '% replacement(s) point somewhere unexpected', v_rows;
  end if;

  update treasury.budgets b
     set source_url = f.new_url
    from nv_citation_fix f
   where b.source_url = f.old_url;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 5: nothing may still cite a purged Controller filename. Scoped to the
  -- five retired basenames rather than the folder, because fy-2022-acfr.pdf and
  -- fy-2023-acfr.pdf live in that same folder and are CORRECT.
  select count(*) into v_rows
    from treasury.budgets
   where source_url in (
     'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/CAFR_Web_2019.pdf',
     'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/ACFR_FY2020.pdf',
     'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/FY21_ACFR.pdf',
     'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2022_ACFR_Report.pdf',
     'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2023-acfr-report.pdf'
   );
  if v_rows <> 0 then
    raise exception '% budget(s) still cite a purged Nevada filename', v_rows;
  end if;

  raise notice 'Nevada: repaired % citation(s) across % budget(s)', 5, v_expected;
end $$;
