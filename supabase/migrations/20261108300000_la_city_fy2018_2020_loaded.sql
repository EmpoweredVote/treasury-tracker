-- LA City Checkbook: the last three CLOSED years the publisher serves.
--
-- 20261108100000 closed the gap as it had been written down — FY2021/22/23/26 —
-- and recorded that the gap was actually bigger than the declaration said,
-- because a `fiscal_years` array measures a DECLARATION and not a publisher.
-- This loads the three remaining closed years it named.
--
--     FY       published rows    TT rows    published total        ties
--     2018        751,841        751,841    $10,723,097,441.60      yes
--     2019        802,411        802,411    $10,863,104,159.71      yes
--     2020        775,335        775,335    $10,919,220,756.10      yes
--
-- Verified against controllerdata.lacity.org's own group-by, not TT's copy of
-- it: row count and total per year, then every department name and amount
-- against `$group=department_name`. All NINE years now tie department-for-
-- department, to the cent:
--
--     FY2018 51 | FY2019 51 | FY2020 51 | FY2021 52 | FY2022 55
--     FY2023 55 | FY2024 54 | FY2025 56 | FY2026 58   departments
--
-- ⭐ Trees for the three new years: +51, +51, +51. Rebuilding the six existing
-- years returned `+0 ~0 -0` against a 7.5M-row table. A no-change rebuild
-- being a genuine no-op is the whole basis for trusting drift detection, and
-- it is worth re-checking whenever the table's size changes materially.
--
-- ⚠⚠ ONE YEAR REMAINS OUT, AND IT IS A DECISION, NOT AN OVERSIGHT. FY2027
-- (~209,812 rows, ~$4.55B so far) is the CURRENT fiscal year: LA's year starts
-- in July, so FY2026 closed 2026-06-30. TT now holds every CLOSED year the
-- publisher serves. A live year grows weekly and would re-trigger
-- `verify:out-of-period` every month the way West Hollywood FY2025-26 does —
-- somebody should choose that deliberately rather than inherit it.
--
-- ⚠ The publisher also carries 6 rows outside any year it serves: FY2006 (3),
-- FY2007 (2), FY2011 (1), $121,312.98 all told. No declared year touches them.
--
-- ⚠⚠⚠ WHAT THIS COSTS, MEASURED, BECAUSE IT IS THE REASON TO STOP HERE.
-- `treasury.transactions` is now 7,527,734 rows — 2,372 MB heap + 1,997 MB
-- indexes — having started this session at 2.57M. The tree gate has moved with
-- it, and it runs on pg_cron where statement_timeout is 120s:
--
--     2.57M rows (before the covering index)   40.0s
--     2.57M rows (index + VACUUM)               4.3s
--     5.18M rows (+ LA FY2021/22/23/26)        13.5s
--     7.53M rows (+ LA FY2018/19/20)           21.7s   <- here
--
-- That is still 5.5x headroom, but the trend is linear in enrolled
-- transactions and ~129,000 buffers now come off disk every run because the
-- working set exceeds shared_buffers — a floor VACUUM cannot remove. MEASURE
-- THE GATE BEFORE THE NEXT LARGE LOAD, not after. A gate that times out does
-- not report a failure; it reports nothing.
update treasury.data_sources
   set fiscal_years = array[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
 where name = 'LA City Checkbook';

-- ⚠ The declaration must name exactly the years TT holds — no more, no fewer.
do $$
declare declared int[]; held int[];
begin
  select fiscal_years into declared
    from treasury.data_sources where name = 'LA City Checkbook';

  select array_agg(distinct fiscal_year order by fiscal_year) into held
    from treasury.budgets where data_source = 'LA City Checkbook';

  if declared is distinct from held then
    raise exception
      'LA City Checkbook declares % but TT holds % — a declaration must name exactly the years that exist',
      declared, held;
  end if;
end $$;
