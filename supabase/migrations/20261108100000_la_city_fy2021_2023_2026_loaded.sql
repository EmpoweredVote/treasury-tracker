-- LA City Checkbook: the four missing years are loaded, so declare them again.
--
-- This reverses 20261105150000_la_city_declared_years.sql, which narrowed the
-- declaration to {2024, 2025} precisely so the gap would be written down rather
-- than quietly tolerated. That migration said reversing it is one line plus a
-- load. This is that reversal, after the load.
--
--     FY       published rows    TT rows    published total        ties
--     2021        584,697        584,697    $11,134,173,303.60      yes
--     2022        599,460        599,460     $9,933,770,635.49      yes
--     2023        682,006        682,006    $11,986,940,475.86      yes
--     2026        747,363        747,363    $14,214,487,556.41      yes
--
-- Verified against controllerdata.lacity.org's own
-- `$select=fiscal_year,count(1),sum(dollar_amount)&$group=fiscal_year` — the
-- PUBLISHER's arithmetic, not TT's. A tree built from TT's transactions always
-- ties to TT's transactions; that proves nothing on its own.
--
-- ⚠⚠⚠ THE GAP WAS BIGGER THAN THE DECLARATION SAID, AND FOUR YEARS OF IT
-- REMAIN OPEN. The 2026-11-05 migration framed the gap as FY2021/22/23/26
-- because that is what `fiscal_years` happened to list. Asked directly, the
-- publisher serves more:
--
--     FY2018    751,841 rows   $10,723,097,441.60   NOT LOADED
--     FY2019    802,411 rows   $10,863,104,159.71   NOT LOADED
--     FY2020    775,335 rows   $10,919,220,756.10   NOT LOADED
--     FY2027    209,812 rows    $4,547,543,144.69   NOT LOADED, IN PROGRESS
--
-- ⚠ A COVERAGE FIGURE MEASURES A DECLARATION, NOT A PUBLISHER. The gap was
-- never four years; it was eight. Ask the host what it has EVER served before
-- believing a `fiscal_years` array.
--
-- ⚠⚠ FY2026 IS COMPLETE; FY2027 IS THE CURRENT YEAR. `fiscal_year_start_month`
-- is 7, so FY2026 ran July 2025–June 2026 and closed before this was written.
-- The earlier migration called FY2026 "the CURRENT fiscal year" and was wrong —
-- TT was two years behind, not one. Loading FY2026 makes TT current through the
-- last CLOSED year. It is still behind on FY2027 by design: that year is
-- partial, grows weekly, and would re-trigger `verify:out-of-period` every month
-- the way West Hollywood FY2025-26 does. Loading it is a deliberate choice
-- somebody should make, not a side effect of closing this gap.
--
-- ⚠ The publisher also carries 6 rows outside any fiscal year it serves —
-- FY2006 (3), FY2007 (2), FY2011 (1), $121,312.98 all told. They are outside
-- every declared year, so no load touches them. Noted, not swept in.
update treasury.data_sources
   set fiscal_years = array[2021, 2022, 2023, 2024, 2025, 2026]
 where name = 'LA City Checkbook';

-- ⚠ The guard the old migration left behind, pointed the other way: the
-- declaration must name every year TT holds and no year it does not.
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
