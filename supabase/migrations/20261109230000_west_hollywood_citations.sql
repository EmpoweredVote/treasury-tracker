-- West Hollywood: give the 22 budgets that cite nothing a link a reader can click.
--
-- ⚠⚠⚠ THE BANNER HAD A SOURCE AND THE FIGURE DID NOT. Five West Hollywood
-- years already carry reader-facing flags, and every one of those flags cites
-- `data.weho.org` in its evidence chip. The budgets those banners sit on top of
-- stored `source_url = NULL`. So a reader who opened the explanation got a
-- link, and a reader who just looked at the number got nothing — on the same
-- page, about the same money.
--
-- Found by `npm run verify:source-urls` (#370), which counts 24,960 budgets
-- fleet-wide that cite nothing at all. These 22 are the ones where TT already
-- knew the answer.
--
-- ── ⛔⛔ A TARGETED UPDATE, NEVER A RE-LOAD ─────────────────────────────────
--
-- Re-running a loader re-mints `budgets.id`, which stales the id-keyed frozen
-- registry and moves a digest that must not move for a cosmetic repair. That is
-- the rule `scripts/repairAkBoroughSourceUrls.mjs` established after the Alaska
-- incident, and it applies here unchanged: write ONE column, on rows identified
-- by their own identity, and touch nothing else. No total changes, no row
-- changes, no tree changes, so `verify:frozen` cannot move.
--
-- ── ⭐ WHY `/d/<id>` AND NOT THE URL IT REDIRECTS TO ───────────────────────
--
-- Every one of these resolves 200 today, but through a redirect:
--
--   https://data.weho.org/d/b8ph-69yc
--     → https://data.weho.org/Expenditures/Demand-Register-FY-2022-24/b8ph-69yc
--
-- The target embeds the dataset's CATEGORY and TITLE, both of which the city can
-- rename at will — four of these ten already sit under `/dataset/` rather than
-- `/Expenditures/`, which is the same rename having happened once already.
-- `/d/<id>` is the permalink Socrata guarantees.
--
-- ⚠⚠ THIS IS THE ALASKA LESSON, APPLIED THE OTHER WAY UP. There, recording the
-- URL that actually served the bytes stamped a 30-second presigned S3 link onto
-- 227 rows. The rule it produced — cite what was REQUESTED, not what answered —
-- is why the short form is stored here even though the long one is what a
-- browser lands on.
--
-- ⚠ And they are landing PAGES, not `.json` endpoints. A citation is for a
-- person: the dataset page carries the city's own title, description, column
-- definitions and update date. `verify:source-urls` asserts no content type for
-- a URL with no file extension, exactly so a human-facing page is citable.
--
-- All 14 datasets were fetched and confirmed 200 on 2026-11-09.

do $$
declare
  v_updated int;
  v_clobbered int;
begin
  -- ⚠ EXACT EQUALITY ON `data_source`, NEVER `LIKE`. 'West Hollywood Budget
  -- Expenditure Detail' is a strict PREFIX of 'West Hollywood Budget
  -- Expenditure Detail FY15-18', so a LIKE pattern would claim the FY2013 and
  -- FY2014 rows for the FY17-21 dataset and cite the wrong document. This repo
  -- has the same prefix trap recorded against basisRegistry and against
  -- transaction link keys; it costs nothing to avoid and everything to miss.
  create temporary table weho_citations (data_source text, fiscal_year int, url text) on commit drop;
  insert into weho_citations values
    ('West Hollywood Demand Register FY2016-17', 2017, 'https://data.weho.org/d/jaed-p39k'),
    ('West Hollywood Demand Register FY2017-18', 2018, 'https://data.weho.org/d/cz69-a684'),
    ('West Hollywood Demand Register FY2018-19', 2019, 'https://data.weho.org/d/by9g-vc9g'),
    ('West Hollywood Demand Register FY2019-20', 2020, 'https://data.weho.org/d/yjid-9pyh'),
    ('West Hollywood Demand Register FY2020-21', 2021, 'https://data.weho.org/d/7kgt-b5t8'),
    ('West Hollywood Demand Register FY2021-22', 2022, 'https://data.weho.org/d/yai6-dpmb'),
    ('West Hollywood Demand Register FY2022-23', 2023, 'https://data.weho.org/d/e46y-98wp'),
    -- ⚠ The publisher's own title is "Demand Register FY 2022-24" — a TWO-YEAR
    -- label on the file TT loads as FY2024. That is not a typo to tidy: the file
    -- runs 2023-07 to 2024-10, which is why FY2024 and FY2025 both carry seam
    -- flags. Cite it under the name the city gave it.
    ('West Hollywood Demand Register FY2022-24', 2024, 'https://data.weho.org/d/b8ph-69yc'),
    ('West Hollywood Demand Register FY2024-25', 2025, 'https://data.weho.org/d/y2yz-icwv'),
    ('West Hollywood Demand Register FY2025-26', 2026, 'https://data.weho.org/d/5d72-njxw'),
    -- ⚠ The two "FY15-18" sources hold FY2013 and FY2014, not FY2015-18. The
    -- publisher's title says FY15-18; its COLUMNS say _2013_actuals and
    -- _2014_budget. `column_mapping.note` records that, and the citation points
    -- at the dataset so a reader can see the mismatch for themselves rather
    -- than being told a tidier story than the file supports.
    ('West Hollywood Budget Expenditure Detail FY15-18', 2013, 'https://data.weho.org/d/xxix-2i77'),
    ('West Hollywood Budget Expenditure Detail FY15-18', 2014, 'https://data.weho.org/d/xxix-2i77'),
    ('West Hollywood Budget Revenue Detail FY15-18',     2013, 'https://data.weho.org/d/c3hb-db2f'),
    ('West Hollywood Budget Revenue Detail FY15-18',     2014, 'https://data.weho.org/d/c3hb-db2f'),
    ('West Hollywood Budget Expenditure Detail', 2017, 'https://data.weho.org/d/6pse-xeqx'),
    ('West Hollywood Budget Expenditure Detail', 2018, 'https://data.weho.org/d/6pse-xeqx'),
    ('West Hollywood Budget Expenditure Detail', 2019, 'https://data.weho.org/d/6pse-xeqx'),
    ('West Hollywood Budget Expenditure Detail', 2020, 'https://data.weho.org/d/6pse-xeqx'),
    ('West Hollywood Budget Revenue Detail', 2017, 'https://data.weho.org/d/khr4-cuqj'),
    ('West Hollywood Budget Revenue Detail', 2018, 'https://data.weho.org/d/khr4-cuqj'),
    ('West Hollywood Budget Revenue Detail', 2019, 'https://data.weho.org/d/khr4-cuqj'),
    ('West Hollywood Budget Revenue Detail', 2020, 'https://data.weho.org/d/khr4-cuqj');

  -- ⚠⚠ REFUSE TO OVERWRITE AN EXISTING CITATION. If any of these rows has
  -- acquired a source_url since this was measured, a blind UPDATE would silently
  -- replace a link somebody chose. Count first, fail loudly.
  select count(*) into v_clobbered
    from treasury.budgets b
    join treasury.municipalities m on m.id = b.municipality_id
    join weho_citations c on c.data_source = b.data_source and c.fiscal_year = b.fiscal_year
   where m.name = 'West Hollywood' and m.state = 'CA'
     and b.source_url is not null
     and b.source_url is distinct from c.url;
  if v_clobbered > 0 then
    raise exception 'refusing to run: % West Hollywood budget(s) already cite a DIFFERENT url', v_clobbered;
  end if;

  update treasury.budgets b
     set source_url = c.url
    from weho_citations c, treasury.municipalities m
   where m.id = b.municipality_id
     and m.name = 'West Hollywood' and m.state = 'CA'
     and b.data_source = c.data_source
     and b.fiscal_year = c.fiscal_year
     and b.source_url is null;
  get diagnostics v_updated = row_count;

  -- ⚠ 22 is the count measured on 2026-11-09. Asserting it means this migration
  -- cannot quietly do less than it claims — the shape `evaluated = 0` guards
  -- against in out_of_period_watchdog.sql.
  if v_updated <> 22 then
    raise exception 'expected to cite 22 West Hollywood budgets, cited %', v_updated;
  end if;

  raise notice 'cited % West Hollywood budgets across 14 data.weho.org datasets', v_updated;
end $$;
