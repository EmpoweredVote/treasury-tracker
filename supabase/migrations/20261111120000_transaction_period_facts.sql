-- Two facts about every transactions file's PERIOD, asked of the whole fleet.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ⭐⭐⭐ WHY THESE EXIST: COVERAGE WAS A RECORD OF ATTENTION
-- ══════════════════════════════════════════════════════════════════════════
--
-- West Hollywood's five straddle banners and McKinney's eleven-month banner
-- were both written by hand, because somebody spent a day on that city. So
-- "unflagged" never meant "checked and fine", only "nobody looked" — the same
-- defect PR #371 corrected for bond-financed revenue.
--
-- ⚠⚠ ASKING ALL 43 TRANSACTION BUDGETS THE SECOND QUESTION FOUND A YEAR
-- NOBODY HAD EVER FLAGGED: Frisco FY2021 holds TEN months. Its file stops on
-- 2021-07-29 and contains no payment in August or September 2021, and it is
-- drawn beside Frisco FY2020 (twelve months, $377.9M) and FY2022 (twelve
-- months, $439.9M). A reader sees Frisco spending dip. Frisco has its own
-- anomaly register and its own row-coverage baseline, and neither asked.
--
-- ── ⚠ WHAT THESE FUNCTIONS DO NOT DECIDE ──────────────────────────────────
--
-- The threshold. It is a PARAMETER, passed in by
-- `scripts/generateFiscalPeriodFlags.mjs`, which holds the single published
-- value. 20261104180000's rule stands: a baseline that lives in code is
-- reviewed in a PR diff, and mirroring it into the database would create a
-- second authority that can drift from the first.
--
-- ── WHAT THE PERIOD IS ────────────────────────────────────────────────────
--
-- Identical to 20261105030000's definition, deliberately: one notion of "this
-- budget's fiscal period" in the schema, not two that can disagree.
--
--   fiscal_year_start_month = 1  -> FY2019 is 2019-01-01 .. 2019-12-31
--   otherwise                    -> FY2019 starts in calendar 2018
--
-- ⚠ A budget with a NULL fiscal_year_start_month is EXCLUDED, not reported
-- clean. We do not know its period, so we cannot say anything falls outside
-- it, and a rule that silently passed those would report ignorance as health.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. DISTORTION: money in this file that was paid in another year, and money
--    paid in this year that sits in another file.
-- ──────────────────────────────────────────────────────────────────────────
--
-- ⭐⭐ TWO AXES, ONE METRIC. The hand-written West Hollywood flags needed a
-- second, separate rule — "both sides of a seam are flagged" — because FY2020
-- and FY2025 are almost perfectly clean in themselves and still read wrong:
-- FY2025 shows $132.28M against FY2024's $249.36M and looks like spending
-- halved. Measuring the RECEIVING side as its own share makes that fall out of
-- one number instead of a bookkeeping rule somebody has to maintain:
--
--   own_share        this file's dollars that were paid outside its period
--   displaced_share  dollars paid inside its period that sit in another file
--
-- A year is distorted if EITHER crosses the threshold. Measured 2026-11-11,
-- that reproduces the five hand-written banners exactly, with no per-entity
-- judgement left in the register.

