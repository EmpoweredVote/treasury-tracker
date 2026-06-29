---
phase: 96-remaining-states-sgfs-04
plan: 06
subsystem: database
tags: [nasbo, state-gf, data-entry, pdf-extraction, dry-run, batch-d]

# Dependency graph
requires:
  - phase: 96-remaining-states-sgfs-04/96-05
    provides: Batch C states (NC ND NE NH NJ NM NV NY OK OR PA RI) loaded into STATES
  - phase: 94-extractor-policy-sgfs-01
    provides: loadStateGF.mjs loader + P1–P6 policy + validateAgainstControl
provides:
  - "Batch D (SC SD TN TX UT VT WA WI WV WY) FY2023+FY2024 entries in STATES — 20 state-years"
  - "Georgia FY2024 entry (6-function, 2025-SER taxonomy) appended to existing GA STATES object"
  - "Full 46-state cohort + GA dual-FY entries validated — 94 state-years all tie:PASS"
affects: [96-07-live-load, state-gf-operating, nasbo-2025-ser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pdftotext -table extraction from NASBO 2025 SER per-function tables (T5/T9/T13/T16/T21/T26)"
    - "Manual checksum cross-check: 6-function sum vs Table 1 GF control before code entry"
    - "GA FY2023 (2024 SER, 7-function) preserved byte-unchanged; GA FY2024 appended (2025 SER, 6-function)"

key-files:
  created: []
  modified:
    - scripts/loadStateGF.mjs

key-decisions:
  - "WI FY2023: $1M rounding diff (0.005%) accepted as within tolerance — confirmed from PDF; no re-read needed"
  - "TX FY2024 Corrections GF=$1.888B vs FY2023 $4.139B: verified correct from PDF; Corrections funding shift to Federal in FY2024"
  - "GA FY2023 operating[2023] left completely byte-unchanged (7-function, PA=$0) per RESEARCH §GA FY2024 extension"

patterns-established:
  - "Batch D extraction verified: each state-year checksums at 0.000% diff (WI FY2023: 0.005% rounding) — no re-reads needed"

requirements-completed: [SGFS-04]

# Metrics
duration: 9min
completed: 2026-06-28
---

# Phase 96 Plan 06: Batch D + GA FY2024 + Full-Cohort 94-State-Year Dry-Run Summary

**NASBO 2025 SER GF actuals for SC SD TN TX UT VT WA WI WV WY (FY2023+FY2024) plus GA FY2024 transcribed and dual-checksum validated; full 46-state cohort + GA dry-run = 94/94 tie:PASS, ready for live load**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-28T00:28:05Z
- **Completed:** 2026-06-28T00:37:35Z
- **Tasks:** 2 (combined into one commit — same file, both tasks verified)
- **Files modified:** 1

## Accomplishments

- Extracted and transcribed 10 Batch D states × 2 FYs = 20 state-year entries into `STATES` using `pdftotext -table` from NASBO 2025 SER (Tables 1, 5, 9, 13, 16, 21, 26)
- All 20 entries checksum at 0.000% diff vs Table 1 GF; WI FY2023 = $1M / 0.005% (rounding, within tolerance)
- Georgia FY2024 appended (6-function, controlTotalGF=34,594B, 0.000% diff); GA FY2023 byte-unchanged
- TX source_date confirmed: `2023-08-31` and `2024-08-31` via `FY_END_MMDD['TX']='08-31'`
- Full cohort dry-run: **94/94 tie:PASS, 0 FAIL** — closes the data-entry side of Phase 96
- Unit tests: **14/14 pass** (`node --test scripts/loadStateGF.test.mjs`)

## Per-State Summary (Batch D)

| State | FY2023 controlTotalGF | FY2024 controlTotalGF | FY2023 diff | FY2024 diff | Note |
|-------|-----------------------|-----------------------|-------------|-------------|------|
| SC | $12,089M | $14,189M | 0.000% | 0.000% | |
| SD | $2,231M | $2,362M | 0.000% | 0.000% | |
| TN | $19,570M | $23,411M | 0.000% | 0.000% | |
| TX | $45,367M | $50,512M | 0.000% | 0.000% | Aug-31 FY-end; source_date 2023-08-31/2024-08-31 |
| UT | $11,682M | $13,674M | 0.000% | 0.000% | |
| VT | $2,055M | $2,510M | 0.000% | 0.000% | |
| WA | $30,861M | $32,397M | 0.000% | 0.000% | |
| WI | $18,864M | $22,280M | 0.005% ($1M) | 0.000% | Rounding; within 0.5% tolerance |
| WV | $3,943M | $4,164M | 0.000% | 0.000% | |
| WY | $1,525M | $1,654M | 0.000% | 0.000% | WY K-12 GF=$0 (all local/federal) |

**GA FY2024:** controlTotalGF=$34,594M, diff=0.000%

## Task Commits

1. **Tasks 1+2: Batch D (SC SD TN TX UT VT WA WI WV WY) + GA FY2024 + full-cohort dry-run** — `86482c5` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified

- `scripts/loadStateGF.mjs` — Added 317 lines: Batch D 10-state STATES entries + GA operating[2024]; GA operating[2023] byte-unchanged

## Decisions Made

- WI FY2023 $1M diff (0.005%) accepted — confirmed from PDF cross-check; all per-function GF values read cleanly; diff is published rounding in the NASBO source
- TX FY2024 Corrections GF=$1.888B (vs $4.139B FY2023) verified correct from PDF; NASBO T16 TX FY2024 row: GF=1,888 Federal=2,797 — funding shifted to federal in FY2024, not a misread
- All GA FY2023 categories left byte-unchanged (7-function, PA=$0 entry preserved) per plan requirement

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in a single atomic commit (same file, sequential extraction passes). No re-reads required on any state-year.

## Issues Encountered

None — all 20 Batch D state-years + GA FY2024 checksummed correctly on first extraction pass.

## Self-Check

## Self-Check: PASSED

- [x] `scripts/loadStateGF.mjs` modified — confirmed (86482c5, +317 lines)
- [x] Commit 86482c5 exists — confirmed
- [x] `node scripts/loadStateGF.mjs --dry-run` = "Done. 94 state-FY validated." — confirmed
- [x] 94 tie:PASS, 0 FAIL — confirmed
- [x] TX source_date = 2023-08-31 / 2024-08-31 — confirmed
- [x] GA FY2023 byte-unchanged (7 categories incl. Public Assistance = 0) — confirmed
- [x] GA FY2024 uses 6 categories, no Public Assistance — confirmed
- [x] No FY2025 keys in any Batch D entry — confirmed
- [x] `node --test scripts/loadStateGF.test.mjs` = 14/14 pass — confirmed

## Next Phase Readiness

- Phase 96 Plan 07: live load ready — all 94 state-years validated, dry-run clean
- No blockers; `node scripts/loadStateGF.mjs` (without `--dry-run`) can run against production Supabase

---
*Phase: 96-remaining-states-sgfs-04*
*Completed: 2026-06-28*
