-- McKinney FY2026: loaded, and flagged as the eleven-month year it is.
--
-- Reverses the hold in 20261108700000. Chris, 2026-11-08, asked for it to be
-- loaded, which is the Milledgeville Rule's answer to the question that
-- migration parked: *"It is not our job to hide bad data"* — publish what the
-- government published, and tell the reader what it covers.
--
-- ── ⚠⚠⚠ WHY A FLAG IS NOT OPTIONAL HERE ───────────────────────────────────
--
-- The year loads to $597,313,687.70 over 46,797 rows and ELEVEN months.
-- Against the four complete years before it:
--
--     FY2022   $373,359,332.59   45,844 rows   12 months
--     FY2023   $432,897,552.41   47,169 rows   12 months
--     FY2024   $488,161,856.36   47,324 rows   12 months
--     FY2025   $619,940,294.15   50,096 rows   12 months
--     FY2026   $597,313,687.70   46,797 rows   11 months  ← Oct 2025 … 2026-08-28
--
-- ⚠⚠ UNFLAGGED, THIS READS AS A FALL. $597.3M against $619.9M is down $22.6M,
-- about 3.6%, and a reader would conclude McKinney spent less in FY2026 than
-- in FY2025. The opposite is true: $597.3M over eleven months is $54.3M a
-- month against FY2025's $51.7M. A twelfth month at the year's own rate puts
-- FY2026 near $651M — UP about 5%, not down.
--
-- That is the entire reason src/data/figureFlags.ts exists, and it is why this
-- migration and the flag ship together. Loading the figure without the caveat
-- would publish a decline that did not happen.
--
-- ── WHAT IS FACT, AND WHAT WOULD HAVE BEEN INFERENCE ───────────────────────
--
-- scripts/data/friscoRegisterAnomalies.mjs sets the bar: a FACT ABOUT THE FILE
-- may be published; an INFERENCE ABOUT THE PUBLISHER needs independent
-- corroboration first. The reader-facing copy here states only the former —
-- the file's payments run 2025-10-03 to 2026-08-28 and it contains no
-- September 2026 rows. It does NOT assert why, because "the city has not
-- posted September yet" is an inference and nothing published establishes it.
--
-- The fiscal-year boundary itself is corroborated from three independent
-- directions, none of them this file's own contents:
--
--   1. McKinney's own Annual Budget archive (Archive.aspx?AMID=37) names every
--      year "FY 2025-2026", "FY 2024-2025" and so on — an October-September
--      year, stated in a different document family entirely.
--   2. All four earlier McKinney registers in TT end in late September
--      (2022-09-30, 2023-09-29, 2024-09-30, 2025-09-26) and each covers
--      twelve distinct months.
--   3. The FY26 file's own `fiscal_year` column, which carries 2026 on 43,764
--      of its rows and 2025 on the 3,033 paid in October against prior-year
--      invoices.
--
-- ⚠ The flag must be RETIRED, not edited, when September appears: a reload
-- will make this a twelve-month year and the banner would then be false.
-- scripts/data/mckinneyRegisterAnomalies.mjs carries the retirement condition.
update treasury.data_sources
   set is_enabled = true
 where name = 'McKinney Check Register FY2026';

do $$
declare n int;
begin
  select count(*) into n from treasury.data_sources
   where name = 'McKinney Check Register FY2026'
     and is_enabled = true
     and fiscal_year_start_month = 10
     and column_mapping->>'dedup' = 'occurrence';
  if n <> 1 then
    raise exception 'expected McKinney FY2026 enabled, keyed by occurrence on an October year, found %', n;
  end if;
end $$;