create or replace function treasury.transaction_period_distortion(p_threshold numeric)
returns table (
  entity        text,
  state         text,
  fiscal_year   int,
  dataset_type  text,
  data_source   text,
  period_start  date,
  period_end    date,
  total         numeric,
  -- ⚠ The page draws `budgets.total_budget`. If the stored total ever stops
  -- agreeing with the rows beneath it, prose built from the rows would
  -- contradict the figure printed beside it — the #364 defect. Both are
  -- returned so the generator can refuse rather than publish the mismatch.
  txn_sum       numeric,
  out_rows      bigint,
  out_amount    numeric,
  rows_before   bigint,
  amount_before numeric,
  rows_after    bigint,
  amount_after  numeric,
  earliest_out  date,
  latest_out    date,
  in_window     numeric,
  elsewhere_amount numeric,
  elsewhere_rows   bigint,
  elsewhere_years  int[],
  own_share        numeric,
  displaced_share  numeric,
  -- ⚠ An entity's EARLIEST and LATEST loaded year can only see one neighbour,
  -- so its displaced_share is a LOWER BOUND. Every entity's loaded years are
  -- contiguous today; the generator states this rather than assuming it.
  has_prior_year boolean,
  has_next_year  boolean,
  -- ⚠⚠ HOW MANY BUDGETS SHARE THIS BANNER'S KEY. A flag is keyed
  -- entity|state|year|dataset, so an entity-year carrying two transactions
  -- budgets would render the same banner over a total it does not describe.
  sibling_budgets int,
  -- Still being appended to: the source syncs automatically AND this is the
  -- newest year TT holds for the entity. West Hollywood's FY2025-26 register
  -- is the city's current one and grows weekly, which is why its copy must
  -- pin its figures to a date.
  still_growing boolean,
  source_url    text
)
language sql
stable
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
  with w as (
    select b.id, b.municipality_id, b.fiscal_year::int as fy, b.dataset_type,
           b.total_budget::numeric as total, b.data_source,
           m.name as entity, m.state,
           make_date(case when b.fiscal_year_start_month = 1 then b.fiscal_year::int
                          else (b.fiscal_year - 1)::int end,
                     b.fiscal_year_start_month::int, 1) as ps
      from treasury.budgets b
      join treasury.municipalities m on m.id = b.municipality_id
     where b.dataset_type = 'transactions'
       and b.fiscal_year_start_month is not null
       and b.fiscal_year is not null
  ), p as (
    select w.*, (w.ps + interval '1 year')::date as pe from w
  ), measured as (
    select
      p.*,
      own.txn_sum, own.out_rows, own.out_amount,
      own.rows_before, own.amount_before, own.rows_after, own.amount_after,
      own.earliest_out, own.latest_out, own.in_window,
      coalesce(el.amt, 0) as elsewhere_amount,
      coalesce(el.rows, 0) as elsewhere_rows,
      el.years as elsewhere_years,
      (select count(*)::int from treasury.budgets s
         where s.municipality_id = p.municipality_id
           and s.fiscal_year = p.fy and s.dataset_type = p.dataset_type) as sibling_budgets,
      exists (select 1 from treasury.budgets s where s.municipality_id = p.municipality_id
                and s.dataset_type = 'transactions' and s.fiscal_year = p.fy - 1) as has_prior_year,
      exists (select 1 from treasury.budgets s where s.municipality_id = p.municipality_id
                and s.dataset_type = 'transactions' and s.fiscal_year = p.fy + 1) as has_next_year,
      ds.sync_frequency, ds.is_enabled, ds.api_type, ds.base_url, ds.dataset_id,
      (p.fy = (select max(s.fiscal_year) from treasury.budgets s
                where s.municipality_id = p.municipality_id
                  and s.dataset_type = 'transactions')) as is_newest_year
    from p
    cross join lateral (
      select coalesce(sum(t.amount), 0) as txn_sum,
             count(*) filter (where t.payment_date is not null
                              and (t.payment_date < p.ps or t.payment_date >= p.pe)) as out_rows,
             coalesce(sum(t.amount) filter (where t.payment_date is not null
                              and (t.payment_date < p.ps or t.payment_date >= p.pe)), 0) as out_amount,
             count(*) filter (where t.payment_date < p.ps) as rows_before,
             coalesce(sum(t.amount) filter (where t.payment_date < p.ps), 0) as amount_before,
             count(*) filter (where t.payment_date >= p.pe) as rows_after,
             coalesce(sum(t.amount) filter (where t.payment_date >= p.pe), 0) as amount_after,
             min(t.payment_date) filter (where t.payment_date < p.ps or t.payment_date >= p.pe) as earliest_out,
             max(t.payment_date) filter (where t.payment_date < p.ps or t.payment_date >= p.pe) as latest_out,
             coalesce(sum(t.amount) filter (where t.payment_date >= p.ps and t.payment_date < p.pe), 0) as in_window
        from treasury.transactions t where t.budget_id = p.id
    ) own
    left join lateral (
      select sum(t.amount) as amt, count(*) as rows,
             array_agg(distinct b2.fiscal_year::int order by b2.fiscal_year::int) as years
        from treasury.transactions t
        join treasury.budgets b2 on b2.id = t.budget_id
       where b2.dataset_type = 'transactions'
         and b2.municipality_id = p.municipality_id
         and b2.id <> p.id
         and t.payment_date >= p.ps and t.payment_date < p.pe
    ) el on true
    left join treasury.data_sources ds on ds.name = p.data_source
  )
  select
    m.entity, m.state, m.fy, m.dataset_type, m.data_source, m.ps, m.pe,
    m.total, m.txn_sum,
    m.out_rows, m.out_amount, m.rows_before, m.amount_before,
    m.rows_after, m.amount_after, m.earliest_out, m.latest_out,
    m.in_window, m.elsewhere_amount, m.elsewhere_rows, m.elsewhere_years,
    -- ⚠ Shares are computed over the SIGNED sums, the same arithmetic the
    -- page's total uses. A register whose share disagreed with the figure
    -- drawn beside it would be the defect this rule exists to prevent.
    case when m.total > 0 then m.out_amount / m.total end,
    case when (m.in_window + m.elsewhere_amount) > 0
         then m.elsewhere_amount / (m.in_window + m.elsewhere_amount) end,
    m.has_prior_year, m.has_next_year, m.sibling_budgets,
    (coalesce(m.is_enabled, false) and coalesce(m.sync_frequency, 'manual') <> 'manual'
       and m.is_newest_year),
    case when m.api_type = 'socrata' and m.dataset_id is not null
         then m.base_url || '/resource/' || m.dataset_id || '.json'
         else m.base_url end
  from measured m
  where m.total > 0
    and (
      coalesce(m.out_amount / nullif(m.total, 0), 0) > p_threshold
      or coalesce(m.elsewhere_amount / nullif(m.in_window + m.elsewhere_amount, 0), 0) > p_threshold
    )
  order by greatest(
      coalesce(m.out_amount / nullif(m.total, 0), 0),
      coalesce(m.elsewhere_amount / nullif(m.in_window + m.elsewhere_amount, 0), 0)
    ) desc, m.entity, m.fy
