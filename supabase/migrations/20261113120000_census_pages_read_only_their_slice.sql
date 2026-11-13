-- Census pages read only their own slice of `treasury.budgets`.
--
-- ⚠⚠⚠ THE PROBLEM. `npm run verify:source-urls` paged `source_url_census()`
-- through PostgREST with `.order().range()`. PostgREST wraps the function call,
-- so EVERY page re-ran the WHOLE function: two full scans of `budgets` plus a
-- sort that spilled to disk. Measured in pg_stat_statements on 2026-11-13:
-- 675 calls since the 2026-11-12 stats reset, 377 MB read from disk and 119 MB
-- of temp written PER CALL — 249 GB read in ~19 hours. It was the single
-- largest Disk IO consumer on the shared E.V Backend project, which is what
-- tripped Supabase's "Disk IO budget" warning (ev-cto decision 0038).
-- `uncited_budget_census()` (199 MB/call) and `reader_link_census()`
-- (169 MB/call) had the same shape at a smaller size.
--
-- ⭐ THE FIX.
--   1. A covering partial index on `budgets(source_url, data_source,
--      fiscal_year) include (municipality_id) where source_url is not null`.
--      Its order IS the census's order (URL, then the DISTINCT ON tie-break),
--      so a page is an index range read with no sort.
--   2. `source_url_census_page(after_url, page_size)`: KEYSET paging. Each call
--      reads only the URLs after `after_url`, so one full run reads the index
--      once in total instead of the table once per page. Same columns, same
--      counts, same sample rule as `source_url_census()`.
--   3. A partial index for the uncited census (`where source_url is null`,
--      ~25k of ~585k rows) and an index on `data_source_id` (~800 non-null
--      rows) for the reader-link census join. Neither function changes.
--
-- ⚠ `source_url_census()` is KEPT, unchanged, so nothing that still calls it
-- breaks. The gate no longer pages it.
--
-- ⚠ The indexes were built with CREATE INDEX CONCURRENTLY outside this
-- migration (budgets takes writes from cron syncs; a plain CREATE INDEX blocks
-- them for the build). The IF NOT EXISTS forms below are what a fresh database
-- needs and are no-ops on production.

create index if not exists budgets_source_url_census_idx
  on treasury.budgets (source_url, data_source, fiscal_year)
  include (municipality_id)
  where source_url is not null;

create index if not exists budgets_uncited_data_source_idx
  on treasury.budgets (data_source)
  where source_url is null;

create index if not exists budgets_data_source_id_idx
  on treasury.budgets (data_source_id)
  where data_source_id is not null;

-- ── One page of the census: the `page_size` URLs that sort after `after_url` ─
--
-- ⚠ Same output columns as `source_url_census()` so the gate's pipeline is
-- unchanged. `after_url = null` means "from the start". The caller pages by
-- passing the LAST `source_url` of the previous page and stops on a short page.
--
-- ⚠ TOTAL ORDER: `source_url` is unique in the result (one row per URL), so
-- keyset paging on it can neither skip nor repeat a URL.
create or replace function treasury.source_url_census_page(
  after_url text default null,
  page_size int default 1000
)
returns table (
  source_url        text,
  budgets           bigint,
  sample_source     text,
  sample_entity     text,
  sample_state      text,
  sample_fiscal_year int
)
language sql
stable
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
  with urls as (
    -- The next `page_size` distinct URLs, read from the index in order.
    --
    -- ⚠⚠ `coalesce(after_url, '')`, NOT `(after_url is null or … > after_url)`.
    -- The function's plan is built with `after_url` unknown, and an OR there
    -- cannot become an index condition — so every page scanned the index from
    -- its first entry. Measured on the first draft: ~650 MB of buffer reads per
    -- page. '' sorts before every non-empty string, and NULLs are excluded.
    select distinct b.source_url
      from treasury.budgets b
     where b.source_url is not null
       and b.source_url > coalesce(after_url, '')
     order by b.source_url
     limit greatest(page_size, 1)
  ), slice as (
    -- Every budget citing one of those URLs, in index order, with the per-URL
    -- count. DISTINCT ON keeps the first row by (data_source, fiscal_year):
    -- the same sample rule as source_url_census().
    select distinct on (b.source_url)
           b.source_url,
           count(*) over (partition by b.source_url) as budgets,
           b.data_source, b.fiscal_year, b.municipality_id
      from treasury.budgets b
     where b.source_url is not null
       and b.source_url >= (select min(u.source_url) from urls u)
       and b.source_url <= (select max(u.source_url) from urls u)
     order by b.source_url, b.data_source, b.fiscal_year
  )
  select s.source_url, s.budgets, s.data_source, m.name, m.state, s.fiscal_year
    from slice s
    left join treasury.municipalities m on m.id = s.municipality_id
   order by s.source_url
$$;

-- ⚠ Service-role only, like every census here. A new definer function is
-- granted to PUBLIC on creation and must be revoked explicitly.
revoke all on function treasury.source_url_census_page(text, int) from public, anon, authenticated;
grant execute on function treasury.source_url_census_page(text, int) to service_role;
