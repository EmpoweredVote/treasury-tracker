-- West Hollywood: bind each published file to the ONE year it actually covers.
--
-- ⚠ Measured 2026-11-05 by parsing every row's check_date and binning it on a
-- July-June fiscal year. The publisher's FILE TITLES are not reliable and two
-- of them are actively misleading:
--
--   dataset       title        FY2019  FY2020  FY2021  FY2022  FY2023  FY2024  FY2025  FY2026
--   by9g-vc9g   "FY2018-19"    19,900   4,174
--   yjid-9pyh   "FY2019-20"        67  18,320
--   7kgt-b5t8   "FY2020-21"                87  15,830     424
--   yai6-dpmb   "FY2021-22"                        28  15,223     442
--   e46y-98wp   "FY2022-23"                                21  16,765     344
--   b8ph-69yc   "FY2022-24"                                38  17,762   5,707
--   y2yz-icwv   "FY2024-25"                                         5  11,199
--   5d72-njxw   "FY2025-26"                                                4   1,160  14,992
--
-- ⚠⚠ `check_date` is a TEXT column on four of these (7kgt, yai6, e46y, b8ph)
-- and mixes formats within one column -- "01-13-2022" beside "9/9/2021". Every
-- row still parses, but min()/max() on them sorts LEXICOGRAPHICALLY, which is
-- why the spans looked incoherent until each row was parsed individually.

-- ── 1. "FY2022-24" is NOT a FY2023 file ─────────────────────────────────
--
-- It was declared fiscal_years [2023, 2024]. FY2023 is already served in full
-- by e46y-98wp (16,765 rows); b8ph-69yc holds 38. Loading it into FY2023 as
-- well would have written a second, near-empty source over a complete year.
-- Two declared years also make the edge function refuse it outright
-- (assertSingleYearWhenSkippingFyFilter), which is why it never refreshed.
update treasury.data_sources
   set fiscal_years = array[2024]
 where name = 'West Hollywood Demand Register FY2022-24';

-- ── 2. Retire the FY2018 budget: NO published file covers it ────────────
--
-- ⚠⚠ THIS BUDGET WAS NEVER REAL. No West Hollywood dataset targets FY2018 --
-- by9g-vc9g carries 44 FY2018 rows out of 24,123 and declares FY2019. The
-- budget held 22 rows, every one of them $0 because the mapping read a column
-- (`amount_paid`) that dataset does not have, and the live API served
-- "West Hollywood FY2018: $0" to readers.
--
-- A fabricated zero is not a conservative figure, it is a wrong one: it tells
-- a reader the city spent nothing. There is no file to reload it from, so the
-- honest move is to stop publishing the year.
--
-- ⚠ Only the DEMAND REGISTER budget goes. West Hollywood's FY2018 "Budget
-- Expenditure Detail" and "Budget Revenue Detail" budgets are separate,
-- sourced, and untouched.
delete from treasury.transactions
 where budget_id in (
   select b.id from treasury.budgets b
    where b.data_source = 'West Hollywood Demand Register FY2018-19'
      and b.fiscal_year = 2018);

delete from treasury.budget_categories
 where budget_id in (
   select b.id from treasury.budgets b
    where b.data_source = 'West Hollywood Demand Register FY2018-19'
      and b.fiscal_year = 2018);

delete from treasury.budgets b
 where b.data_source = 'West Hollywood Demand Register FY2018-19'
   and b.fiscal_year = 2018;

-- ── 3. Refuse to leave the job half done ────────────────────────────────
do $$
declare n bigint;
begin
  select count(*) into n from treasury.budgets
   where data_source like 'West Hollywood Demand Register%' and fiscal_year = 2018;
  if n > 0 then raise exception 'West Hollywood FY2018 demand-register budget still present'; end if;

  select count(*) into n from treasury.data_sources
   where name = 'West Hollywood Demand Register FY2022-24'
     and fiscal_years <> array[2024];
  if n > 0 then raise exception 'FY2022-24 is still bound to more than FY2024'; end if;
end $$;
