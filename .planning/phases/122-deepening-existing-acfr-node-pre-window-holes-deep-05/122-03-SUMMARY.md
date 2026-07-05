---
phase: 122-deepening-existing-acfr-node-pre-window-holes-deep-05
plan: "122-03"
status: complete
completed: 2026-07-05
requirements: [DEEP-05]
---

# 122-03 Summary — DEEP-05 Closeout (NY/TX floors + whole-phase verification)

## What shipped
`122-03-DEEP05-CLOSEOUT.md` — read-only verification + honest-floor documentation closing DEEP-05. No loader code, no new DB writes (only the two idempotency re-runs of already-loaded FYs).

## Final windows (DB-verified)
- **CA** FY2002–FY2025 (24yr, +6) · **FL** FY2003–FY2024 (22yr, +18) · **NY** FY2003–FY2024 (22yr, 0 added — floor) · **TX** FY2015–FY2024 (10yr, 0 added — floor).

## Verification (all pass)
- Idempotency: CA `--fy 2002` + FL `--fy 2003` re-runs → 0 net change.
- 0 residue (LOAD-01): ephemeral loaders leave 0 rows; CA operating keeps 1 registry row.
- Cohort untouched: node-scoped loads; NY/TX unchanged; all 50 state nodes intact.
- Money In: on for CA, NY, FL, TX.
- Pre-existing windows byte-identical (CA FY2008/FY2025, FL FY2021/FY2024).

## Honest holes documented (nothing faked)
- CA ≤FY2001 (soft-404 floor) · NY ≤FY2002 (404 floor) · FL FY2000–FY2002 (repair-pending, damaged xref + qpdf unavailable) · TX ≤FY2014 (no durable statewide URL).

## Deviation
- D-02 stale-window premise correction recorded as resolved (recon corrected ROADMAP v2.11-era text).

## DEEP-05 status: CLOSED (all 4 success criteria met).

## Hand-off
- Phase 123 (NASBORT-01): NASBO retire-to-fallback.
- Phase 124 (VER-09/VER-10): blind re-derivation of the 24 new CA/FL state-FYs + Chris UAT sampling a deepened node.

Full detail: `122-03-DEEP05-CLOSEOUT.md`.
