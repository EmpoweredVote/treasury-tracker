-- Anchorage's 13 ACFR citations, repaired after the publisher left SharePoint.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT HAPPENED
-- ─────────────────────────────────────────────────────────────────────────────
-- All 13 www.muni.org citations were dead — 26 budgets, FY2012 through FY2024,
-- an unbroken run and every year Anchorage has in TT. The publisher is UP:
-- www.muni.org/ returns 200 "Anchorage, AK". So the documents moved, and `dead`
-- means what it says.
--
-- The Municipality moved from SharePoint to a PHP CMS. The flat folder
-- /Departments/finance/controller/ACFR/ is gone. Each year now has its OWN
-- folder under /Documents/Departments/Finance/Controller/Controller ACFR/,
-- named "<FY> ACFR". Every basename survived unchanged — only the parent moved,
-- so this is NOT one prefix swap: the year folder varies per row.
--
-- ⚠⚠ THE HOST 403s AN UNDECORATED CLIENT. The root and every HTML page refuse
-- plain curl while the PDFs answer. Probing the root without browser headers
-- reads a live publisher as a dead one — which is exactly the distinction
-- #373 and #374 exist to protect. BROWSER_HEADERS in sourceUrlProbe.mjs.
--
-- ⚠ The publisher's listing emits every link with a `?t=<timestamp>` cache
-- buster. It is not required, and a citation carrying one would rot the next
-- time they touched the file. All 13 below were confirmed WITHOUT it.
--
-- ⭐⭐ AND A 200 IS NOT PROOF. Each file was downloaded and its front matter
-- read back: all 13 state "December 31, <FY>" for the fiscal year that cites
-- them, and all 13 name Anchorage. Anchorage's December year-end was read off
-- the documents, not assumed.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. #372 is the worked example. The
-- canonical URL table in scripts/lib/akAcfrSources.mjs is corrected in the same
-- commit, along with ANCHORAGE_PAGE — the SharePoint landing page, which was
-- also 404 and which no gate reads, because it lands in data_sources.base_url.

do $$
declare
  v_rows       int;
  v_budgets    int;
  v_collisions int;
  v_expected   int := 26;  -- 13 documents x {General Fund, General Fund Revenue}
begin
  create temp table moa_citation_fix (
    old_url text primary key,
    new_url text not null
  ) on commit drop;

  insert into moa_citation_fix (old_url, new_url)
  select old_dir || basename,
         new_dir || fy || '%20ACFR/' || basename
    from (values
      ('2012', '2012%20CAFR.pdf'),
      ('2013', 'Complete%202013%20CAFR.pdf'),
      ('2014', '2014%20CAFR.pdf'),
      ('2015', 'Complete%202015%20CAFR.pdf'),
      ('2016', 'Complete%202016%20CAFR.pdf'),
      ('2017', '2017%20CAFR.pdf'),
      ('2018', '2018%20CAFR.pdf'),
      ('2019', '2019%20MOA%20CAFR.pdf'),
      ('2020', '2020%20MOA%20Annual%20Report-%20Final%20Web%20Version%20w%20Cover-%2010.15.21.pdf'),
      ('2021', '2021%20MOA%20ACFR.pdf'),
      ('2022', 'Municipality%20of%20Anchorage%20ACFR%2022.pdf'),
      ('2023', '2023%20MOA%20ACFR.pdf'),
      ('2024', 'Municipality%20of%20Anchorage%20ACFR%202024%20(S).pdf')
    ) as f(fy, basename),
    lateral (select
      'https://www.muni.org/Departments/finance/controller/ACFR/' as old_dir,
      'https://www.muni.org/Documents/Departments/Finance/Controller/Controller%20ACFR/' as new_dir
    ) as d;

  select count(*) into v_rows from moa_citation_fix;
  if v_rows <> 13 then
    raise exception 'expected 13 citation pairs, built %', v_rows;
  end if;

  -- FENCE 1: every old URL must actually be in use. If the set has drifted,
  -- somebody else has already touched these rows and this migration is stale.
  select count(*) into v_rows
    from moa_citation_fix f
   where not exists (select 1 from treasury.budgets b where b.source_url = f.old_url);
  if v_rows <> 0 then
    raise exception '% of 13 old citation(s) are no longer present — refusing to guess', v_rows;
  end if;

  -- FENCE 2: refuse to collapse two citations into one.
  select count(*) into v_collisions
    from treasury.budgets b
    join moa_citation_fix f on b.source_url = f.new_url;
  if v_collisions <> 0 then
    raise exception '% budget(s) already cite a replacement URL — would merge citations', v_collisions;
  end if;

  -- FENCE 3: the blast radius must be exactly Anchorage's 26 budgets.
  select count(*) into v_budgets
    from treasury.budgets b
    join moa_citation_fix f on b.source_url = f.old_url;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) to repair, found %', v_expected, v_budgets;
  end if;

  update treasury.budgets b
     set source_url = f.new_url
    from moa_citation_fix f
   where b.source_url = f.old_url;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 4: nothing may still point into the retired SharePoint folder.
  select count(*) into v_rows
    from treasury.budgets
   where source_url like 'https://www.muni.org/Departments/finance/controller/ACFR/%';
  if v_rows <> 0 then
    raise exception '% budget(s) still cite the retired SharePoint folder', v_rows;
  end if;

  -- FENCE 5: no citation may carry the listing's ?t= cache buster.
  select count(*) into v_rows
    from treasury.budgets
   where source_url like 'https://www.muni.org/%?t=%';
  if v_rows <> 0 then
    raise exception '% Anchorage citation(s) carry a ?t= cache buster', v_rows;
  end if;

  raise notice 'Anchorage: repaired % citation(s) across % budget(s)', 13, v_expected;
end $$;
