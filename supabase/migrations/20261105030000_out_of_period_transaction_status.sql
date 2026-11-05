-- Find transactions dated OUTSIDE the fiscal period of the budget holding them.
--
-- ⚠⚠ WHAT PROMPTED IT. Frisco's FY2019 check register opens with a row dated
-- 2009-04-05 -- ten years outside its own fiscal year -- for $2,556,546.04.
-- TT read the file correctly; the publisher typed 2009 for 2019. Every other
-- signal agrees it belongs on 2019-04-05:
--
--     * the biweekly payroll series runs on FRIDAYS, 14 days apart, 25 times
--     * its ONLY 28-day gap is 2019-03-22 -> 2019-04-19
--     * NO row anywhere in the file is dated 2019-04-05
--     * 2019-04-05 was a Friday; 2009-04-05 was a Sunday
--     * $2,556,546.04 sits inside the series' $2.37M-$2.68M range
--
-- ⚠ TT DOES NOT CORRECT IT. The Milledgeville rule: reflect what the publisher
-- published and flag it. A silent date rewrite is a judgement made on the
-- reader's behalf that the reader cannot see.
--
-- ── ⚠⚠ WHY NO EXISTING GATE SEES THIS ────────────────────────────────────
--
-- The amount is right, so every total ties: the tree ties to the budget, the
-- budget ties to the transactions, and the row is a real payment the city
-- really made. Only the DATE is wrong, and nothing was measuring dates. This
-- is the same shape as the publisher TOTAL row -- a file that is perfectly
-- self-consistent and still says something untrue.
--
-- ── WHAT THE PERIOD IS ───────────────────────────────────────────────────
--
-- fiscal_year_start_month = 1  -> FY2019 is 2019-01-01 .. 2019-12-31
-- otherwise                    -> FY2019 starts in calendar 2018
--                                 (Frisco fsm=10: 2018-10-01 .. 2019-09-30)
--
-- ⚠ A budget with a NULL fiscal_year_start_month is NOT reported clean -- it
-- is EXCLUDED and counted separately. We do not know its period, so we cannot
-- say a row falls outside it, and a gate that silently passed those would be
-- reporting ignorance as a clean bill of health.
--
-- ⚠ Rows with a NULL payment_date are not out of period either; they have no
-- date to judge. scripts/lib/sourceMappingChecks.mjs covers a mapping that
-- leaves every date NULL.
--
-- Measured 2026-11-05: 41 transaction budgets, 9 with hits, 103 rows.
-- Frisco FY2019 is 1 of them; the other 102 are West Hollywood, a DIFFERENT
-- defect -- zero-value voids and refunds carrying the ORIGINAL transaction's
-- date, out of two-year files ("FY2018-19", "FY2022-24") split across budgets.

create or replace function treasury.out_of_period_transaction_status()
returns table (
  budget_id uuid,
  municipality text,
  state text,
  fiscal_year int,
  dataset_type text,
  data_source text,
  period_start date,
  period_end date,
  out_rows bigint,
  out_amount numeric,
  earliest date,
  latest date,
  sample jsonb
)
language sql
security definer
set search_path to 'treasury', 'pg_catalog'
as $$
  with scoped as (
    select b.id, b.fiscal_year, b.dataset_type, b.data_source,
           m.name as municipality, m.state,
           make_date(
             case when b.fiscal_year_start_month = 1 then b.fiscal_year::int
                  else (b.fiscal_year - 1)::int end,
             b.fiscal_year_start_month::int, 1) as period_start
      from treasury.budgets b
      join treasury.municipalities m on m.id = b.municipality_id
     where b.dataset_type = 'transactions'
       and b.fiscal_year_start_month is not null
       and b.fiscal_year is not null
  ),
  windowed as (
    select s.*, (s.period_start + interval '1 year')::date as period_end from scoped s
  )
  select w.id, w.municipality, w.state, w.fiscal_year::int, w.dataset_type,
         w.data_source, w.period_start, w.period_end,
         count(t.id) as out_rows,
         coalesce(sum(t.amount), 0) as out_amount,
         min(t.payment_date) as earliest,
         max(t.payment_date) as latest,
         (select jsonb_agg(x)
            from (select t2.payment_date, t2.amount, t2.description
                    from treasury.transactions t2
                   where t2.budget_id = w.id
                     and t2.payment_date is not null
                     and (t2.payment_date < w.period_start
                          or t2.payment_date >= w.period_end)
                   order by t2.payment_date
                   limit 5) x) as sample
    from windowed w
    join treasury.transactions t on t.budget_id = w.id
   where t.payment_date is not null
     and (t.payment_date < w.period_start or t.payment_date >= w.period_end)
   group by w.id, w.municipality, w.state, w.fiscal_year, w.dataset_type,
            w.data_source, w.period_start, w.period_end
   order by count(t.id) desc, w.municipality, w.fiscal_year
$$;

-- ⛔ CREATE FUNCTION grants EXECUTE to PUBLIC. Revoke, as the sweep requires.
revoke all on function treasury.out_of_period_transaction_status() from public, anon, authenticated;

-- How many budgets the gate could actually evaluate, so "no hits" can be told
-- apart from "looked at nothing" -- and how many it had to skip.
create or replace function treasury.out_of_period_coverage()
returns table (evaluated bigint, skipped_no_start_month bigint)
language sql
security definer
set search_path to 'treasury', 'pg_catalog'
as $$
  select count(*) filter (where b.fiscal_year_start_month is not null and b.fiscal_year is not null),
         count(*) filter (where b.fiscal_year_start_month is null or b.fiscal_year is null)
    from treasury.budgets b
   where b.dataset_type = 'transactions'
$$;

revoke all on function treasury.out_of_period_coverage() from public, anon, authenticated;