$$;

revoke all on function treasury.transaction_period_distortion(numeric) from public, anon, authenticated;
grant execute on function treasury.transaction_period_distortion(numeric) to service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. ABSENT MONTHS: a closed fiscal period with months nothing accounts for.
-- ──────────────────────────────────────────────────────────────────────────
--
-- ⭐⭐⭐ THIS IS THE RULE THAT RETIRES ITSELF, AND THAT IS THE WHOLE POINT.
--
-- McKinney's eleven-month banner is true today and becomes FALSE the moment
-- the city posts September 2026 and TT reloads — a banner telling a reader a
-- COMPLETE year is incomplete is its own misinformation. Today only a person
-- remembering to delete it stands between those two states. Computed from the
-- file, the flag simply stops being emitted.
--
-- ── ⚠⚠ A MONTH IN A SIBLING FILE IS DISPLACED, NOT ABSENT ─────────────────
--
-- West Hollywood FY2025 has no payment dated July 2024 — but 1,497 payments
-- worth $21,028,719.61 from that month sit in the FY2022-24 register. The
-- money is not missing; it is in the next file along, which is exactly what
-- the distortion rule above already says about that year. Counting it absent
-- here would put two different banners on one key and tell the reader the
-- money had vanished.
--
-- So a month is ABSENT only when no transactions budget of the same entity
-- holds a payment in it. Measured 2026-11-11 that leaves two years, and they
-- do not collide with the distortion rule:
--
--   Frisco  FY2021  Aug 2021, Sep 2021   0 rows anywhere   10 of 12 months
--   McKinney FY2026 Sep 2026             0 rows anywhere   11 of 12 months
--
-- ── ⚠ ONLY CLOSED PERIODS ─────────────────────────────────────────────────
--
-- A year still in progress is missing months because it has not happened yet.
-- Flagging that would put a banner on every current year forever, which is how
-- readers learn to skip banners.


