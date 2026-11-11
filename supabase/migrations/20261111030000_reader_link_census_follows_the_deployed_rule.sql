-- The census was modelling an API that no longer exists.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠⚠ A GATE THAT MODELS ANOTHER SERVICE GOES STALE THE DAY THAT SERVICE IS
-- FIXED — AND NOTHING IN THE MODEL CAN NOTICE.
-- ─────────────────────────────────────────────────────────────────────────────
-- `reader_link_census()` reproduces, in SQL, the precedence
-- `EmpoweredVote/ev-accounts` applies when it builds `data_source_info`. That
-- is what lets this gate ask about the URLs a READER is handed rather than
-- only the ones TT stores, and it is how #381 found a 404 that had been
-- published to eight West Hollywood budgets.
--
-- #381 also found the API taking the registry branch WHOLE whenever a budget
-- carried a `data_source_id`, so `budgets.source_url` never entered into it —
-- 704 budgets sent to a portal root while the row beside them named the exact
-- dataset. **ev-accounts#1372 fixed that and shipped.** The rule there is now:
--
--     url        = source_url ?? ds_url
--     datasetUrl = source_url ?? ds_base_url
--     fetchedAt  = source_date ?? ds_last_synced_at
--
-- This census still modelled the OLD rule. So every run printed
--
--     ⚠⚠ SHOWN A LANDING PAGE WHILE TT HOLDS THE DOCUMENT (704 budget(s))
--     ⛔ The repair is in EmpoweredVote/ev-accounts: treasuryService.ts
--        `mapBudget` must prefer b.source_url over sr.url …
--
-- — instructing the next person to go and make a change that was already
-- merged and deployed. Confirmed against the live API on 2026-11-11: Bradbury
-- FY2021 is served `https://bythenumbers.sco.ca.gov/d/rrtv-rsj9`, the precise
-- dataset, not the portal root. The gate was telling the truth about itself
-- and a falsehood about the world, which is the failure
-- scripts/data/sourceEndpointBaseline.mjs already names: "a repo that tells
-- itself something out of date about a publisher is worse off than one that
-- says nothing."
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⛔⛔ AND `overrides_stored_url` IS REMOVED, NOT RE-POINTED
-- ─────────────────────────────────────────────────────────────────────────────
-- It counted budgets whose chip href differed from a `source_url` they held.
-- Under the deployed rule that is IMPOSSIBLE BY CONSTRUCTION: when
-- `source_url` is present it becomes BOTH published fields, so it is the chip
-- href whichever way the client's ternary falls. Measured before writing this:
-- 0 of 704.
--
-- ⭐ So keeping the column would leave a metric that cannot fire, reporting
-- zero for ever and reading like a clean bill of health. A number that can only
-- say one thing is not evidence. `distinct_stored_urls` existed only to print
-- alongside it and goes too.
--
-- ⚠⚠ THE REAL RISK IT LEAVES BEHIND IS DRIFT, AND NO MODEL CAN SELF-CHECK.
-- This census cannot detect ev-accounts changing again — it would simply
-- describe a world that had moved, exactly as it did for the day between
-- #1372 shipping and this migration. That is why the matching change in
-- scripts/verifySourceUrls.mjs asks the LIVE API what it actually publishes
-- for a sample of budgets and fails when the model and the service disagree.
-- The model belongs here; the proof that it is still true does not.

-- ⚠ DROP first: the return type loses two columns, and Postgres refuses to
-- `create or replace` a set-returning function whose OUT parameters changed.
-- ⛔ A dropped function comes back with a FRESH acl — EXECUTE granted to
-- PUBLIC — which is why the revoke below is not ceremony.
drop function if exists treasury.reader_link_census();

