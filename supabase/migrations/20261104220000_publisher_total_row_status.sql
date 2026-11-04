-- Refuse any budget holding a transaction equal to HALF its own headline total.
--
-- ⚠⚠⚠ WHAT WENT WRONG. Frisco's check registers end with a row carrying no
-- date, no vendor and the description `TOTAL`. TT loaded it as a payment, so
-- three years published at EXACTLY TWICE the truth -- $2,523,034,629.69 of
-- money nobody spent -- in public, for years:
--
--     FY      TT published        Frisco's own TOTAL
--     2018  2,163,355,443.22      1,081,755,767.17
--     2019  1,985,695,981.21      1,001,344,551.22
--     2022    879,807,220.41        439,934,311.30
--
-- ⚠⚠ NOT ONE EXISTING GATE COULD SEE IT. The tree tied to the total, the
-- total tied to the transactions, every row carried a real amount, and the
-- duplicate-label and negative-total counters were clean. A self-consistent
-- file had simply been counted twice -- and self-consistency is precisely what
-- every other gate measures. This one measures something else.
--
-- ⭐ THE ARITHMETIC IS THE TEST. A transaction worth exactly half its budget's
-- headline is the signature of a grand total counted as a payment. Unlike a
-- label it cannot be dodged by a publisher who leaves the description blank --
-- which Frisco's FY2022 file does, so a rule matching the word "TOTAL" would
-- have caught two of the three broken years and left the third at $879,807,220
-- against a real $439,934,311.
--
-- ⚠ Held at ZERO. Like the other counters that need no baseline and no
-- judgement, any hit is a defect, not a number to ratchet down.
--
-- The loader (scripts/lib/publisherTotalRow.mjs) stops this at parse time, but
-- that only protects budgets somebody RELOADS. This reads what is STORED, so it
-- covers the back catalogue a loader guard can never reach.
--
-- Measured 2026-11-04 after the Frisco repair: 585,585 budgets with a positive
-- headline, 0 hits, 9 seconds.

create or replace function treasury.publisher_total_row_status()
returns table (
  budget_id uuid,
  municipality text,
  fiscal_year int,
  dataset_type text,
  data_source text,
  total_budget numeric,
  amount numeric,
  description text
)
language sql
security definer
set search_path to 'treasury', 'pg_catalog'
as $$
  select b.id, m.name, b.fiscal_year, b.dataset_type,
         b.data_source, b.total_budget, t.amount, t.description
    from treasury.budgets b
    join treasury.transactions t on t.budget_id = b.id
    join treasury.municipalities m on m.id = b.municipality_id
   where b.total_budget > 0
     and abs(2 * t.amount - b.total_budget) < 0.01
   order by t.amount desc
$$;

-- ⛔ CREATE FUNCTION grants EXECUTE to PUBLIC. Revoke, as the sweep requires.
revoke all on function treasury.publisher_total_row_status() from public, anon, authenticated;
