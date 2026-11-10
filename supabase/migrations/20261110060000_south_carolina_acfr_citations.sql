-- South Carolina's 24 ACFR citations, repaired after the publisher rebuilt its site.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT HAPPENED
-- ─────────────────────────────────────────────────────────────────────────────
-- `verify:source-urls` (#370) found all 24 cg.sc.gov citations dead — 48 budgets,
-- FY2002 through FY2025, every year South Carolina has in TT. The publisher is
-- UP: cg.sc.gov/ serves "Home | Comptroller General". So these are not the Ohio
-- case (#373, a publisher offline); the documents moved, and `dead` means what it
-- says — repair the URL.
--
-- The SC Comptroller General moved to a new Drupal build in 2026-10. The whole
-- old tree /sites/cg/files/Documents/<Spaced Folder Names>/ is gone. 23 of the 24
-- files were re-uploaded under their ORIGINAL basenames into the flat date folder
-- /sites/cg/files/2026-10/. FY2025 alone stayed in the document tree, which
-- survived with every space stripped from the directory names.
--
-- ⚠⚠ THE PATTERN I DERIVED FIRST WAS WRONG, AND IT LOOKED RIGHT.
-- FY2025's new URL is reachable by de-spacing the old one, so de-spacing read as
-- the site-wide rule. It resolves for FY2025 and 404s for all 23 others. Had I
-- applied it fleet-wide on the strength of one confirmation, this migration would
-- have replaced 46 dead links with 46 different dead links. Every replacement
-- below was probed on its own.
--
-- ⭐⭐ AND A 200 IS NOT PROOF. Each file was downloaded and its front matter read
-- back: all 24 state "June 30, <FY>" for the fiscal year that cites them, and all
-- 24 name South Carolina. That is a FACT ABOUT THE FILE. Without it this migration
-- would only assert that something answers at the new address.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. Re-running the loaders would re-mint
-- budgets.id and stale the frozen registry. #372 is the worked example; this
-- follows it. The loaders' own URL tables are corrected in the same commit, so a
-- future re-run does not quietly restore the dead links.

do $$
declare
  v_rows       int;
  v_budgets    int;
  v_collisions int;
  v_expected   int := 48;  -- 24 documents x {General Fund, General Fund Revenue}
begin
  create temp table sc_citation_fix (
    old_url text primary key,
    new_url text not null
  ) on commit drop;

  insert into sc_citation_fix (old_url, new_url) values
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202002%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202002%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202003%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202003%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202004%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202004%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202005%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202005%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202006%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202006%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202007%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202007%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202008%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202008%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202009%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202009%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/SC%20FY%202010%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202010%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/SC%20FY%202011%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202011%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/SC%20FY%202012%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/SC%20FY%202012%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/State%20of%20South%20Carolina%202013%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/State%20of%20South%20Carolina%202013%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/CAFR%20-%20FY%202014.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/CAFR%20-%20FY%202014.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/CAFR%20-%20FY%202015.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/CAFR%20-%20FY%202015.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/CAFR%20-%20FY%202016%20-%20Final.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/CAFR%20-%20FY%202016%20-%20Final.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/State%20of%20SC%20FY%202017%20CAFR.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/State%20of%20SC%20FY%202017%20CAFR.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/FY%202018%20CAFR%20-%202018-11-15.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/FY%202018%20CAFR%20-%202018-11-15.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001%20-%20302%20-%20CAFR%20-%20FY%202019.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/001%20-%20302%20-%20CAFR%20-%20FY%202019.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-302-CAFR-FY2020.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/001-302-CAFR-FY2020.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-304-CAFR-FY2021.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/001-304-CAFR-FY2021.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-304-CAFR-FY2022.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/001-304-CAFR-FY2022.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-308-CAFR-FY2023.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/001-308-CAFR-FY2023.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-316-ACFR-FY2024.pdf',
     'https://cg.sc.gov/sites/cg/files/2026-10/001-316-ACFR-FY2024.pdf'),
    ('https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2010%20-%202019)/ACFR%20Current%20Year/039-191-ACFR-FY2025-BasicFinancialStatements.pdf',
     'https://cg.sc.gov/sites/cg/files/documents/FinancialReports/AnnualComprehensiveFinancialReports(ACFRs)/AnnualComprehensiveFinancialReports(2010-2019)/ACFRCurrentYear/039-191-ACFR-FY2025-BasicFinancialStatements.pdf');

  select count(*) into v_rows from sc_citation_fix;
  if v_rows <> 24 then
    raise exception 'expected 24 citation pairs, built %', v_rows;
  end if;

  -- FENCE 1: every old URL must actually be in use. If the set has drifted,
  -- somebody else has already touched these rows and this migration is stale.
  select count(*) into v_rows
    from sc_citation_fix f
   where not exists (select 1 from treasury.budgets b where b.source_url = f.old_url);
  if v_rows <> 0 then
    raise exception '% of 24 old citation(s) are no longer present — refusing to guess', v_rows;
  end if;

  -- FENCE 2: refuse to collapse two citations into one. No new URL may already
  -- be in use by some other budget.
  select count(*) into v_collisions
    from treasury.budgets b
    join sc_citation_fix f on b.source_url = f.new_url;
  if v_collisions <> 0 then
    raise exception '% budget(s) already cite a replacement URL — would merge citations', v_collisions;
  end if;

  -- FENCE 3: the blast radius must be exactly South Carolina's 48 budgets.
  select count(*) into v_budgets
    from treasury.budgets b
    join sc_citation_fix f on b.source_url = f.old_url;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) to repair, found %', v_expected, v_budgets;
  end if;

  update treasury.budgets b
     set source_url = f.new_url
    from sc_citation_fix f
   where b.source_url = f.old_url;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 4: nothing may still point into the retired tree.
  select count(*) into v_rows
    from treasury.budgets
   where source_url like 'https://cg.sc.gov/sites/cg/files/Documents/%';
  if v_rows <> 0 then
    raise exception '% budget(s) still cite the retired directory tree', v_rows;
  end if;

  raise notice 'South Carolina: repaired % citation(s) across % budget(s)', 24, v_expected;
end $$;
