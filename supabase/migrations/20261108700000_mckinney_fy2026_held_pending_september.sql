-- McKinney FY2026: held, because the publisher's year is not finished.
--
-- ⚠⚠⚠ ELEVEN MONTHS OF A TWELVE-MONTH YEAR. McKinney's FY26 check register,
-- fetched 2026-11-08, covers 2025-10-01 through 2026-08-28 and stops there:
-- 46,797 published lines, $597,313,687.70, and NO SEPTEMBER 2026.
--
--     2025-10   4,189   $51,711,154.01      2026-04   4,347   $34,845,476.62
--     2025-11   4,452   $41,337,180.80      2026-05   4,628   $52,119,982.69
--     2025-12   3,986   $42,683,251.26      2026-06   4,333   $46,030,215.93
--     2026-01   3,916   $50,591,126.77      2026-07   4,483   $52,169,140.37
--     2026-02   3,940   $52,597,757.27      2026-08   4,286  $107,762,727.35
--     2026-03   4,237   $65,465,674.63      2026-09       0            $0.00
--
-- At this file's own monthly average that is roughly 4,250 lines and ~$54M
-- absent — about 8% of the year.
--
-- ⚠⚠ THE YEAR IS CLOSED. McKinney's fiscal year ended 2026-09-30, so a reader
-- would reasonably take whatever TT showed as the FINAL FY2026 figure. It
-- would not be. McKinney's own FY2025 file is complete through 2025-09-26, so
-- the city does finish its years; this one has not caught up yet.
--
-- ── ⚠ THIS IS A HOLD, NOT A JUDGEMENT THAT THE DATA IS BAD ─────────────────
--
-- Every row in the file is real and correctly parsed. The dry run is clean:
-- the doubled-export guard passes across 56 publication dates, there is no
-- publisher grand-total row (checked explicitly — 0 rows labelled TOTAL, 0
-- rows equal to the sum of the others), and nothing in the file is in doubt.
-- The only question is whether an eleven-month year belongs on the page.
--
-- Two of this project's own rules point opposite ways, which is why this is
-- parked rather than decided here:
--
--   THE MILLEDGEVILLE RULE  load it and flag it — "it is not our job to hide
--                           bad data", and src/data/figureFlags.ts is the
--                           working reader-facing half.
--   THE LA FY2027 DECISION  do not publish a year that is still filling.
--
-- ⚠ `is_enabled = false` keeps it out of every gate and every page.
-- verify:xlsx-row-coverage filters on is_enabled, so this row is INVISIBLE to
-- it rather than a standing false finding — and `scripts/data/xlsxRowCoverage.mjs`
-- deliberately does NOT carry an entry for it. When September appears, or when
-- the question above is answered the other way: flip this to true, load, and
-- add the baseline to that registry.
update treasury.data_sources
   set is_enabled = false
 where name = 'McKinney Check Register FY2026';

-- ⚠ The hold is guarded. Enabling this row publishes an eleven-month year as
-- though it were a complete one, so it must not happen by accident.
do $$
declare n int;
begin
  select count(*) into n from treasury.data_sources
   where name = 'McKinney Check Register FY2026' and is_enabled = false;
  if n <> 1 then
    raise exception 'expected McKinney FY2026 held disabled, found %', n;
  end if;
end $$;