create function treasury.reader_link_census()
returns table (
  source_url         text,    -- named to match source_url_census: same pipeline
  budgets            bigint,
  via                text,    -- which data_source_info field(s) carry it
  is_chip_href       boolean, -- does src/App.tsx actually link to this one today
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
  with chip as (
    select
      b.id, b.source_url, b.data_source, b.fiscal_year,
      m.name as entity, m.state, m.entity_type,
      sr.url as sr_url,
      dsrc.base_url
    from treasury.budgets b
    -- ⚠ INNER on purpose. A budget with no data_source_id takes the API's
    -- SECOND branch, whose href IS `source_url` — already asked by
    -- source_url_census. Asking it twice would double-count the fleet.
    join treasury.source_registry sr on sr.id = b.data_source_id
    left join treasury.municipalities m on m.id = b.municipality_id
    -- ⚠⚠ A COPY OF THE API'S LATERAL. Match on (name, municipality_id),
    -- newest last_synced_at, LIMIT 1 — if treasuryService.ts changes its join,
    -- this census starts asking about a URL no reader is served and stops
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
  ), fields as (
    -- ⭐ THE DEPLOYED RULE, verbatim from backend/src/lib/treasuryCitation.ts:
    --     url        = source_url ?? ds_url
    --     datasetUrl = source_url ?? ds_base_url
    -- "The most precise thing we hold wins."
    select c.*,
           coalesce(c.source_url, c.sr_url)   as f_url,
           coalesce(c.source_url, c.base_url) as f_dataset
      from chip c
  ), served as (
    select f.*,
           -- src/App.tsx TODAY: federal chips take `url || datasetUrl`, every
           -- other entity type takes `datasetUrl || url`. Recorded, not obeyed.
           case when f.entity_type = 'federal'
                then coalesce(f.f_url, f.f_dataset)
                else coalesce(f.f_dataset, f.f_url)
           end as chip_href
      from fields f
  ), unrolled as (
    -- ⭐ One row per (budget, PUBLISHED FIELD). Both fields of
    -- `data_source_info` reach the browser, so both get asked — #381's finding,
    -- and it still holds: which one the chip links to is a line of client code.
    select s.*, v.field, v.url
      from served s
      cross join lateral (values
        ('data_source_info.url',        s.f_url),
        ('data_source_info.datasetUrl', s.f_dataset)
      ) as v(field, url)
     where v.url is not null
  ), counts as (
    select u.url,
           count(distinct u.id)                as budgets,
           string_agg(distinct u.field, ' + ') as via,
           bool_or(u.url = u.chip_href)        as is_chip_href
      from unrolled u
     group by u.url
  ), sample as (
    select distinct on (u.url) u.url, u.data_source, u.entity, u.state, u.fiscal_year
      from unrolled u
     order by u.url, u.data_source, u.fiscal_year
  )
  select c.url, c.budgets, c.via, c.is_chip_href,
         s.data_source, s.entity, s.state, s.fiscal_year
    from counts c
    join sample s on s.url = c.url
$function$;

-- ⚠⚠ THE DROP ABOVE THREW THE OLD ACL AWAY, so this is a brand-new function as
-- far as privileges go: `CREATE FUNCTION` grants EXECUTE to PUBLIC, `anon` is a
-- member of PUBLIC, and `ALTER DEFAULT PRIVILEGES` does not suppress it on this
-- instance. The revoke must name PUBLIC — the leading `=X/` in the ACL *is* the
-- PUBLIC grant, so revoking from `anon` alone is a silent no-op that looks
-- exactly like a fix.
revoke all on function treasury.reader_link_census() from public, anon, authenticated;
grant execute on function treasury.reader_link_census() to service_role;

do $$
declare
  v_oid       oid;
  v_rows      bigint;
  v_served    bigint;
  v_override  bigint;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'treasury' and p.proname = 'reader_link_census';

  if has_function_privilege('anon', v_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_oid, 'EXECUTE')
     or (select proacl::text from pg_proc where oid = v_oid) like '{=X/%' then
    raise exception 'reader_link_census() is reachable by anon — the revoke did not take';
  end if;
  if not has_function_privilege('service_role', v_oid, 'EXECUTE') then
    raise exception 'reader_link_census() is not EXECUTE-able by service_role';
  end if;

  -- FENCE: it must still ask MORE than the chip renders. If every row is a
  -- chip href, the second published field has gone unasked and the WeHo 404
  -- that #381 caught could ride along again.
  select count(*) into v_rows   from treasury.reader_link_census();
  select count(*) into v_served from treasury.reader_link_census() where not is_chip_href;
  if v_served = 0 then
    raise exception
      'reader_link_census() returned % row(s) and NONE is a non-chip URL — '
      'it is asking the winner again, not everything data_source_info publishes', v_rows;
  end if;

  -- FENCE: still one row per URL, which is what lets the gate page it under
  -- an ORDER BY source_url. See tests/pagedReadOrdering.test.mjs.
  if v_rows <> (select count(distinct source_url) from treasury.reader_link_census()) then
    raise exception 'reader_link_census() returned duplicate URLs — paging would skip rows';
  end if;

  -- FENCE: ⭐⭐ THE RULE IS IN FORCE, STATED SO IT CAN ACTUALLY FAIL.
  --
  -- ⚠ The obvious phrasing — "no budget is published a URL other than its own
  -- source_url" — is a TAUTOLOGY against the coalesce above, which is a fence
  -- that cannot fail and so proves nothing. This asks the other direction, of
  -- the function's OUTPUT: every source_url held by a registry-attributed
  -- budget must now APPEAR in the census. Under the old precedence none of
  -- them did; the census published the registry's landing page instead and
  -- these ten URLs reached readers unasked by this pipeline. Written the
  -- coalesce backwards and this fails immediately.
  select count(*) into v_override
    from (
      select distinct b.source_url as u
        from treasury.budgets b
        join treasury.source_registry sr on sr.id = b.data_source_id
       where sr.url is not null and sr.display_name is not null
         and b.source_url is not null
    ) held
   where not exists (
     select 1 from treasury.reader_link_census() c where c.source_url = held.u
   );
  if v_override <> 0 then
    raise exception
      '% source_url(s) held by registry-attributed budgets are MISSING from the census — '
      'the precedence is not the deployed one', v_override;
  end if;

  raise notice 'reader_link_census(): % URL(s), % of them published but not linked',
    v_rows, v_served;
end $$;
