-- The two URL columns no gate has ever read.
--
-- ⛔ SUPERSEDED IN PART, SAME DAY — read 20261110150000 next. The census below
-- resolves each budget to the ONE href `src/App.tsx` currently renders, and
-- that was wrong: `data_source_info` publishes TWO URL fields and the API ships
-- both to every browser. The "13 distinct URLs" counted here is 20 once both
-- are asked, and the seven it was missing included a 404 that this version
-- reported clean. Everything else here still stands.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠⚠ `verify:source-urls` ASKS `budgets.source_url`. THE READER IS NOT ALWAYS
-- SHOWN `budgets.source_url`.
-- ─────────────────────────────────────────────────────────────────────────────
-- #370 closed "the citation is dead" and #380 closed "the citation is a landing
-- page", and both worked on ONE column: `treasury.budgets.source_url`. That is
-- the column TT writes. It is not, for every budget, the column a reader sees.
--
-- The API decides the source chip's href in `treasuryService.ts` (EV-Accounts,
-- `mapBudget`), and it has TWO branches — read from the API's own source on
-- 2026-11-10, not inferred from behaviour:
--
--     data_source_info =
--       IF  sr.display_name AND sr.url            -- budgets.data_source_id → source_registry
--           → { url: sr.url,       datasetUrl: dsrc.base_url }
--       ELIF data_source AND source_url AND source_date
--           → { url: b.source_url, datasetUrl: b.source_url }
--       ELSE null
--
-- …where `dsrc` is the newest `treasury.data_sources` row matching
-- `d.name = b.data_source AND d.municipality_id = b.municipality_id`. The
-- client then picks (src/App.tsx): `url || datasetUrl` for a federal entity,
-- `datasetUrl || url` for everyone else.
--
-- ⭐⭐ SO THE FIRST BRANCH OVERRIDES `source_url` COMPLETELY. 937 budgets take
-- it, across 13 distinct URLs, and **not one of those 13 has ever been asked by
-- any gate in this repo.** Measured 2026-11-10: all 13 answer 200 today. That is
-- luck, not coverage — nothing would have reported it if they did not.
--
-- ⚠⚠ AND 704 OF THOSE 937 ALREADY HOLD A PRECISE `source_url` THAT THE READER
-- IS NOT SHOWN. This is #380's defect one layer up — in the API's precedence
-- rather than in a loader:
--
--     CA State Controller   696 budgets / 87 entities
--        reader is sent to  https://bythenumbers.sco.ca.gov        (portal root)
--        TT already holds   .../d/ju3w-4gxp  and  .../d/rrtv-rsj9  (the datasets)
--     West Hollywood          8 budgets, EIGHT distinct stored URLs
--        reader is sent to  https://data.weho.org                  (portal root)
--
-- ⛔ THE REPAIR FOR THAT IS NOT IN THIS REPO. `mapBudget` must prefer
-- `b.source_url` over `sr.url` when the budget carries one; that is a PR to
-- EmpoweredVote/ev-accounts. This migration's job is to make the blind spot
-- VISIBLE AND PERMANENTLY WATCHED, so it cannot quietly rot while that is
-- decided. See the Milledgeville Rule: it is not our job to hide bad data.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE SECOND COLUMN: `treasury.data_sources.base_url` — 156 DISTINCT, 1,824 ROWS
-- ─────────────────────────────────────────────────────────────────────────────
-- Three populations with three different stakes, and conflating them would make
-- the gate either toothless or permanently red:
--
--   1. SYNC ENDPOINT (7 URLs, api_type='socrata'). `supabase/functions/
--      treasury-sync` handles socrata AND NOTHING ELSE — every other api_type
--      gets `400 Unsupported` — so these seven are the only `base_url`s a
--      running job actually calls. Dead here = a cron that fails silently.
--      All 7 live 2026-11-10.
--   2. READER-FACING (via the lateral above) — covered by reader_link_census.
--   3. PROVENANCE RECORD (the rest, ~149). Where a HUMAN got the file for a
--      manual loader. Dead here breaks nobody today; it breaks whoever tries to
--      re-derive our figures from the publisher.
--
-- ⚠⚠⚠ 51 OF THEM ARE PATHS ON AN OPERATOR'S LAPTOP — `file://C:/treasury-tracker
-- /docs/...` and `local:docs/...`, 86 rows over 11 cities, in the PRODUCTION
-- database. `citationShape()` calls those "uncitable", which in the citation
-- gate means "we assert nothing about it". For a provenance record that verdict
-- is wrong: a laptop path is not an unknown, it is a DEFECT, and the honest
-- reading is that the provenance was never recorded at all. The 11 cities bear
-- it out — 234 of their budgets cite NOTHING (they are already inside the
-- 24,938 uncited baseline), and `docs/*` is gitignored, so the only copy of the
-- document is on one machine.
--
-- ⛔ A DECLARED BASELINE, NOT A HARD FAIL. There is no $0 repair for a lost
-- provenance record — the publisher URL is not stored anywhere in TT — so
-- failing on the 51 would leave the gate red forever and hide the next one.
-- They are counted and pinned in scripts/data/sourceEndpointBaseline.mjs, which
-- may SHRINK and may never GROW. Same bargain as UNCITED_BASELINE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠ `CREATE FUNCTION` GRANTS EXECUTE TO **PUBLIC**, AND `anon` IS IN PUBLIC.
-- ─────────────────────────────────────────────────────────────────────────────
-- `ALTER DEFAULT PRIVILEGES` does NOT suppress it on this instance — measured
-- three times, in three separate committed transactions, including in a virgin
-- schema. Every new function needs its own REVOKE, and the revoke must name
-- PUBLIC: there is no explicit `anon` grant to remove, the leading `=X/` in the
-- ACL *is* the PUBLIC grant, so `REVOKE ... FROM anon` alone is a silent no-op
-- that looks exactly like a fix. The DO block at the end refuses to let this
-- migration commit unless both functions ended up locked down.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. What a READER's source chip resolves to, for the budgets whose href does
--    NOT come from `budgets.source_url`.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function treasury.reader_link_census()
returns table (
  source_url           text,    -- named to match source_url_census: same pipeline
  budgets              bigint,
  via                  text,    -- 'registry.url' | 'data_sources.base_url'
  overrides_stored_url bigint,  -- budgets that hold a source_url the reader is NOT shown
  distinct_stored_urls bigint,
  sample_source        text,
  sample_entity        text,
  sample_state         text,
  sample_fiscal_year   integer
)
language sql
stable
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $function$
  with chip as (
    select
      b.id, b.source_url, b.data_source, b.fiscal_year, b.municipality_id,
      m.name as entity, m.state, m.entity_type,
      sr.url as sr_url,
      dsrc.base_url
    from treasury.budgets b
    -- ⚠ An INNER join on purpose. A budget with no data_source_id takes the
    -- API's SECOND branch, whose href IS `source_url` — already asked by
    -- source_url_census. Asking it twice would double-count the fleet.
    join treasury.source_registry sr on sr.id = b.data_source_id
    left join treasury.municipalities m on m.id = b.municipality_id
    -- ⚠⚠ THIS LATERAL IS A COPY OF THE API'S. Match on (name, municipality_id),
    -- newest last_synced_at, LIMIT 1 — if treasuryService.ts changes its join,
    -- this census starts asking about a URL no reader is shown, and stops
    -- asking about one they are. Keep the two in step.
    left join lateral (
      select d.base_url
        from treasury.data_sources d
       where d.name = b.data_source
         and d.municipality_id = b.municipality_id
       order by d.last_synced_at desc nulls last
       limit 1
    ) dsrc on true
    where sr.url is not null and sr.display_name is not null
  ), resolved as (
    select c.*,
           -- src/App.tsx: federal chips take `url || datasetUrl`; every other
           -- entity type takes `datasetUrl || url`.
           case when c.entity_type = 'federal'
                then coalesce(c.sr_url, c.base_url)
                else coalesce(c.base_url, c.sr_url)
           end as reader_url
      from chip c
  ), counts as (
    select r.reader_url,
           count(*)                                           as budgets,
           count(r.source_url)                                as overrides_stored_url,
           count(distinct r.source_url)                       as distinct_stored_urls,
           bool_or(r.reader_url is not distinct from r.base_url) as from_base_url
      from resolved r
     where r.reader_url is not null
     group by r.reader_url
  ), sample as (
    select distinct on (r.reader_url)
           r.reader_url, r.data_source, r.entity, r.state, r.fiscal_year
      from resolved r
     where r.reader_url is not null
     order by r.reader_url, r.data_source, r.fiscal_year
  )
  select c.reader_url,
         c.budgets,
         case when c.from_base_url then 'data_sources.base_url' else 'source_registry.url' end,
         c.overrides_stored_url,
         c.distinct_stored_urls,
         s.data_source, s.entity, s.state, s.fiscal_year
    from counts c
    join sample s on s.reader_url = c.reader_url
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Every distinct `data_sources.base_url`, with what it is FOR.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function treasury.source_endpoint_census()
returns table (
  source_url         text,
  rows_using         bigint,
  enabled_rows       bigint,
  api_types          text,
  -- ⭐ TRUE only for an api_type `supabase/functions/treasury-sync` can
  -- actually run. Everything else answers `400 Unsupported`, so a dead URL
  -- there is a stale note, not an outage.
  drives_a_sync      boolean,
  is_local_path      boolean,
  sample_source      text,
  sample_entity      text,
  sample_state       text,
  sample_fiscal_year integer
)
language sql
stable
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $function$
  with rows_ as (
    select ds.base_url, ds.api_type, ds.is_enabled, ds.name, ds.municipality_id,
           m.name as entity, m.state
      from treasury.data_sources ds
      left join treasury.municipalities m on m.id = ds.municipality_id
     where ds.base_url is not null
  ), counts as (
    select r.base_url,
           count(*)                                  as rows_using,
           count(*) filter (where r.is_enabled)      as enabled_rows,
           string_agg(distinct r.api_type, ', ')     as api_types,
           bool_or(r.api_type = 'socrata')           as drives_a_sync,
           -- ⚠ Two spellings, both in use: `fetchXlsx`-era rows wrote
           -- `local:docs/...`, the pdf_download rows wrote `file://C:/...`.
           bool_or(r.base_url like 'file://%' or r.base_url like 'local:%') as is_local_path
      from rows_ r
     group by r.base_url
  ), sample as (
    select distinct on (r.base_url) r.base_url, r.name, r.entity, r.state
      from rows_ r
     order by r.base_url, r.name
  )
  select c.base_url, c.rows_using, c.enabled_rows, c.api_types,
         c.drives_a_sync, c.is_local_path,
         s.name, s.entity, s.state, null::integer
    from counts c
    join sample s on s.base_url = c.base_url
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lock both down, then REFUSE TO COMMIT unless they really are locked down.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function treasury.reader_link_census()     from public, anon, authenticated;
revoke all on function treasury.source_endpoint_census() from public, anon, authenticated;
grant execute on function treasury.reader_link_census()     to service_role;
grant execute on function treasury.source_endpoint_census() to service_role;

do $$
declare
  v_fn   text;
  v_oid  oid;
  v_rows bigint;
begin
  foreach v_fn in array array['reader_link_census', 'source_endpoint_census'] loop
    select p.oid into v_oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'treasury' and p.proname = v_fn;
    if v_oid is null then
      raise exception 'treasury.%() was not created', v_fn;
    end if;

    -- FENCE 1: it must be SECURITY DEFINER, or it cannot read treasury.* as
    -- the gate's service role intends.
    if not (select prosecdef from pg_proc where oid = v_oid) then
      raise exception 'treasury.%() is not SECURITY DEFINER', v_fn;
    end if;

    -- FENCE 2: ⚠⚠ THE WHOLE POINT. anon is a member of PUBLIC and
    -- CREATE FUNCTION grants to PUBLIC, so without this a census of every
    -- citation in the fleet would be callable from the open internet.
    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception 'treasury.%() is EXECUTE-able by anon — the revoke did not take', v_fn;
    end if;
    if has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'treasury.%() is EXECUTE-able by authenticated', v_fn;
    end if;

    -- FENCE 3: ⚠ and a leading `=X/` in the ACL IS the PUBLIC grant, so catch
    -- it by shape too — has_function_privilege can be satisfied while a
    -- future role inherits PUBLIC.
    if (select proacl::text from pg_proc where oid = v_oid) like '{=X/%' then
      raise exception 'treasury.%() still carries the PUBLIC grant (leading =X/)', v_fn;
    end if;

    -- FENCE 4: and the gate's own role must be able to call it.
    if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
      raise exception 'treasury.%() is not EXECUTE-able by service_role', v_fn;
    end if;
  end loop;

  -- FENCE 5: ⚠⚠ A CENSUS THAT RETURNS NOTHING IS NOT A PASSING GATE, it is a
  -- gate that asks nothing. Both of these cover populations known to be
  -- non-empty on 2026-11-10 (937 budgets / 13 URLs, and 1,824 rows / 156 URLs).
  select count(*) into v_rows from treasury.reader_link_census();
  if v_rows = 0 then
    raise exception 'reader_link_census() returned 0 rows — it would watch nothing';
  end if;
  raise notice 'reader_link_census(): % distinct reader-facing URL(s)', v_rows;

  select count(*) into v_rows from treasury.source_endpoint_census();
  if v_rows = 0 then
    raise exception 'source_endpoint_census() returned 0 rows — it would watch nothing';
  end if;
  raise notice 'source_endpoint_census(): % distinct base_url(s)', v_rows;
end $$;
