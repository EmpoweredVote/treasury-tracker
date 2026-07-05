---
phase: 124-verification-cohort-audit-uat-ver-09-ver-10
plan: 01
subsystem: verification
tags: [acfr, pdftotext, ocr, tesseract, blind-rederivation, supabase, treasury.budgets]

# Dependency graph
requires:
  - phase: 118-121 (ACFR Upgrade Batches 1-4)
    provides: all 21 remaining NASBO states upgraded to State-ACFR GAAP GF revenue/spending
  - phase: 122 (Deepening — Existing ACFR Node Pre-window Holes)
    provides: CA FY2002-2007 and FL FY2003-2020 deepened GF history
provides:
  - Loader-independent blind re-derivation harness (scripts/verify-phase124-rederive.mjs)
  - 124-REDERIVATION.md — the VER-09(a) per-FY-dataset tie log (151 checks)
affects: [124-02-cohort-audit, 124-03-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blind re-derivation harness pattern (Phase 106/110/116/124 lineage): zero loader/parser imports, own pdftotext -table extraction, exact-$0 PASS bar, per-state units/quirks table"
    - "Independent OCR re-derivation for image/scan-only statement pages: fresh pdftoppm render + tesseract OCR every run, never reads loader-embedded static JSON arrays"
    - "Singular-vs-plural total-line regex widening (safe superset) discovered by SD's 'Total Revenue' (no trailing s) label"
    - "Budget-schedule-page exclusion refined from bare 'budget' substring to 'budgetary comparison'/'budget and actual' to avoid false-excluding WY's real statement page (has a 'Budget Reserve Fund' column)"

key-files:
  created:
    - scripts/verify-phase124-rederive.mjs
    - .planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-REDERIVATION.md
  modified: []

key-decisions:
  - "ID FY2004's ~$22/$29 rounding delta is EXPLAINED (verbatim per the 118-05 loadlog's own documented mixed-unit whole-dollar/thousands normalization), not fixed — it is the loader's own pre-approved rounding artifact, not a transcription defect."
  - "IA's NET REVENUES tie is re-keyed directly from the printed 'NET REVENUES' row rather than recomputed as GROSS minus refunds — the printed statement already bakes in that arithmetic, so re-keying the literal row is the more independent (and simpler) verification."
  - "OCR-independent checks (NM FY2022, OK FY2019, SD FY2007, SD FY2010) render+OCR the source PDF fresh on every harness run rather than reusing any previously-rendered PNG files on disk, to keep the independence claim auditable."

requirements-completed: [VER-09]

# Metrics
duration: 60min
completed: 2026-07-05
---

# Phase 124 Plan 01: VER-09a Blind Re-Derivation Summary

**Loader-independent ACFR re-derivation harness ties 149/151 FY-dataset checks at exact $0 across all 21 v2.15 final-tail states plus the full 24-state-FY CA/FL deepening set, with the only 2 non-zero deltas explained by a pre-existing documented loadlog rounding note.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-07-05T20:26:13Z
- **Completed:** 2026-07-05T21:26:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- Built `scripts/verify-phase124-rederive.mjs`, a from-scratch blind re-derivation harness covering the risk-weighted sample across all 21 newly-loaded v2.15 final-tail states (AK, AR, DE, HI, ID, IA, KS, ME, MS, MT, NE, NV, NH, NM, ND, OK, RI, SD, VT, WV, WY) plus the EXHAUSTIVE 24-state-FY CA/FL deepening set (CA FY2002–FY2007, FL FY2003–FY2020) — 78 FY targets, 151 FY-dataset checks.
- Zero loader/parser code imported or shelled out to anywhere in the harness (verified by source inspection): no `scripts/process*Acfr.js`, no `_acfr-work/extract_gf.py` / `gen_state.py` / `ia_extract.py` / `build_state.py`, no `maAcfrExtract.mjs` / `pre34Extract.mjs`.
- Implemented independent OCR re-derivation (fresh `pdftoppm` render + `tesseract` OCR every run) for the 4 image/scan-only statement years: NM FY2022 (raster-image pp.36–37), OK FY2019 (embedded JPEG p.56), SD FY2007 + FY2010 (2 of 9 whole-document-scanned years) — all 4 tied exact $0 against the live DB.
- Result: **149/151 exact $0 ties**; the only 2 non-zero deltas (ID FY2004 revenue −$22 / operating +$29) are explained verbatim against the pre-existing 118-05 loadlog's documented mixed-unit whole-dollar/thousands normalization rounding — not a transcription defect, no in-phase fix required, no new tolerance band introduced.
- Wrote `124-REDERIVATION.md`: the full 151-row disposition table (State | FY | Dataset | independent total | DB total | delta | disposition) plus the sample-documentation section recording every middle-year/clamp-year/OCR-page choice for reproducibility.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the loader-independent re-derivation harness** - `b817b2a` (feat)
2. **Task 2: Disposition every delta and write 124-REDERIVATION.md** - `91c23e2` (docs)

_No plan-metadata commit yet — STATE.md/ROADMAP.md updates follow this SUMMARY per the execution workflow._

## Files Created/Modified

- `scripts/verify-phase124-rederive.mjs` - Loader-independent blind ACFR re-derivation harness (21-state final-tail sample + exhaustive CA/FL deepening, OCR path for 4 image/scan years)
- `.planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-REDERIVATION.md` - The VER-09(a) independent re-derivation log (151 checks, full disposition table)

## Decisions Made

- ID FY2004's rounding delta is dispositioned as EXPLAINED (verbatim loadlog reference), not fixed — see key-decisions above.
- IA's NET-REVENUES tie re-keys the literal printed "NET REVENUES" row rather than independently recomputing GROSS − refunds arithmetic — this is still a genuinely independent re-derivation (the harness never reads the loader's own arithmetic or embedded values) while being simpler and less error-prone than reimplementing the subtraction.
- The 4 OCR-dependent checks re-render and re-OCR the source PDF fresh on every run (not reusing any prior PNG renders left on disk from the load-time recon), to keep the "independent of the loader" claim cleanly auditable — this cost extra time per run but is the more defensible design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SD's singular "Total Revenue" label caused a false "statement not auto-located" failure on the auto-extracted years**
- **Found during:** Task 1, first harness run (SD FY2002 and FY2025 both auto-extracted, non-OCR years)
- **Issue:** The standard modern-statement total-line regex only matched the plural "total revenues"/"total expenditures" forms (following the Phase 106/110/116 precedent, where every prior cohort state used plural labels). South Dakota's printed statement uses the SINGULAR "Total Revenue" (no trailing "s") — the harness's own `parseModernGFTotals` function silently failed to find a match on SD's real statement page, causing both SD FY2002 and FY2025 to report "Governmental Funds statement not auto-located" even though `pdftotext` extraction succeeded and the correct numbers were present in the raw text.
- **Fix:** Widened the revenue/expenditure total-line regex to accept an optional trailing "s" (`total revenues?`/`total expenditures?`), a safe superset per the 121-03 SD-loadlog's own documented precedent for the identical defect in the loader's `extract_gf.py`. Re-verified zero regression against all 20 other plural-label states.
- **Files modified:** `scripts/verify-phase124-rederive.mjs`
- **Verification:** Re-ran the full harness; SD FY2002 and FY2025 both now tie exact $0 ($697,589,000/$879,803,000 and $2,423,413,000/$2,599,721,000 respectively), matching the 121-03 loadlog bookends exactly. All other 20 states' checks remained unaffected (still exact $0).
- **Committed in:** `b817b2a` (Task 1 commit — fix applied before the harness was committed, so no separate fix-commit was needed)

