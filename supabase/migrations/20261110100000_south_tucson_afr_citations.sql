-- City of South Tucson, AZ — four Annual Financial Report citations, FY2019–FY2022.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT HAPPENED: A CMS MOVE, AND THE DOCUMENTS SURVIVED IT
-- ─────────────────────────────────────────────────────────────────────────────
-- All four citations 404, asked with HEAD *and* a real GET (#376's rule: a HEAD
-- 404 proves nothing). The publisher is UP — southtucsonaz.gov returns 200,
-- "Home Page | South Tucson Arizona" — so the documents moved.
--
-- The City left a self-hosted Drupal for a Granicus/Municode-hosted one. The old
-- /sites/default/files/fileattachments/finance/page/<nodeid>/<basename>.pdf tree
-- is gone entirely. Assets now live under /sites/g/files/vyhlif13361/files/ and
-- every document is addressed by a MEDIA ENTITY: /media/<id>.
--
-- ⭐ Unlike South Carolina (#374) and Anchorage (#375), the basename did NOT
-- survive — there is no path rule to derive. The City's own index at
-- /finance/page/annual-financial-statements was read and the four reports taken
-- off it by name. It lists FYE 06-30-2007 through 06-30-2025.
--
-- ⚠⚠⚠ THE TRAP HERE IS NOT THE PATH, IT IS PICKING THE WRONG DOCUMENT.
-- Every year carries SEVERAL filings, and they are not interchangeable:
--
--     5936   465.28 KB   Annual Financial Report FYE 06-30-2019          ← this
--     5941    31.59 KB   Notice of Pending Financial Statement Filing (fnl rev)
--     5946    85.73 KB   Notice of Pending Financial Statement Filing (rev)
--     5951    29.00 KB   Notice of Pending Financial Statement Filing
--
-- A "Notice of Pending Financial Statement Filing" is a short letter saying the
-- audit is LATE. It contains no financial statements at all. FY2019 alone has
-- three of them, and FY2021's notices (659 KB, 713 KB) are LARGER than its
-- actual report (427 KB) — so size is not a safe discriminator either. Each
-- citation below is the entry whose own name is "Annual Financial Report".
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐⭐ VERIFIED TO THE EXACT DOLLAR — the bar set in #377
-- ─────────────────────────────────────────────────────────────────────────────
-- A 200 is not proof, and neither is a matching cover date. Every figure TT
-- publishes was searched for inside its replacement document and found:
--
--   FY    media   pages  expenditures   revenue      states
--   2019  5936    71     5,034,119      5,138,816    June 30, 2019 · South Tucson
--   2020  5921    72     5,555,457      5,646,186    June 30, 2020 · South Tucson
--   2021  5906    68     5,424,024      6,207,597    June 30, 2021 · South Tucson
--   2022  5896    69     5,883,806      6,201,468    June 30, 2022 · South Tucson
--
-- All four are complete (%%EOF intact) and answer 200 application/pdf directly
-- at /media/<id> with NO redirect, so that is the canonical address, not a
-- staging hop. ⚠ The URL has no file extension, which is correct and deliberate:
-- a URL that promises no type has nothing asserted about it (see citationShape).
--
-- ⚠ The host 403s a client that sends only a User-Agent. Full BROWSER_HEADERS
-- from scripts/lib/sourceUrlProbe.mjs are required — the same lesson Anchorage
-- taught in #375.
--
-- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD. #372 is the worked example.
-- scripts/processPimaCities.js is corrected in the same commit — and so is
-- scripts/verify-phase133-audit.mjs, which ASSERTS each row's source_url against
-- an expected canonical URL and would otherwise report a false failure the
-- moment this migration lands.
--
-- ⭐ base_url needs no separate fix here: processPimaCities.js derives it from
-- the last FY's entry in the same table (`city.urls[city.fys.at(-1)]`).

do $$
declare
  v_rows     int;
  v_budgets  int;
  v_expected int := 8;  -- 4 documents x {operating, revenue}
begin
  create temp table st_citation_fix (
    old_url text primary key,
    new_url text not null
  ) on commit drop;

  insert into st_citation_fix (old_url, new_url) values
    ('https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/4463/annual_financial_report_fye_6-30-2019.pdf',
     'https://www.southtucsonaz.gov/media/5936'),
    ('https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/20_south_tucson-afr.pdf',
     'https://www.southtucsonaz.gov/media/5921'),
    ('https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2021.pdf',
     'https://www.southtucsonaz.gov/media/5906'),
    ('https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2022.pdf',
     'https://www.southtucsonaz.gov/media/5896');

  select count(*) into v_rows from st_citation_fix;
  if v_rows <> 4 then
    raise exception 'expected 4 citation pairs, built %', v_rows;
  end if;

  -- FENCE 1: every old URL must still be in use.
  select count(*) into v_rows
    from st_citation_fix f
   where not exists (select 1 from treasury.budgets b where b.source_url = f.old_url);
  if v_rows <> 0 then
    raise exception '% of 4 old citation(s) are no longer present — refusing to guess', v_rows;
  end if;

  -- FENCE 2: refuse to collapse two citations into one. This matters more than
  -- usual here: the replacements differ only by a media id, so a copy-paste slip
  -- would silently point two fiscal years at one document.
  select count(*) into v_rows from (
    select new_url from st_citation_fix group by new_url having count(*) > 1
  ) d;
  if v_rows <> 0 then
    raise exception '% replacement URL(s) are duplicated across fiscal years', v_rows;
  end if;

  select count(*) into v_rows
    from treasury.budgets b
    join st_citation_fix f on b.source_url = f.new_url;
  if v_rows <> 0 then
    raise exception '% budget(s) already cite a replacement URL — would merge citations', v_rows;
  end if;

  -- FENCE 3: the blast radius must be exactly South Tucson's 8 budgets.
  select count(*) into v_budgets
    from treasury.budgets b
    join st_citation_fix f on b.source_url = f.old_url;
  if v_budgets <> v_expected then
    raise exception 'expected % budget(s) to repair, found %', v_expected, v_budgets;
  end if;

  -- FENCE 4: every replacement must be a southtucsonaz.gov media entity. Nothing
  -- may wander onto another host, and nothing may keep the retired Drupal shape.
  select count(*) into v_rows
    from st_citation_fix
   where new_url !~ '^https://www\.southtucsonaz\.gov/media/[0-9]+$';
  if v_rows <> 0 then
    raise exception '% replacement(s) are not a southtucsonaz.gov media entity', v_rows;
  end if;

  update treasury.budgets b
     set source_url = f.new_url
    from st_citation_fix f
   where b.source_url = f.old_url;

  get diagnostics v_rows = row_count;
  if v_rows <> v_expected then
    raise exception 'updated % row(s), expected %', v_rows, v_expected;
  end if;

  -- FENCE 5: nothing may still cite the retired Drupal fileattachments tree.
  select count(*) into v_rows
    from treasury.budgets
   where source_url like 'https://www.southtucsonaz.gov/sites/default/files/%';
  if v_rows <> 0 then
    raise exception '% budget(s) still cite the retired South Tucson Drupal tree', v_rows;
  end if;

  raise notice 'South Tucson: repaired % citation(s) across % budget(s)', 4, v_expected;
end $$;
