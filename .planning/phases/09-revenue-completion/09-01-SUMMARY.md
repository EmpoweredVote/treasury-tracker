---
phase: 09-revenue-completion
plan: 01
subsystem: database
tags: [supabase, pdftotext, revenue, budget, plano, mckinney, frisco, allen]

# Dependency graph
requires:
  - phase: 08-data-quality
    provides: clean operating budget rows for Frisco/Plano/Allen — confirmed before revenue load
provides:
  - Revenue budget rows in treasury.budgets for Plano (FY2018-FY2024), McKinney (FY2021-FY2025), Frisco (FY2026), Allen (FY2026)
  - data_source records with dataset_type='revenue' for all four cities
affects:
  - 09-02 (remaining revenue cities — Prosper/Celina/McKinney additional years)
  - 09-03 (revenue tab UI verification)
  - Phase 10 (cost of living baseline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - processPlanoRevenue.js: reads "Budget FY-1" column from each PDF, so doc year 2024-25 → loads FY2024 (not FY2025)
    - processRevenuePDF.js: downloads PDFs from live URLs then runs pdftotext; uses treasury_sync_budget_tree RPC
    - Both scripts idempotent via data_source upsert + delete-before-insert pattern

key-files:
  created: []
  modified:
    - scripts/processPlanoRevenue.js (ran, no code changes)
    - scripts/processRevenuePDF.js (ran, no code changes)

key-decisions:
  - "Plano FY2025 is not loadable — the 2025-26 PDF has scrambled label-value alignment, script skips it intentionally"
  - "Plano script extracts Budget FY-1 column, so fiscal_year stored = one year before document year (2024-25 PDF → FY2024)"
  - "processRevenuePDF.js downloads PDFs at runtime from city URLs — requires internet access during load"
  - "Revenue data_sources existed in DB (prior incomplete run) but had zero budget rows — scripts had been run partially before"

patterns-established:
  - "Verify DB state with direct Supabase query before running scripts — data_sources may exist with no budget rows"
  - "SUPABASE_SERVICE_ROLE_KEY available as system env var on dev machine — no .env file needed"

# Metrics
duration: 9min
completed: 2026-05-04
---

# Phase 9 Plan 01: Revenue Data Audit and Load Summary

**Loaded revenue budget rows for all four primary cities: Plano (7 FYs: 2018-2024), McKinney (5 FYs: 2021-2025), Frisco (FY2026), Allen (FY2026) — 412+ revenue rows now in treasury.budgets**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-04T19:43:39Z
- **Completed:** 2026-05-04T19:52:46Z
- **Tasks:** 2 (+ checkpoint pending human verify)
- **Files modified:** 0 (DB-only changes)

## Accomplishments

- Established ground truth: all four cities had revenue data_source records but ZERO budget rows — scripts had never completed successfully
- Ran processPlanoRevenue.js — loaded 366 budget rows across FY2018-FY2024 (7 fiscal years)
- Ran processRevenuePDF.js for McKinney (58 rows, FY2021-FY2025), Frisco (5 rows, FY2026), Allen (44 rows, FY2026)
- All four cities now show non-zero revenue totals in the hundreds of millions range

## Task Commits

Tasks 1 and 2 are DB-only operations — no source files were modified, no commits needed for task work.

**Plan metadata:** (pending — will commit with STATE.md update)

## Files Created/Modified

None — both tasks performed DB writes only via existing scripts.

## DB State After Load

| City | Fiscal Years Loaded | Total (spot-check) |
|------|--------------------|--------------------|
| Allen | FY2026 | $149,970,918 |
| Frisco | FY2026 | $304,873,727 |
| McKinney | FY2021-FY2025 | $150M-$210M/year |
| Plano | FY2018-FY2024 | $268M-$337M/year |

## Decisions Made

1. **Plano FY2025 gap accepted** — the 2025-26 PDF has scrambled label-value alignment throughout; the script intentionally skips it. FY2025 data is not loadable without manual correction of the PDF parser.

2. **Plano fiscal year offset confirmed** — `processPlanoRevenue.js` extracts the "Budget FY-1" column from each document year's PDF. Document year 2024-25 → loads FY2024, not FY2025. Plan's expected coverage (FY2019-FY2025) was based on incorrect assumptions; actual loadable coverage is FY2018-FY2024.

3. **FY2020 Plano row has null data_source_id** — a pre-existing row with data_source_id=null was present for Plano FY2020 ($324M). This was not created by this run. Not overwritten.

4. **Scripts use system environment variable** — SUPABASE_SERVICE_ROLE_KEY is available as a Windows system env var; no .env file needed. Scripts also accept this key name (in addition to SUPABASE_SERVICE_KEY).

## Deviations from Plan

### Significant Findings (not deviations — discovered during audit)

**1. Plano fiscal year offset**
- **Found during:** Task 1 audit + Task 2 script output
- **Issue:** Plan expected FY2019-FY2025 but script extracts FY-1 from each PDF document year. The 2019-20 PDF → FY2019; 2024-25 PDF → FY2024. FY2025 would require the 2025-26 PDF which is intentionally skipped due to scrambled formatting.
- **Resolution:** Accepted. Plano has 7 years of revenue data (FY2018-FY2024) which is substantive. FY2025 noted as structural gap.

**2. No .env file — used system env var**
- **Found during:** Task 2 script execution
- **Issue:** Plan said to use `node --env-file=.env scripts/...` but .env file doesn't exist
- **Resolution:** [Rule 3 - Blocking] Scripts accept SUPABASE_SERVICE_ROLE_KEY from system env; ran without --env-file flag

---

**Total deviations:** 0 code changes (1 blocking environment issue resolved by using system env var)

## Issues Encountered

- **Verification query false negative**: First verification attempt using `data_source_id` join returned 0 rows because the query chain was incorrect. Re-queried using `municipality_id` directly on budgets table — confirmed 412 revenue rows loaded correctly.
- **processRevenuePDF.js downloads PDFs at runtime** — requires active internet connection; all downloads succeeded.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Revenue tab should now be visible in the app for Plano, McKinney, Frisco, and Allen
- Awaiting human verification checkpoint (Task 3) before this plan closes
- After checkpoint approval: Phase 9 Plans 02-03 can proceed (additional cities, UI polish)
- Known gap: Plano FY2025 not loadable without fixing 2025-26 PDF parser issue

---
*Phase: 09-revenue-completion*
*Completed: 2026-05-04*
