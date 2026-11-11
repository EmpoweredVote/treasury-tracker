-- West Hollywood — `source_registry.url` was a 404, and nothing could see it.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐⭐ THE FIRST DEAD LINK FOUND IN A COLUMN NO GATE HAD EVER READ
-- ─────────────────────────────────────────────────────────────────────────────
-- `treasury.source_registry.url` is published to every browser as
-- `data_source_info.url`. For the eight West Hollywood demand registers it held
--
--     https://www.weho.org/city-government/city-budget/open-checkbook   HTTP 404
--
-- and had done for an unknown length of time. `verify:source-urls` never asked,
-- because it reads `budgets.source_url` and these budgets' href comes from the
-- registry instead. It was found the same hour the census that asks this column
-- was written — see 20261110150000, which exists because the FIRST draft of
-- that census asked only the URL the chip currently renders and would have
-- missed this one too (`datasetUrl` wins for a city, and `data.weho.org`
-- answers 200, so the pair read clean while the 404 travelled in the same JSON
-- object).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THE PORTAL, AND NOT A REPLACEMENT CHECKBOOK PAGE
-- ─────────────────────────────────────────────────────────────────────────────
-- Probed 2026-11-10 with the gate's own ladder, twice each:
--
--     www.weho.org/city-government/city-budget/open-checkbook           404
--     www.weho.org/city-government/city-budget                          404
--     www.weho.org/city-government/city-budget/open-checkbook-register  404
--     data.weho.org                                                     200
--
-- ⚠ The city's own site could not be crawled for a successor — www.weho.org
-- answers an automated client 403 at the root — so no replacement page was
-- GUESSED. The honest value is the one the row has always described: this
-- registry entry is named `west-hollywood-open-data` and displays as "West
-- Hollywood Open Data", and all eight budgets under it cite a dataset ON THAT
-- PORTAL:
--
--     FY2019 data.weho.org/d/by9g-vc9g   FY2023 data.weho.org/d/e46y-98wp
--     FY2020 data.weho.org/d/yjid-9pyh   FY2024 data.weho.org/d/b8ph-69yc
--     FY2021 data.weho.org/d/7kgt-b5t8   FY2025 data.weho.org/d/y2yz-icwv
--     FY2022 data.weho.org/d/yai6-dpmb   FY2026 data.weho.org/d/5d72-njxw
--
-- all eight live on the same run. So the publisher IS data.weho.org, which is
-- also what every other open-data registry row holds (data.bloomington.in.gov,
-- data.sfgov.org, data.lacounty.gov). A city-website checkbook page was the
-- wrong KIND of value for this row before it was a dead one.
--
-- ⚠⚠ THIS IS A FLOOR, NOT THE FIX. After this the reader is still shown a
-- PORTAL ROOT while TT holds the exact per-year dataset page — #380's defect,
-- and here it is the API's precedence that causes it (`mapBudget` prefers
-- `source_registry.url` over `budgets.source_url` whenever a budget carries a
-- `data_source_id`). That repair is a PR to EmpoweredVote/ev-accounts; this one
-- only stops the link being dead. `verify:source-urls` prints the remaining
-- defect on every run so it cannot go quiet again.

do $$
declare
  v_rows    int;
  v_budgets int;
  v_old text := 'https://www.weho.org/city-government/city-budget/open-checkbook';
  v_new text := 'https://data.weho.org';
begin
  -- FENCE 1: the registry row must still hold the dead URL.
  select count(*) into v_rows
    from treasury.source_registry
   where name = 'west-hollywood-open-data' and url = v_old;
  if v_rows <> 1 then
    raise exception 'expected 1 west-hollywood-open-data row holding the retired URL, found %', v_rows;
  end if;

  -- FENCE 2: ⚠⚠ AND IT MUST BE THE ONLY ROW HOLDING IT. `source_registry` is
  -- small and hand-maintained; a second row on the same URL would mean this
  -- repair silently re-points a publisher it was never asked about.
  select count(*) into v_rows from treasury.source_registry where url = v_old;
  if v_rows <> 1 then
    raise exception '% registry row(s) hold the retired URL, expected exactly 1', v_rows;
  end if;

  -- FENCE 3: ⭐ the budgets this moves must all already cite the portal we are
  -- moving TO. That is what makes `data.weho.org` a finding rather than a
  -- guess — 8 budgets, 8 distinct dataset pages, every one on that host.
  select count(*) into v_budgets
    from treasury.budgets b
    join treasury.source_registry sr on sr.id = b.data_source_id
   where sr.name = 'west-hollywood-open-data';
  if v_budgets <> 8 then
    raise exception 'expected 8 budgets under west-hollywood-open-data, found %', v_budgets;
  end if;

  select count(*) into v_rows
    from treasury.budgets b
    join treasury.source_registry sr on sr.id = b.data_source_id
   where sr.name = 'west-hollywood-open-data'
     and b.source_url like v_new || '/d/%';
  if v_rows <> 8 then
    raise exception
      'only % of 8 West Hollywood budgets cite a %/d/… dataset — do NOT proceed, '
      'the portal is not demonstrably the publisher for all of them', v_rows, v_new;
  end if;

  -- ⛔ A TARGETED UPDATE, NEVER A RE-LOAD: re-running a loader re-mints
  -- budgets.id and stales the frozen registry. Nothing here touches budgets.
  update treasury.source_registry
     set url = v_new, updated_at = now()
   where name = 'west-hollywood-open-data';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'updated % registry row(s), expected 1', v_rows;
  end if;

  -- FENCE 4: nothing anywhere may still publish the dead page.
  select count(*) into v_rows from treasury.source_registry where url = v_old;
  if v_rows <> 0 then
    raise exception '% registry row(s) still hold the retired URL', v_rows;
  end if;
  select count(*) into v_rows from treasury.budgets where source_url = v_old;
  if v_rows <> 0 then
    raise exception '% budget(s) still cite the retired open-checkbook page', v_rows;
  end if;
  select count(*) into v_rows from treasury.data_sources where base_url = v_old;
  if v_rows <> 0 then
    raise exception '% data_sources row(s) still hold the retired open-checkbook page', v_rows;
  end if;

  raise notice 'West Hollywood: registry URL now %, covering % budget(s)', v_new, v_budgets;
end $$;
