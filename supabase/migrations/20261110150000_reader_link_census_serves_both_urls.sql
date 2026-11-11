-- reader_link_census() asked about the WINNER. The API publishes BOTH.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠⚠⚠ THE FIRST VERSION OF THIS CENSUS REPRODUCED THE CLIENT'S CHOICE, AND A
-- CHOICE IS NOT A CENSUS.
-- ─────────────────────────────────────────────────────────────────────────────
-- The migration before this one resolved each budget to the ONE href
-- `src/App.tsx` actually renders — `datasetUrl || url`, or `url || datasetUrl`
-- for a federal entity — and asked about that. Thirteen URLs, all live, and it
-- read like coverage.
--
-- It was not. `data_source_info` is a JSON object with TWO URL fields in it,
-- and the API ships both to the browser on every budget. Which one the chip
-- links to today is a line of client code; both are published, and the loser is
-- one `||` away from being what every reader clicks. Asking only the winner
-- makes this gate's coverage depend on a component's ternary.
--
-- ⭐ AND IT WAS ALREADY HIDING A DEAD LINK. Measured 2026-11-10:
--
--     West Hollywood, 8 budgets
--       data_source_info.url        https://www.weho.org/.../open-checkbook   HTTP 404
--       data_source_info.datasetUrl https://data.weho.org                     HTTP 200
--
-- `datasetUrl` wins for a city, so the first version asked `data.weho.org`,
-- got a 200, and reported the pair clean — while the API went on handing every
-- reader of those eight budgets a 404 in the same JSON object. That is exactly
-- the #380 failure mode (a live URL standing in front of a wrong one) reached
-- by a different road, and it was introduced and found inside one afternoon.
--
-- Five more URLs were published and unasked for the same reason:
--     https://data.lacity.org                       (url, 12 budgets)
--     https://data.sandiego.gov                     (url,  2 budgets)
--     https://www.whitehouse.gov/.../outlays_fy2027.xlsx    (datasetUrl, 101)
--     https://www.whitehouse.gov/.../hist02z1_fy2027.xlsx   (datasetUrl,  50)
--     two api.fiscaldata.treasury.gov MTS queries           (datasetUrl,   2)
--
-- ⛔ SO THE RULE IS: ASK EVERYTHING THE API PUBLISHES, not everything the
-- client currently renders. `is_chip_href` records which one the chip links to
-- today, because that still changes what a FINDING means — but it never
-- changes what gets ASKED.
--
-- ⚠ `overrides_stored_url` stays scoped to the chip href. "The reader is shown
-- a landing page while TT holds the document" is a claim about the link they
-- click, and widening it to a field nothing renders would overstate it.

-- ⚠ DROP first. The return type gains `is_chip_href`, and Postgres refuses to
-- `create or replace` a set-returning function whose OUT parameters changed
-- ("cannot change return type of existing function"). ⛔ A dropped function
-- comes back with a FRESH acl — i.e. EXECUTE granted to PUBLIC — which is
-- exactly why the revoke below is not optional ceremony.
drop function if exists treasury.reader_link_census();

create function treasury.reader_link_census()
returns table (
  source_url           text,    -- named to match source_url_census: same pipeline
  budgets              bigint,
  via                  text,    -- which data_source_info field(s) carry it
  is_chip_href         boolean, -- does src/App.tsx actually link to this one today
  overrides_stored_url bigint,  -- budgets shown this INSTEAD of a source_url they hold
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
  ), served as (
    select c.*,
           -- src/App.tsx TODAY: federal chips take `url || datasetUrl`, every
           -- other entity type takes `datasetUrl || url`. Recorded, not obeyed.
           case when c.entity_type = 'federal'
                then coalesce(c.sr_url, c.base_url)
                else coalesce(c.base_url, c.sr_url)
           end as chip_href
      from chip c
  ), unrolled as (
    -- ⭐ One row per (budget, PUBLISHED FIELD). Both fields of
    -- `data_source_info` reach the browser, so both get asked.
    select s.*, v.field, v.url
      from served s
      cross join lateral (values
        ('data_source_info.url',        s.sr_url),
        ('data_source_info.datasetUrl', s.base_url)
      ) as v(field, url)
     where v.url is not null
  ), counts as (
    select u.url,
           count(distinct u.id)                       as budgets,
           string_agg(distinct u.field, ' + ')        as via,
           bool_or(u.url = u.chip_href)               as is_chip_href,
           count(distinct u.id) filter (
             where u.url = u.chip_href
               and u.source_url is not null
               and u.source_url <> u.url
           )                                          as overrides_stored_url,
           count(distinct u.source_url) filter (where u.url = u.chip_href)
                                                      as distinct_stored_urls
      from unrolled u
     group by u.url
  ), sample as (
    select distinct on (u.url) u.url, u.data_source, u.entity, u.state, u.fiscal_year
      from unrolled u
     order by u.url, u.data_source, u.fiscal_year
  )
  select c.url, c.budgets, c.via, c.is_chip_href,
         c.overrides_stored_url, c.distinct_stored_urls,
         s.data_source, s.entity, s.state, s.fiscal_year
    from counts c
    join sample s on s.url = c.url
$function$;

-- ⚠⚠ THE DROP ABOVE THREW THE OLD ACL AWAY, so this is a brand-new function as
-- far as privileges go: `CREATE FUNCTION` grants EXECUTE to PUBLIC, `anon` is a
-- member of PUBLIC, and `ALTER DEFAULT PRIVILEGES` does not suppress it on this
-- instance (measured three times, including in a virgin schema). The revoke
-- must name PUBLIC — there is no explicit `anon` grant to remove, the leading
-- `=X/` in the ACL *is* the PUBLIC grant, so revoking from `anon` alone is a
-- silent no-op that looks exactly like a fix.
revoke all on function treasury.reader_link_census() from public, anon, authenticated;
grant execute on function treasury.reader_link_census() to service_role;

do $$
declare
  v_oid    oid;
  v_rows   bigint;
  v_served bigint;
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

  -- FENCE: ⚠⚠⚠ THE WHOLE POINT OF THIS MIGRATION. It must now return MORE
  -- URLs than the chip renders — if it returns only the chip hrefs, the
  -- second published field has gone unasked again and the WeHo 404 is back.
  select count(*) into v_rows   from treasury.reader_link_census();
  select count(*) into v_served from treasury.reader_link_census() where not is_chip_href;
  if v_served = 0 then
    raise exception
      'reader_link_census() returned % row(s) and NONE of them is a non-chip URL — '
      'it is asking the winner again, not everything data_source_info publishes', v_rows;
  end if;

  -- FENCE: still one row per URL, which is what lets the gate page it under
  -- an ORDER BY source_url. See tests/pagedReadOrdering.test.mjs.
  if v_rows <> (select count(distinct source_url) from treasury.reader_link_census()) then
    raise exception 'reader_link_census() returned duplicate URLs — paging would skip rows';
  end if;

  raise notice 'reader_link_census(): % URL(s), % of them published but not linked',
    v_rows, v_served;
end $$;
