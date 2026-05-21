---
phase: 10-collin-county
plan: 03
status: complete
completed: 2026-05-21
---

# Plan 10-03 Summary — Wylie, Sachse, Murphy, Princeton Operating Budgets

## Outcome

| City | FY | Total | Rows | Route | Idempotent |
|------|----|-------|------|-------|------------|
| Wylie | 2026 | $69,649,582 | 22 | pdftotext-parser | ✓ |
| Sachse | 2026 | $31,181,759 | 19 | pdftotext-parser | ✓ |
| Murphy | 2025 | $19,835,984 | 6 | pdftotext-parser | ✓ |
| Princeton | 2026 | $36,852,089 | 5 | pdftotext-parser | ✓ |

## Wylie

**Script:** `scripts/processWylieBudget.js`
**Commit:** d36b99e

Parsed "Summary of General Fund Revenues & Expenditures" table. Found "Expenditures:" section at line >2000 (skips earlier occurrence). 22 departments extracted from 4-column table. Rightmost column = Budget 2025-2026 ($69,649,582 total).

## Sachse

**Script:** `scripts/processSachseBudget.js`
**Commit:** d36b99e

19 GF departments parsed from per-department EXPENDITURES 5-column summary tables. Section detection: line ending with "General Fund" where text before (after trimming 5+ spaces) is a known dept name. TOTAL detection: all-caps `/^\s*TOTAL\b/`. Split-row grand total heuristic: position-based lookahead compares last `$` column position — if continuation line's rightmost `$` is further right than first line's, use continuation value. Total $31,181,759 exact match to published GF total.

## Murphy

**Script:** `scripts/processMurphyBudget.js`
**Commit:** 0980a33

Murphy's per-department layout uses a complex two-column page format that pdftotext cannot reliably linearize; `Total Expense Objects:` labels rarely have inline dollar totals. Instead parsed 6 GF function categories from the "FY 2024-2025 Combined Summary of Budget by Fund" table's "Current Expenditures" section: General Government, Community Development, Public Safety, Public Works, Parks & Recreation, Solid Waste. Total $19,835,984.

Note: FY2025 data_source pointed to Princeton MA by mistake in 10-01 seed (two "Princeton" entries in DB — TX and MA). Murphy is a separate city unaffected; its own municipality_id resolved correctly.

## Princeton

**Script:** `scripts/processPrincetonBudget.js`
**Commit:** 0980a33

Princeton TX has two municipality records in the DB (Princeton TX: `43f10ae9`, Princeton MA: `210956db`). The 10-01 seed attached data_source rows to Princeton MA by mistake. The script uses `.eq('state', 'TX')` on the municipality lookup to disambiguate, and upserted a new data_source row against Princeton TX. The old MA placeholder rows remain but have no budget data.

Parsed 5 GF function groups from "GENERAL FUND - EXPENDITURES" section (page 66). For groups where "Total X" label has no `$`-prefixed values (General Government, Parks and Recreation, Public Safety), a lookahead finds the first `$`-prefixed line. Total $36,852,089.

## Phase 10 Completion Summary

| City | Status | FY | Total |
|------|--------|-----|-------|
| Garland | loaded | 2025 | $192.5M |
| Richardson | skipped — cor.net blocks HTTP | — | — |
| Wylie | loaded | 2026 | $69.6M |
| Sachse | loaded | 2026 | $31.2M |
| Murphy | loaded | 2025 | $19.8M |
| Princeton | loaded | 2026 | $36.9M |

5 of 6 cities loaded. Richardson skipped with documented rationale. Phase 10 success criteria met per CONTEXT.md Decision 2 (partial coverage acceptable with rationale).

## Checkpoint

Human verification completed 2026-05-21 — approved.
