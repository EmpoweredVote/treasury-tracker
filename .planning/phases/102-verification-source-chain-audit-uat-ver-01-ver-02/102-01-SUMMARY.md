---
phase: 102-verification-source-chain-audit-uat-ver-01-ver-02
plan: 01
subsystem: testing
tags: [pdftotext, acfr, verification, reconciliation, ca, tx, ny, fl, treasury-budgets]

# Dependency graph
requires:
  - phase: 99-100-ca-tx-ny-fl-acfr-load
    provides: CA/TX/NY/FL ACFR data loaded into treasury.budgets
  - phase: 98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon
    provides: Per-state ACFR URLs, GF column labels, page numbers (98-ACFR-SOURCES.md)
provides:
  - Loader-independent ACFR re-derivation harness (verify-phase102-rederive.mjs)
  - 16-check comparison table: 4 states × 2 FYs × 2 datasets, all PASS exact
  - VER-01 independent-reconciliation half satisfied — printed ACFR totals tie to stored treasury.budgets
affects: [102-02, 102-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verify-phaseNN.mjs idiom: native node:https PostgREST queries, loadEnv(), pdftotext extraction"
    - "pdftotext -table -f {start} -l {end} page-range extraction for GF statement columns"
    - "Dot-leader aware regex: /^\s*total revenues[^a-z]/ handles both space-separated and dot-leader lines"

key-files:
  created:
    - scripts/verify-phase102-rederive.mjs
  modified: []

key-decisions:
  - "Page numbers for older FY ACFRs differ from latest-FY: CA FY2020=p66, TX FY2015=p48, NY FY2024=p44, NY FY2015=p37, FL FY2022=p38 (vs FL/CA FY2024-2025 documented pages)"
  - "TX municipality_id resolved at runtime by name lookup (entity_type=state, name=Texas) = dc93d846-ef3e-4a41-b58f-06be2d1ab40a"
  - "Regex must use [^a-z] word-boundary (not \\s) to handle dot-leader format used in CA/NY ACFRs"
  - "All 16 checks tie exactly (delta=$0) — no rounding fallback needed; ACFR-to-DB chain is clean"

patterns-established:
  - "verify-phase102-rederive.mjs: loader-independent ACFR re-derivation pattern for state ACFRs"

requirements-completed: [VER-01]

# Metrics
duration: 45min
completed: 2026-06-29
---

# Phase 102 Plan 01: ACFR Re-Derivation Summary

**Loader-independent pdftotext re-derivation of GF printed totals for CA/TX/NY/FL across 8 ACFR statements — all 16 checks tie exactly to treasury.budgets (delta = $0 each)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-29T00:00:00Z
- **Completed:** 2026-06-29
- **Tasks:** 2 (build harness + run harness — combined into one commit)
- **Files modified:** 1

## Accomplishments

- Built `scripts/verify-phase102-rederive.mjs`: fully loader-independent ACFR re-derivation harness that imports NO `process*.js` loader, runs fresh `pdftotext -table` on each of the 8 target ACFR PDFs, parses GF column printed totals, queries `treasury.budgets` via native PostgREST, and emits a 16-check comparison table.
- All 16 checks PASS with delta = $0 (exact tie) — CA FY2020+2025, TX FY2015+2024, NY FY2015+2024, FL FY2022+2024.
- VER-01 independent-reconciliation half satisfied: each of the 4 upgraded states has its newest displayed FY + oldest window-bookend FY re-derived from the audited ACFR PDF and confirmed tied to what is stored in treasury.budgets.

## 16-Check Comparison Table (Full Run Output)

| State / FY          | Dataset   | ACFR Printed ($)      | Stored ($)            | Delta ($) | Verdict     |
|---------------------|-----------|-----------------------|-----------------------|-----------|-------------|
| California FY2025   | revenue   | 221,591,201,000       | 221,591,201,000       | 0         | PASS (exact)|
| California FY2025   | operating | 221,826,907,000       | 221,826,907,000       | 0         | PASS (exact)|
| California FY2020   | revenue   | 155,923,876,000       | 155,923,876,000       | 0         | PASS (exact)|
| California FY2020   | operating | 138,516,673,000       | 138,516,673,000       | 0         | PASS (exact)|
| Texas FY2024        | revenue   | 161,416,562,000       | 161,416,562,000       | 0         | PASS (exact)|
| Texas FY2024        | operating | 151,740,650,000       | 151,740,650,000       | 0         | PASS (exact)|
| Texas FY2015        | revenue   | 95,574,830,000        | 95,574,830,000        | 0         | PASS (exact)|
| Texas FY2015        | operating | 91,547,516,000        | 91,547,516,000        | 0         | PASS (exact)|
| New York FY2024     | revenue   | 93,894,000,000        | 93,894,000,000        | 0         | PASS (exact)|
| New York FY2024     | operating | 115,828,000,000       | 115,828,000,000       | 0         | PASS (exact)|
| New York FY2015     | revenue   | 55,139,000,000        | 55,139,000,000        | 0         | PASS (exact)|
| New York FY2015     | operating | 60,612,000,000        | 60,612,000,000        | 0         | PASS (exact)|
| Florida FY2024      | revenue   | 59,810,603,000        | 59,810,603,000        | 0         | PASS (exact)|
| Florida FY2024      | operating | 50,141,014,000        | 50,141,014,000        | 0         | PASS (exact)|
| Florida FY2022      | revenue   | 57,241,428,000        | 57,241,428,000        | 0         | PASS (exact)|
| Florida FY2022      | operating | 36,205,183,000        | 36,205,183,000        | 0         | PASS (exact)|

**Result: 16 / 16 PASS. Overall reconciliation: CLEAN.**

### ACFR Source Details

| State | FY   | PDF Page(s) | URL Pattern | Units    |
|-------|------|-------------|-------------|----------|
| CA    | 2025 | pp. 64-65   | sco.ca.gov/Files-ARD/ACFR/acfr25web.pdf | ×1,000 (thousands) |
| CA    | 2020 | pp. 66-67   | sco.ca.gov/Files-ARD/ACFR/acfr20web.pdf | ×1,000 (thousands) |
| TX    | 2024 | pp. 52-53   | comptroller.texas.gov/.../2024/96-471.pdf | ×1,000 (thousands) |
| TX    | 2015 | pp. 48-49   | comptroller.texas.gov/.../2015/96-471.pdf | ×1,000 (thousands) |
| NY    | 2024 | pp. 44-45   | osc.ny.gov/.../annual-comprehensive-financial-report-2024.pdf | ×1,000,000 (millions) |
| NY    | 2015 | pp. 37-38   | osc.ny.gov/.../comprehensive-annual-financial-report-2015.pdf | ×1,000,000 (millions) |
| FL    | 2024 | pp. 36-37   | myfloridacfo.com/.../fye-2024-...pdf | ×1,000 (thousands) |
| FL    | 2022 | pp. 38-39   | myfloridacfo.com/.../fye-2022-...pdf | ×1,000 (thousands) |

## Task Commits

1. **Task 1+2: Build harness + run harness** — `9bf4750` (feat)

**Plan metadata:** *(final commit — in progress)*

## Files Created/Modified

- `C:/treasury-tracker/scripts/verify-phase102-rederive.mjs` — Loader-independent ACFR re-derivation harness: 8 targets, fresh pdftotext -table, GF column parser, PostgREST DB query, 16-check comparison table, exit 2 on failures.

## Decisions Made

- **Page numbers differ across FY vintages:** The 98-ACFR-SOURCES.md recorded page ranges were correct for the latest FY ACFRs, but older-vintage ACFRs have the GF revenues statement on different pages (e.g., CA FY2020 is on PDF p.66 not p.64, TX FY2015 on p.48 not p.52, NY FY2015 on p.37 not p.43-44, FL FY2022 on p.38 not p.33). The harness hardcodes the correct per-FY pages discovered during this phase. This is a per-PDF layout difference, not a data integrity issue.
- **Dot-leader format requires `[^a-z]` boundary:** CA and NY ACFRs use dot leaders (`..........`) immediately after "Total revenues" with no intervening space. A regex requiring `\s` fails. Changed to `/^\s*total revenues[^a-z]/` which matches both space-separated and dot-leader formats.
- **TX municipality_id looked up at runtime:** Not hardcoded; resolved by `entity_type=state, name=Texas` query → `dc93d846-ef3e-4a41-b58f-06be2d1ab40a`.
- **All 16 ties are exact (delta=$0):** The $10M rounding fallback band was never needed. This confirms the loader extraction and unit multipliers are correct end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Incorrect PDF page numbers for older-vintage ACFRs**
- **Found during:** Task 1 (initial run)
- **Issue:** The 98-ACFR-SOURCES.md page numbers (CA pp.64-65, TX pp.52-53, NY pp.43-44, FL pp.33-35) are for the latest-year ACFRs. Older-vintage PDFs have the GF statement on different pages. This caused 10/16 checks to fail with "pdftotext parse: Total revenues/expenditures not found".
- **Fix:** Probed each PDF with `pdftotext -table -f N -l N` per-page search to find the exact page for each FY. Updated TARGETS config with correct page numbers: CA FY2020=pp.66-67, TX FY2015=pp.48-49, NY FY2024=pp.44-45, NY FY2015=pp.37-38, FL FY2022=pp.38-39.
- **Files modified:** `scripts/verify-phase102-rederive.mjs`
- **Committed in:** 9bf4750 (part of task commit)

**2. [Rule 1 - Bug] Regex failed for dot-leader line format**
- **Found during:** Task 1 (second run, after page fix — CA FY2020 and NY FY2024 still failing)
- **Issue:** Regex `/^\s*total revenues(\s|$)/` requires whitespace or EOL after "revenues". CA and NY ACFRs place dots immediately: `Total revenues............`. No space = regex miss.
- **Fix:** Changed to `/^\s*total revenues[^a-z]/` — matches any non-letter character after "revenues", covering both space-separated and dot-leader formats.
- **Files modified:** `scripts/verify-phase102-rederive.mjs`
- **Committed in:** 9bf4750 (part of task commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in initial page/regex config)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep. Final result: 16/16 exact ties.

## Issues Encountered

None beyond the two bugs documented above, both resolved inline.

## Known Stubs

None — this plan creates only a verification script with no UI rendering or placeholder data.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Script is read-only: pdftotext on local/cached PDFs + PostgREST GET queries only. Soft-404 guard implemented per T-102-01-01 (Content-Type + size check on PDF downloads).

## Self-Check

- `C:/treasury-tracker/scripts/verify-phase102-rederive.mjs` exists: FOUND
- Commit 9bf4750 exists: FOUND
- No `process*.js` imports in the script: CONFIRMED (grep finds zero loader imports)
- All 16 checks tie: CONFIRMED (run output above)

## Self-Check: PASSED

## Next Phase Readiness

- VER-01 independent reconciliation half is complete and clean (all 16 PASS exact).
- Ready for 102-02: UAT + any gap-closure work.
- Ready for 102-03: final audit sign-off.
- No failures to route — the ACFR-to-DB chain is clean for all 4 states.

---
*Phase: 102-verification-source-chain-audit-uat-ver-01-ver-02*
*Completed: 2026-06-29*
