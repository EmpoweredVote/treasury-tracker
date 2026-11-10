-- The two counts `npm run verify:source-urls` needs, and cannot get any other way.
--
-- ⚠⚠⚠ WHY THIS EXISTS AT ALL. `budgets.source_url` is read by NO gate in this
-- repo. Not the tie gate, not the per-capita guard, not the frozen invariant,
-- not the scope sweep — every one of them reads MONEY or IDENTITY. So in
-- 2026-10 the Federal Audit Clearinghouse's 302 to a presigned S3 object
-- (`X-Amz-Expires=30` — thirty SECONDS) was stamped onto 227 Alaska rows, and
-- every figure on those pages was right while the only thing a reader could
-- click was dead. The new gate asks the live web whether each stored citation
-- still resolves; these functions tell it what to ask about.
--
-- ⚠ PostgREST cannot GROUP BY, and the gate must not page 585,644 budget rows
-- into Node to count 1,857 distinct URLs. Same reasoning as
-- `treasury.transaction_roots()` (20261107202917): roll up in the database,
-- ship the rollup.
--
-- ⚠ READ-ONLY, and deliberately so. Neither function writes, and neither
-- mirrors a baseline into a table — the baselines for this gate live in
-- `scripts/data/sourceUrlExceptions.mjs` and `scripts/data/sourceUrlCoverage.mjs`
-- ON PURPOSE, because 20261104180000 settled that question: "Mirroring them
-- into a table would create a second authority that can drift from the first."
-- Postgres also cannot fetch a URL, so the asking stays in the CLI gate.

-- ── Every distinct citation TT publishes, with one budget named so a failure
--    report can say WHOSE page is broken rather than just which string is ────
create or replace function treasury.source_url_census()
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
  -- ⚠ DISTINCT ON picks ONE budget per URL, ORDERED, so the sample is stable
  -- across runs. An unordered pick would make every report's text churn and
  -- hide whether anything actually changed.
  --
  -- ⚠⚠ TWO SINGLE PASSES, NOT A LATERAL. The obvious shape joins the per-URL
  -- counts to a `lateral (… where b2.source_url = s.source_url limit 1)`, which
  -- is 1,857 separate scans of a 585,644-row table with no index on
  -- `source_url` — it ran past the statement timeout and returned NOTHING.
  -- Measured, not guessed. Two sequential passes over the same rows finish in
  -- about a second. Same lesson as transaction_roots: group once, join after.
  with counts as (
    select b.source_url, count(*) as budgets
      from treasury.budgets b
     where b.source_url is not null
     group by b.source_url
  ), sample as (
    select distinct on (b.source_url)
           b.source_url, b.data_source, b.fiscal_year, b.municipality_id
      from treasury.budgets b
     where b.source_url is not null
     order by b.source_url, b.data_source, b.fiscal_year
  )
  select c.source_url, c.budgets, s.data_source, m.name, m.state, s.fiscal_year
    from counts c
    join sample s on s.source_url = c.source_url
    left join treasury.municipalities m on m.id = s.municipality_id
$$;

-- ── Budgets that cite NOTHING — the degenerate case of the same defect ──────
--
-- ⚠⚠ There are ~24,960 of them, so the gate RATCHETS on this rather than
-- failing on its existence: a gate that is red by design is a gate nobody
-- reads. The counts are grouped in Node (one normalisation, in one place);
-- this just hands over the raw per-source tally.
create or replace function treasury.uncited_budget_census()
returns table (data_source text, budgets bigint)
language sql
stable
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
  select coalesce(b.data_source, '(null)'), count(*)
    from treasury.budgets b
   where b.source_url is null
   group by 1
$$;

-- ⚠ Service-role only. These expose nothing sensitive, but PR #90's rule
-- stands: a new definer function is granted to PUBLIC on creation and must be
-- revoked explicitly, or the next anon-execute sweep finds it.
-- See reference_definer_function_public_execute.
revoke all on function treasury.source_url_census() from public, anon, authenticated;
revoke all on function treasury.uncited_budget_census() from public, anon, authenticated;
grant execute on function treasury.source_url_census() to service_role;
grant execute on function treasury.uncited_budget_census() to service_role;
