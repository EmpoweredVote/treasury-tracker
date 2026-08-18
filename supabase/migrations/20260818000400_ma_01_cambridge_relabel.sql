-- MA-01 follow-up: Cambridge's FY2021-2025 rows are MA DLS data wearing a THIRD
-- wrong label.
--
-- Applied 2026-08-18 via mcp__supabase-local__execute_sql (DML, not DDL).
-- Evidence of record: .planning/MA-01-RECON.md §7.
--
-- WHY
--
-- The MA classification (migration 20260818000300 + classifyFundScope.mjs) cost
-- Cambridge its six most recent years on the chart. Cambridge was the ONLY MA
-- municipality with a mixed source history: 19 MA DLS rows FY2002-2020 beside 6
-- rows labelled 'cambridge-open-data' FY2021-2026 per series. Classifying the
-- DLS era general_fund while the other stayed unknown split it into two series,
-- and chooseDisplaySeries takes the widest -- so FY2021-2026 became a gap.
--
-- Investigating that regression showed the premise was wrong. 'cambridge-open-data'
-- is not a different source. Its stored category names are EXACTLY the MA DLS
-- Schedule A taxonomy -- operating roots Education, Public Safety, Fixed Costs,
-- Debt Service, General Government, Intergov Assessments, Public Works, Human
-- Services, Culture and Recreation, Other Expenditures (all ten columns); revenue
-- roots Taxes, Service Charges, State Revenue, Licenses and Permits, Transfers,
-- Miscellaneous, Federal Revenue, Other Financing Sources, Fines and Forfeitures.
-- A city's own open-data portal does not publish in the state's Schedule A
-- taxonomy.
--
-- PROVEN, the same way the 1,560 were:
--
--   FY    DB operating      xlsx Total Exp    DB revenue        xlsx Total Rev
--   2021   606,245,838       606,245,838       732,355,439       732,355,439
--   2022   621,077,310       621,077,310       757,378,045       757,378,045
--   2023   695,363,085       695,363,085       831,741,384       831,741,384
--   2024   741,021,949       741,021,949       917,998,626       917,998,626
--   2025   815,852,939       815,852,939       952,578,856       952,578,856
--
-- All 10 rows byte-identical to docs/MA/GenFund{Expenditures,Revenues}{YYYY}.xlsx.
-- Same source, third wrong label. A corroborating signal was already visible and
-- unread: ma-dls-gf-rev-by-source matched 350 strings, not 351, and Cambridge was
-- the missing one.
--
-- WHAT IS DELIBERATELY NOT TOUCHED
--
--   FY2026 operating and revenue -- both exactly $992,181,320. Revenue equalling
--     expenditure to the dollar is the balanced-adopted-budget signature, no
--     FY2026 workbook exists (docs/MA runs 2002-2025), and the FY2021-2025 rows
--     have revenue != operating. It is a genuinely different product: an adopted
--     budget, not DLS actuals. It stays 'cambridge-open-data' and stays unknown.
--   All 6 salary rows FY2021-2026 -- dataset_type 'salary' is outside both DLS
--     workbooks entirely.
--
-- ID-SCOPED for exactly that reason: the excluded rows are untouchable by
-- construction rather than by a predicate someone might later widen.
--
-- SAFETY: one column, 10 rows by primary key. No figure touched, so
-- figures_frozen (3bc12db8...82a2) must be unchanged afterwards.

UPDATE treasury.budgets
   SET data_source = CASE dataset_type
         WHEN 'operating' THEN 'Cambridge — MA General Fund Expenditures'
         WHEN 'revenue'   THEN 'Cambridge — MA DLS General Fund Revenue by Source'
       END
 WHERE id IN (
   -- operating FY2021-2025
   '31e911b9-5cdd-4ef8-9fa0-de9163705ca6','ddb1dc25-8117-4782-985f-4d409a4b7f1b',
   '52d42b5b-29d8-4047-8e80-50a8901a2068','e9a47d13-d673-4be0-b570-1c411223351f',
   '4e34a386-134b-4318-be2e-1e280013534f',
   -- revenue FY2021-2025
   '48dcb88b-ff90-41a8-ae5b-70823bb18a63','424c8310-3413-4974-b2f0-695b9481224b',
   'a6eab8be-1d76-4d06-922e-87f3d32bc27b','e0faf1d2-536a-48f3-9157-60472ce47a96',
   '945ec9e1-c262-4ab1-ba21-7be25ad4cbfe');

-- VERIFIED AFTER APPLYING (and after re-running classifyFundScope.mjs)
--   10 rows updated: 5 operating, 5 revenue
--   partition gate green: ma-dls-gf-exp 8408/8408, ma-dls-gf-rev-by-source
--     1755/1755 and now 351 strings, not 350
--   general_fund 18,550 -> 18,560; unknown 9,707 -> 9,697
--   figures_frozen UNCHANGED 3bc12db8...82a2; frozen row count 79,927
--   all four scope harnesses exit 0
--   THE SEAM MOVED rather than vanishing, which is the correct outcome:
--     was  Cambridge FY2020->2021 general_fund -> unknown   (6 years lost)
--     now  Cambridge FY2025->2026 general_fund -> unknown   (1 year lost)
--   Cambridge now draws FY2002-2025 continuously -- 24 years, five recovered --
--   and FY2026 renders as a gap, which is honest: it is an unevidenced adopted
--   budget, not an actual.
--
-- REVERSAL (restores the original label on exactly these 10 rows):
--
--   UPDATE treasury.budgets SET data_source = 'cambridge-open-data'
--    WHERE id IN ( <the same 10 ids above> );
--   -- then reset EXPECTED_ROWS to 8403 / 1750 and re-run classifyFundScope.mjs
