# Phase 35: CA State 3-Level Icicle Pilot — Verification

**Date:** 2026-06-08
**Plan:** 35-03

## Summary

| Requirement | Result | Evidence |
|-------------|--------|----------|
| ICICLE-01 | PASS | DB shows depth-0/1/2 rows for all 5 CA FYs; FY2026 total unchanged at $228,365,858,000 |
| ICICLE-02 | PENDING human verification | Human spot-check required |
| ICICLE-03 | PENDING human verification | Human spot-check required |

---

## ICICLE-01 — DB Depth Verification

**Script run:** `node scripts/processCA.js --fy 2022 --fy 2023 --fy 2024 --fy 2025 --fy 2026`
**Exit code:** 0 (no env error, no sanity error)

### Per-FY rows_inserted (reported by RPC)

| FY | rows_inserted | Total Budget | In $150B-$300B Band |
|----|---------------|--------------|----------------------|
| 2022 | 252 | $216,784,797,000 | YES |
| 2023 | 256 | $195,189,253,000 | YES |
| 2024 | 253 | $205,670,467,000 | YES |
| 2025 | 253 | $233,577,316,000 | YES |
| 2026 | 219 | $228,365,858,000 | YES |

### DB Depth Distribution (post-reload)

| FY | depth-0 (DOF Agency) | depth-1 (Department) | depth-2 (Function) | Total categories |
|----|---------------------|---------------------|-------------------|-----------------|
| 2022 | 12 | 166 | 252 | 430 |
| 2023 | 12 | 171 | 256 | 439 |
| 2024 | 12 | 169 | 253 | 434 |
| 2025 | 12 | 169 | 253 | 434 |
| 2026 | 12 | 157 | 219 | 388 |

**ICICLE-01 PASS:** All 5 FYs have depth-2 rows in `treasury.budget_categories`. FY2026 budget total $228,365,858,000 = pre-reload total (diff $0). Sanity band $150B-$300B: all FYs pass.

---

## Enrichment (D-08/D-09)

*(To be filled in after Task 2)*

---

## ICICLE-02 / ICICLE-03 — Live App Spot-Check

*(To be filled in after human visual verification checkpoint)*
