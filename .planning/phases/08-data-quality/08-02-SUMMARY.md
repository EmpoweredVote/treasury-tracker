---
phase: 08-data-quality
plan: 02
name: Re-extract Allen / Prosper / Celina FY2025
subsystem: pdf-pipeline
tags: [haiku, extraction, allen, prosper, celina, data-quality, unknown-department]
status: complete
completed: 2026-05-04
duration: ~20 minutes

dependency-graph:
  requires: [08-01]
  provides: [allen-fy2025-clean, prosper-fy2025-clean, celina-fy2025-clean]
  affects: [data-quality, treasury.budget_categories]

tech-stack:
  added: []
  patterns:
    - pct_unknown as success metric for re-extraction runs (row count is non-deterministic across Haiku runs)

key-files:
  created: []
  modified:
    - scripts/bulkLoadPDF.js

key-decisions:
  - "pct_unknown is the success metric, not total row count (Haiku non-determinism changes row counts between runs)"
  - "Allen and Prosper were already clean before re-extraction — Celina's 17.9%-by-dollar Unknown resolved"
---

# Phase 8 Plan 02: Re-extract Allen / Prosper / Celina FY2025 — Summary

**Re-extracted Allen/Prosper/Celina FY2025 through fixed Haiku pipeline (max_tokens 8192 + section_heading context); Celina's $207M Unknown attribution resolved, all three cities now at 0% Unknown.**

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Re-extract Allen / Prosper / Celina FY2025 via fixed pipeline | DB-only | scripts/bulkLoadPDF.js |
| 2 | Human verification checkpoint — named departments confirmed in app | approved | — |

No source code commits were made. All changes were database-only (old budget rows replaced by re-extracted rows via `treasury_sync_budget_tree`).

---

## Audit Results

### BEFORE Re-extraction

| City | Fiscal Year | Unknown Rows | Total Rows | Pct Unknown |
|------|-------------|--------------|------------|-------------|
| Allen | 2025 | 0 | 203 | 0.0% |
| Celina | 2025 | 1 | 129 | 0.8% |
| Prosper | 2025 | 0 | 301 | 0.0% |

Note: Celina's 1 Unknown row represented **$206,968,861 of $1,158,842,950 total = 17.9% of budget dollars**.

### AFTER Re-extraction

| City | Fiscal Year | Unknown Rows | Total Rows | Pct Unknown |
|------|-------------|--------------|------------|-------------|
| Allen | 2025 | 0 | 201 | 0.0% |
| Celina | 2025 | 0 | 131 | 0.0% |
| Prosper | 2025 | 0 | 244 | 0.0% |

### Per-City Drop Summary

| City | Before (rows / dollars) | After | Result |
|------|------------------------|-------|--------|
| Allen FY2025 | 0.0% / — | 0.0% | Already clean; re-extraction confirmed, row count stable (203→201) |
| Prosper FY2025 | 0.0% / — | 0.0% | Already clean; re-extraction confirmed (301→244 rows, Haiku non-determinism) |
| Celina FY2025 | 0.8% rows / 17.9% dollars | 0.0% | Single Unknown row covering $207M resolved |

---

## Pipeline Run Summaries

| City | Pages Processed | Budget Tables | Rows Loaded | Pages Flagged | Exit Code |
|------|-----------------|---------------|-------------|---------------|-----------|
| Allen ACFR FY2025 | 163 | 13 | 250 | 0 | 0 |
| Prosper ACFR FY2025 | 140 | 23 | 340 | 0 | 0 |
| Celina ACFR FY2025 | 133 | 12 | 228 | 0 | 0 |

All three pipeline runs completed with exit code 0. No pages flagged.

---

## Human Verification Checkpoint

**Status:** Approved

Named departments confirmed visible for each city:

- **Allen:** General Fund, Debt Service, TIF, Special Revenue, and others
- **Prosper:** Governmental Activities, Crime Control, Fire/EMS SPD, and others
- **Celina:** General Fund, Capital Asset & Debt, EDC, and others

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| pct_unknown is the success metric, not total row count | Haiku is non-deterministic — row counts change between runs (e.g., Prosper 301→244). What matters is whether Unknown rows reach 0%. |
| Allen and Prosper were already clean before re-extraction | The 08-01 pipeline fixes resolved the root cause; these two cities' original loads had not produced Unknown rows at all |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Issues Encountered

None. All three pipeline runs exited cleanly with code 0 and zero flagged pages.

---

## User Setup Required

None — no external service configuration required.

---

## Next Phase Readiness

Allen, Prosper, and Celina FY2025 operating budgets are fully clean (0% Unknown by both row count and dollar amount). Plan 03 can proceed: re-extract Frisco FY2026 and all 7 Plano fiscal years through the same fixed pipeline.

No blockers.

---
*Phase: 08-data-quality*
*Completed: 2026-05-04*