**2. [Rule 1 - Bug] WY's "Budget Reserve Fund" column name falsely excluded its own real GAAP statement page**
- **Found during:** Task 1, initial design review (caught before the first full run, via a targeted pdftotext spot-check of WY2005.pdf) — WY's real "Statement of Revenues, Expenditures and Changes in Fund Balances-Governmental Funds" page includes a fund literally named "Budget Reserve Fund" as one of its column headers. The 116-template's page-locator excluded any candidate page containing the bare substring "budget" (intended to skip non-GAAP Budget-and-Actual comparison schedules), which would have falsely excluded WY's only correct statement page.
- **Issue:** A budget-schedule exclusion filter too broad for WY's specific fund-naming convention would have caused every WY check to fail with "statement not auto-located", masking the correct extraction entirely.
- **Fix:** Refined the exclusion filter from a bare `includes('budget')` check to `includes('budgetary comparison') || includes('budget and actual') || includes('budget to actual')` — still excludes genuine non-GAAP budget-vs-actual schedules, but no longer false-positives on a column literally named "Budget Reserve Fund".
- **Files modified:** `scripts/verify-phase124-rederive.mjs`
- **Verification:** WY FY2005, FY2013, and FY2025 all tie exact $0 in the full harness run.
- **Committed in:** `b817b2a` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs discovered and fixed during harness development, before the harness was committed). Neither affected the plan's scope or objective; both are documented here for auditability since they involved changing the extraction logic after the initial design.

**Impact on plan:** Both fixes were necessary to correctly re-derive SD and WY at all — without them, 2 of 21 sampled states would have shown false failures unrelated to any actual data defect. No scope creep; both fixes stayed within Task 1's stated deliverable (a working harness that correctly re-derives every sampled state-FY).

## Issues Encountered

None beyond the two auto-fixed extraction-logic bugs documented above. All PDF fetches (fresh downloads for the 24 CA/FL deepening years, cache reuse for all 54 final-tail-sample years) succeeded on the first attempt with no soft-404s or Wayback-mirror failures (including NH's Wayback-mirrored URLs, which resolved from the existing cache without needing a live re-fetch).

## Next Phase Readiness

- `124-REDERIVATION.md` is ready to be consumed by Plan 02 (cohort audit) and Plan 03 (UAT prep) as the VER-09(a) evidence record.
- VER-09 part (b) (if any — cohort-wide source-chain audit) is scoped to Plan 02, not this plan.
- No blockers. The harness and its output are self-contained and require no further action before Plan 02 begins.

---
*Phase: 124-verification-cohort-audit-uat-ver-09-ver-10*
*Plan: 01*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: scripts/verify-phase124-rederive.mjs
- FOUND: .planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-REDERIVATION.md
- FOUND: .planning/phases/124-verification-cohort-audit-uat-ver-09-ver-10/124-01-SUMMARY.md
- FOUND commit: b817b2a (Task 1 — harness)
- FOUND commit: 91c23e2 (Task 2 — REDERIVATION.md)
- FOUND commit: 9237c11 (SUMMARY.md)
