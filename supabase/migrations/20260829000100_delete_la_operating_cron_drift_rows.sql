-- Delete the two LA operating rows the (now-disabled) cron sync re-created.
--
-- Companion to 20260829000000, which turned the sync off. That migration
-- deliberately left these rows alone, because removing them is a separate
-- decision. Chris made it on 2026-08-29: delete.
--
--   804fd360-8d0e-4ed2-ad17-3d4c67ad9e0f  FY2025 operating  $19,340,363,947.28
--   9d9205b9-f920-43c7-9452-a5b958df6e35  FY2026 operating  $20,853,668,993.02
--
-- They are LA FMS appropriation-ledger figures for two years v2.28 (LA-02)
-- deliberately withdrew. Nothing rendered them — both are `fund_scope: unknown`,
-- so the non-comparable-scope rules kept them out of the FY2003-2024 CA State
-- Controller series — but left in place they are a permanent anomaly that every
-- future row census and partition re-measure has to re-explain.
--
-- ── ⚠ This is frozen-invariant NEUTRAL, which is not obvious ──
-- Both ids are already in scripts/data/laOperatingCronDriftCreatedIds.json,
-- which scopeBaseline.excluded_ids_files feeds into the digest. They therefore
-- never counted toward frozen_row_count (79,916). Deleting them removes rows the
-- digest ALREADY filtered out, so both the count and the digest are unchanged.
-- Verified with `npm run verify:frozen` immediately before and after: 79,916 /
-- 90f009fe396d20dcd211258e534ea81c237aa0bddd3d2412680c1dcce3af76fe, both times.
--
-- ⚠ The ids file is deliberately NOT stripped from scopeBaseline. An exclusion
-- naming a row that no longer exists is harmless; removing it would be a second
-- change to reason about.
--
-- ── ⚠ COUPLED CODE CHANGE, in this same commit ──
-- scripts/stampBudgetAxes.mjs `city-adopted-budget-doc` goes 171 -> 169. These
-- two rows are `basis: adopted`, which is why they were counted in that
-- partition at all. Without the gate move the next stamp run refuses the write.
--
-- ── Backed up first, and the backup was PROVEN restorable ──
-- .planning/backups/la-city/la-operating-cron-drift-fy2025-2026.json.gz
-- (2 budgets / 3,148 categories / 2,674 line items, 461 KB gz), in the shape
-- scripts/la02RestoreBackup.mjs already reads. Dry-run through that script
-- before the delete: roots sum TIES on both years.
-- ⚠ Never blind-restore: FY2026 of this ledger counted $4.77B of TRAN activity
-- alongside itself, and TRAN proceeds are borrowing (money IN).
-- Also re-derivable — uyzw-yi8n is still published; only our sync is off.
--
-- ── Cascade footprint, checked before running ──
-- budget_categories, budget_line_items and enrichment_queue are ON DELETE
-- CASCADE (3,148 / 2,674 / 1 rows). treasury.transactions.budget_id is NO
-- ACTION and would BLOCK the delete — verified 0 transactions reference these
-- two budgets.

DELETE FROM treasury.budgets
 WHERE id IN (
   '804fd360-8d0e-4ed2-ad17-3d4c67ad9e0f',
   '9d9205b9-f920-43c7-9452-a5b958df6e35'
 );