create or replace function treasury.transaction_absent_months()
returns table (
  entity        text,
  state         text,
  fiscal_year   int,
  dataset_type  text,
  data_source   text,
  period_start  date,
  period_end    date,
  total         numeric,
  txn_sum       numeric,
  row_count     bigint,
  first_payment date,
  last_payment  date,
  months_in_period int,
  months_covered   int,
  absent_months    text[],
  -- The entity's own OTHER complete years, so the copy can say what a full one
  -- looks like for this city without claiming anything about a particular
  -- neighbour. ⚠ A year cannot be its own control.
  complete_years      int[],
  complete_year_totals numeric[],
  sibling_budgets int,
  still_growing   boolean,
  source_url      text
)
language sql
stable
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
  with p as (
    select b.id, b.municipality_id, b.fiscal_year::int as fy, b.dataset_type,
           b.total_budget::numeric as total, b.data_source,
           m.name as entity, m.state,
           make_date(case when b.fiscal_year_start_month = 1 then b.fiscal_year::int
                          else (b.fiscal_year - 1)::int end,
                     b.fiscal_year_start_month::int, 1) as ps,
           (make_date(case when b.fiscal_year_start_month = 1 then b.fiscal_year::int
                          else (b.fiscal_year - 1)::int end,
                     b.fiscal_year_start_month::int, 1) + interval '1 year')::date as pe
      from treasury.budgets b
      join treasury.municipalities m on m.id = b.municipality_id
     where b.dataset_type = 'transactions'
       and b.fiscal_year_start_month is not null
       and b.fiscal_year is not null
  ),
  -- ⭐ ONE PASS over transactions. Everything below joins against these few
  -- hundred rows instead of re-scanning per budget per month.
  --
  -- ⚠⚠ THE FIRST VERSION OF THIS FUNCTION TIMED OUT. It recomputed
  -- `count(distinct date_trunc('month', payment_date))` inside a lateral for
  -- every candidate row, which on Los Angeles' nine 750,000-row years is a
  -- full scan per budget per month. Postgres cancelled it at the statement
  -- timeout. A gate that cannot finish is a gate that reports nothing.
  stats as (
    select t.budget_id,
           coalesce(sum(t.amount), 0) as txn_sum,
           count(*) as row_count,
           min(t.payment_date) as first_payment,
           max(t.payment_date) as last_payment
      from treasury.transactions t group by t.budget_id
  ),
  monthly as (
    select t.budget_id, date_trunc('month', t.payment_date)::date as mo
      from treasury.transactions t where t.payment_date is not null
     group by 1, 2
  ),
  -- Which months any transactions budget of an entity covers at all.
  entity_months as (
    select p.municipality_id, mo.mo
      from monthly mo join p on p.id = mo.budget_id
     group by 1, 2
  ),
  absent as (
    select p.id, p.municipality_id,
           array_agg(to_char(g, 'FMMonth YYYY') order by g) as months,
           count(*)::int as n
      from p, generate_series(p.ps, p.pe - interval '1 day', interval '1 month') g
     where not exists (select 1 from monthly mo
                        where mo.budget_id = p.id and mo.mo = g::date)
       -- ⚠⚠ A month in a SIBLING file is DISPLACED, not absent. West
       -- Hollywood FY2025 has no July 2024 payment of its own, but 1,497 of
       -- them worth $21,028,719.61 sit in the FY2022-24 register. The money is
       -- not missing, and the distortion rule above already describes that
       -- year. Counting it absent here would put two banners on one key and
       -- tell a reader the money had vanished.
       and not exists (select 1 from entity_months em
                        where em.municipality_id = p.municipality_id and em.mo = g::date)
     group by p.id, p.municipality_id
  ),
  covered as (
    select p.id, p.municipality_id, p.fy, p.total,
           count(*) filter (where mo.mo >= p.ps and mo.mo < p.pe)::int as months_covered
      from p left join monthly mo on mo.budget_id = p.id
     group by p.id, p.municipality_id, p.fy, p.total
  ),
  complete as (
    select c.municipality_id,
           array_agg(c.fy order by c.fy) as years,
           array_agg(c.total order by c.fy) as totals
      from covered c where c.months_covered = 12
     group by c.municipality_id
  )
  select
    p.entity, p.state, p.fy, p.dataset_type, p.data_source, p.ps, p.pe,
    p.total, s.txn_sum, s.row_count, s.first_payment, s.last_payment,
    12, cv.months_covered, a.months,
    (select array_agg(y order by y) from unnest(cp.years) y where y <> p.fy),
    (select array_agg(t order by y) from unnest(cp.years, cp.totals) u(y, t) where y <> p.fy),
    (select count(*)::int from treasury.budgets sb
       where sb.municipality_id = p.municipality_id
         and sb.fiscal_year = p.fy and sb.dataset_type = p.dataset_type),
    (coalesce(ds.is_enabled, false) and coalesce(ds.sync_frequency, 'manual') <> 'manual'
       and p.fy = (select max(sb.fiscal_year) from treasury.budgets sb
                    where sb.municipality_id = p.municipality_id
                      and sb.dataset_type = 'transactions')),
    case when ds.api_type = 'socrata' and ds.dataset_id is not null
         then ds.base_url || '/resource/' || ds.dataset_id || '.json'
         else ds.base_url end
  from p
  join absent a on a.id = p.id
  join covered cv on cv.id = p.id
  join stats s on s.budget_id = p.id
  left join complete cp on cp.municipality_id = p.municipality_id
  left join treasury.data_sources ds on ds.name = p.data_source
  -- ⚠ CLOSED PERIODS ONLY.
  where p.pe <= current_date
    and p.total > 0
  order by a.n desc, p.entity, p.fy
$$;

revoke all on function treasury.transaction_absent_months() from public, anon, authenticated;
grant execute on function treasury.transaction_absent_months() to service_role;
