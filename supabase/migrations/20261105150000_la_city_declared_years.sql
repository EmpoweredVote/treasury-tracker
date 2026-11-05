-- LA City Checkbook: declare the years TT actually publishes.
--
-- ⚠ The source declared fiscal_years {2021,2022,2023,2024,2025,2026} while TT
-- holds budgets for FY2024 and FY2025 only. Measured 2026-11-05 against the
-- publisher's own counts:
--
--     FY2021  584,697 rows published, TT holds 0
--     FY2022  599,460 rows published, TT holds 0
--     FY2023  682,006 rows published, TT holds 0
--     FY2026  747,363 rows published, TT holds 0
--
-- ⚠⚠ THIS IS A COVERAGE GAP, NOT A DEFECT, AND IT IS BEING WRITTEN DOWN
-- RATHER THAN QUIETLY NARROWED. Those four years are available, free, from
-- controllerdata.lacity.org and nobody has decided to load them. FY2026 is the
-- CURRENT fiscal year, so TT's most recent LA City figure is a year behind.
--
-- Leaving the declaration as it was is worse than either loading them or
-- dropping them: once the sync path works again, the scheduler would start
-- creating four new budgets and pulling ~2.6M rows that nobody planned for or
-- reviewed. A sweep that size should be a deliberate change with its own
-- verification, not a side effect of repairing something else.
--
-- ⚠ Reversing this is one line. Add the years back and run
--   node scripts/bulkLoadTransactions.js --source "LA City Checkbook" --fy <year>
-- then register each one in scripts/data/socrataRowCoverage.mjs so
-- `npm run verify:source-row-coverage` can see it.

update treasury.data_sources
   set fiscal_years = array[2024, 2025]
 where name = 'LA City Checkbook';

do $$
declare n bigint;
begin
  select count(*) into n from treasury.data_sources
   where name = 'LA City Checkbook' and fiscal_years <> array[2024, 2025];
  if n > 0 then
    raise exception 'LA City Checkbook is still declaring years TT does not publish';
  end if;
end $$;
