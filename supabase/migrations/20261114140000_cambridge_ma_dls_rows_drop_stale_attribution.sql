-- Cambridge's 10 MA DLS rows stop claiming a publisher that did not publish them.
--
-- Applied 2026-11-14. Finishes what 20260818000400 began and what
-- ev-accounts #1474 made safe.
--
-- ── WHAT A READER WAS SHOWN ─────────────────────────────────────────────────
--
-- Cambridge FY2021-2025 General Fund revenue and expenditure carried a source
-- chip reading:
--
--     "City of Cambridge Open Data"  ->  https://dls-gw.dor.state.ma.us/...
--
-- The NAME and the LINK contradicted each other. The figures are MA DLS
-- Schedule A — 20260818000400 proved it to the dollar, ten rows byte-identical
-- to docs/MA/GenFund{Expenditures,Revenues}{2021..2025}.xlsx — and a city's own
-- open-data portal does not publish in the state's Schedule A taxonomy.
--
-- ⚠ That migration moved the `data_source` LABEL and left `data_source_id`
-- pointing at the old `treasury.source_registry` entry (d4e872cc… = "City of
-- Cambridge Open Data"). ev-accounts' `dataSourceInfoFor` takes the registry's
-- `display_name` whenever that join resolves, so the stale pointer kept
-- overriding a label that had already been corrected.
-- ⭐ A relabel is not finished while a POINTER still names the old source.
--
-- ⛔⛔ THERE IS NOTHING DANGLING HERE. An earlier note on 20261114130000 called
-- this pointer dangling and generalised it to "937 rows fleet-wide"; both were
-- false and came from anti-joining `treasury.data_sources`, which this column
-- does not reference. It references `treasury.source_registry`, where all 859
-- resolve. Corrected in #404; the lesson is in that migration's comment.
--
-- ── WHY NULL, RATHER THAN RE-POINT ──────────────────────────────────────────
--
-- The other 350 MA municipalities carry `data_source_id IS NULL` and are served
-- from the row's own columns, so their chip reads "Abington — MA General Fund
-- Revenues" and links to that municipality-year's Schedule A report. NULL makes
-- Cambridge identical to its 350 siblings. Re-pointing it at some MA registry
-- entry would make Cambridge the one municipality in the state described
-- differently from the rest, for no gain.
--
-- ── ⛔ WHY THIS COULD NOT HAVE BEEN DONE BEFORE 2026-11-14 ──────────────────
--
-- All 10 rows have a `source_url` and NO `source_date`. Until ev-accounts
-- #1474, `dataSourceInfoFor`'s municipal branch required `source_date`, so
-- nulling the pointer would have traded a WRONGLY-NAMED chip for NO CHIP AT
-- ALL. #1474 is merged (727908446) and VERIFIED LIVE in production before this
-- ran: Boston and Abington FY2020/FY2024 now serve their Schedule A chips.
--
-- ── WHAT IS DELIBERATELY NOT TOUCHED ────────────────────────────────────────
--
-- Cambridge's other EIGHT rows keep this exact pointer, because for them it is
-- TRUE: six `salary` rows FY2021-2026, and FY2026 operating + revenue. Those
-- are genuinely City of Cambridge Open Data — the salary rows are the publicpay
-- shape, outside both DLS workbooks, and FY2026 is an adopted budget (revenue
-- equals expenditure to the dollar, $992,181,320; no FY2026 workbook exists).
-- 20260818000400 excluded them for those reasons and so does this.
--
-- ⭐ ID-SCOPED FOR THAT REASON, and the ids are 20260818000400's own ten,
-- re-verified 2026-11-14 against the table: all ten still carry the MA DLS
-- labels, and the eight excluded rows still read `cambridge-open-data`.
--
-- SAFETY: one column, 10 rows by primary key, no figure touched.
-- `figures_frozen` must be unchanged (62587 / 60098de6…).

UPDATE treasury.budgets
   SET data_source_id = NULL
 WHERE id IN (
   -- operating FY2021-2025  (Cambridge — MA General Fund Expenditures)
   '31e911b9-5cdd-4ef8-9fa0-de9163705ca6','ddb1dc25-8117-4782-985f-4d409a4b7f1b',
   '52d42b5b-29d8-4047-8e80-50a8901a2068','e9a47d13-d673-4be0-b570-1c411223351f',
   '4e34a386-134b-4318-be2e-1e280013534f',
   -- revenue FY2021-2025    (Cambridge — MA General Fund Revenues)
   '48dcb88b-ff90-41a8-ae5b-70823bb18a63','424c8310-3413-4974-b2f0-695b9481224b',
   'a6eab8be-1d76-4d06-922e-87f3d32bc27b','e0faf1d2-536a-48f3-9157-60472ce47a96',
   '945ec9e1-c262-4ab1-ba21-7be25ad4cbfe');

-- REVERSAL (restores the stale pointer on exactly these 10 rows):
--
--   UPDATE treasury.budgets
--      SET data_source_id = 'd4e872cc-ec29-4bcb-a4c1-d7d8f5224df3'
--    WHERE id IN ( <the same 10 ids above> );
