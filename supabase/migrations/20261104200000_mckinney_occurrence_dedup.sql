-- McKinney's check registers opt in to occurrence-based row dedup.
--
-- ⚠⚠⚠ WHAT WAS WRONG. treasury_sync_transactions inserts
-- ON CONFLICT (budget_id, source_row_id) DO NOTHING, and source_row_id was a
-- SHA-256 over the whole parsed row. Two rows whose every published column
-- matches became ONE row. McKinney bought four police Tahoes at $52,962.25 on
-- one purchase order -- four identical lines -- and TT kept one.
--
-- ⭐ THE PUBLISHER'S OWN `Total` ROW IS THE ORACLE, and it settles it with no
-- judgement call. Measured 2026-11-04:
--
--     FY      TT published      McKinney's Total        recovered
--     2022   372,479,543.55     373,359,332.59        879,789.04
--     2023   431,974,178.91     432,897,552.41        923,373.50
--     2024   487,659,280.32     488,161,856.36        502,576.04
--     2025   619,424,650.54     619,940,294.15        515,643.61
--                                                   ------------
--                                                   2,821,382.19
--
-- In every year the gap equals the measured dedup loss to the cent, and the
-- register's data rows sum exactly to its own Total row.
--
-- ⚠⚠ OPT-IN, NOT A FLEET-WIDE DEFAULT, and that distinction is the whole point.
-- Plano prints a DocumentNumber and its largest repeated groups repeat it too:
-- document 16038 pays TMRS $3,482,404.02 twice on one day. A city does not pay
-- its pension fund the same amount twice in one February payment -- that is
-- export duplication, and collapsing it is CORRECT. Switching Plano to
-- 'occurrence' would inflate it by roughly $25M. Frisco looks like McKinney
-- (3 vehicles at $34,330, 6 people posting identical $529 court bonds, and no
-- identifier column at all) but publishes no Total row, so it has no oracle and
-- is deliberately NOT changed here.
--
-- Do not turn this on for a source without an oracle that proves the direction.
--
-- ⚠ The payroll registers are NOT changed either: they carry employee numbers,
-- so they have almost no identical rows (3 in four years) and no evidence of a
-- problem.

update treasury.data_sources
   set column_mapping = column_mapping || '{"dedup":"occurrence"}'::jsonb
 where name in (
   'McKinney Check Register FY2022',
   'McKinney Check Register FY2023',
   'McKinney Check Register FY2024',
   'McKinney Check Register FY2025'
 );
