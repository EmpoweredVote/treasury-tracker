-- Which CA State Controller revenue years are dominated by BOND PROCEEDS?
--
-- ⚠⚠⚠ WHY THIS EXISTS. West Hollywood FY2016 publishes $214,381,292 of
-- "revenue"; $85,015,000 of it is a bond issue. A reader watching that series
-- sees revenue jump 87% and then fall 38%, and the cause is borrowing, not
-- income. Nothing flagged it — not because the year is fine, but because
-- flags have only ever existed where a person spent a day looking.
--
-- Asking the whole fleet the same question finds 43 city-years across 35
-- entities, of which West Hollywood is the eleventh largest. Same correction
-- this repo applied to row coverage and out-of-period: ask every publisher,
-- not one.
--
-- ── ⚠⚠ LEAF ROWS ONLY ─────────────────────────────────────────────────────
--
-- `budget_categories` is a hierarchy, so "Other Financing Sources" sits above
-- "Revenue Bond Proceeds_Functional Revenues" holding the SAME figure. Summing
-- every matching row counts it twice.
--
-- ⚠ The first version dodged that with `max()`, which silently UNDERCOUNTED
-- the years carrying more than one kind of bond — Oakland FY2003 and San
-- Francisco FY2010 issue revenue AND general-obligation bonds. 41 years became
-- 43. A leaf is a row nothing else points at; sum those.
--
-- ── ⚠ WHAT THIS FUNCTION DOES NOT DECIDE ──────────────────────────────────
--
-- The threshold. It is a PARAMETER, passed in by
-- `scripts/generateBondFinancedRevenue.mjs`, which holds the single
-- published value. 20261104180000's rule stands: a baseline that lives in code
-- is reviewed in a PR diff, and mirroring it into the database would create a
-- second authority that can drift from the first.

create or replace function treasury.bond_financed_revenue_years(
  p_data_source text,
  p_threshold   numeric
)
returns table (
  entity       text,
  state        text,
  fiscal_year  int,
  dataset_type text,
  total        numeric,
  bond_amount  numeric,
  lines        text[],
  source_url   text,
  -- ⚠⚠ HOW MANY BUDGETS SHARE THIS BANNER'S KEY. A flag is keyed
  -- entity|state|year|dataset, so if an entity-year ever carries TWO revenue
  -- budgets — the Controller's, and a "Treasury Tracker derived: Total
  -- Governmental" series that may legitimately exclude bond proceeds — the
  -- same banner renders over both, and over the second one its figures would
  -- not match the total beside them. Measured 2026-11-09: every one of the 43
  -- flagged years has exactly ONE. The generator fails if that stops being
  -- true, rather than discovering it on a page.
  sibling_budgets int
)
language sql
stable
security definer
set search_path to 'treasury', 'public', 'pg_catalog'
as $$
  with leaf as (
    select c.budget_id, c.name, c.amount::numeric as amount
      from treasury.budget_categories c
     where c.name ilike '%Bond Proceeds%'
       -- ⚠ A LEAF: nothing points at it. Without this the parent roll-up is
       -- summed alongside its own child and every share doubles.
       and not exists (select 1 from treasury.budget_categories k where k.parent_id = c.id)
  ), agg as (
    select m.name, m.state, b.fiscal_year, b.dataset_type,
           b.total_budget::numeric as total,
           sum(l.amount) as bond_amount,
           array_agg(l.name order by l.amount desc, l.name)
             filter (where l.amount > 0) as lines,
           max(b.source_url) as source_url
      from treasury.budgets b
      join treasury.municipalities m on m.id = b.municipality_id
      join leaf l on l.budget_id = b.id
     where b.data_source = p_data_source
     group by m.name, m.state, b.fiscal_year, b.dataset_type, b.total_budget
  )
  select a.name, a.state, a.fiscal_year, a.dataset_type,
         a.total, a.bond_amount, a.lines, a.source_url,
         (select count(*)::int
            from treasury.budgets s
            join treasury.municipalities sm on sm.id = s.municipality_id
           where sm.name = a.name and sm.state = a.state
             and s.fiscal_year = a.fiscal_year
             and s.dataset_type = a.dataset_type)
    from agg a
   -- ⚠ `total > 0` is not decoration: a zero total makes every share infinite,
   -- and a year with no published revenue has nothing for a reader to misread.
   where a.total > 0
     and a.bond_amount > p_threshold * a.total
   order by a.bond_amount / a.total desc, a.name, a.fiscal_year
$$;

-- ⚠ PR #90's rule: a new definer function is granted to PUBLIC on creation and
-- must be revoked explicitly, or the next anon-execute sweep finds it.
revoke all on function treasury.bond_financed_revenue_years(text, numeric) from public, anon, authenticated;
grant execute on function treasury.bond_financed_revenue_years(text, numeric) to service_role;
