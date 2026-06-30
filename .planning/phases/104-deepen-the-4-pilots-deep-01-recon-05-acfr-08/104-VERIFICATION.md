---
status: passed
phase: 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08
verified: 2026-06-30
method: inline (no subagent — per feedback-no-research-subagents; goal-backward against ROADMAP success criteria, confirmed by direct production treasury.budgets queries)
requirements: [DEEP-01, RECON-05, ACFR-08]
---

# Phase 104 Verification — Deepen the 4 Pilots

**Verdict: PASSED.** The CA/TX/NY/FL ACFR windows are deepened as far as Phase-103's durable URLs allowed, every added FY ties exactly to its ACFR GF column total and is GAAP-basis-labelled + per-year-sourced, the load was idempotent and never-overwrite (existing pilot rows, un-upgraded NASBO states, and PA/IL untouched), and the one negative-category added year (FL FY2021) renders via the P2 clamp. $0 spend (pdftotext + DB only, no AI). Full independent re-derivation + cohort audit + live UAT remain Phase 106's job (the milestone's verification phase).

## Success-criteria check (goal-backward, ROADMAP Phase 104)

1. **Each pilot's window extended backward, each added FY tying to its ACFR GF column total, GAAP-labelled** — ✅
   Production `treasury.budgets` (queried directly):
   - **NY** operating + revenue: 22 rows each, **FY2003→FY2024** (was FY2015–24; +12 added years). 0 null source_url, 22/22 GAAP-labelled. FY2003 bookend revenue ties $29,250,000,000.
   - **CA** operating + revenue: 18 rows each, **FY2008→FY2025** (was FY2020–25; +12). 0 null source_url, 18/18 GAAP-labelled. FY2008 bookend revenue ties $97,774,378,000.
   - **FL** operating + revenue: 4 rows each, **FY2021→FY2024** (was FY2022–24; +1). 0 null source_url, 4/4 GAAP-labelled. FY2021 bookend revenue ties $46,989,188,000.
   - **TX**: 10 rows each, FY2015→FY2024 — no new work (RECON-04 "TX FY2016" was closed in v2.11; recon re-confirmed). Unchanged.
   - Gap log (`104-DEEPEN-GAPLOG.md`): **25/25 added FYs retained, 0 gaps** — every added FY passed an EXACT tie at validate() (D-03); no year required tolerance-widening. CA encountered 0 soft-404s.

2. **Idempotent never-overwrite — existing pilot rows, un-upgraded NASBO states, and PA/IL untouched** — ✅
   - Idempotency: re-running NY --fy 2003, CA --fy 2008, FL --fy 2021 a second time each returned "Loaded 0 rows" (RPC keyed (muni, fy, dataset) → UPDATE-in-place, 0 net change).
   - Existing pilot upper windows intact within the contiguous ranges (NY 2015–24, CA 2020–25, FL 2022–24 all still present).
   - Direct DB check: **Pennsylvania** + **Illinois** still on NASBO (2 operating rows each, FY2023–24, `NASBO State Expenditure Report`, no revenue) — untouched (Phase 105's job). **Georgia** (sample un-upgraded NASBO) unchanged. **Ohio** (prior ACFR state) unchanged (6 rows FY2020–25, `State of Ohio ACFR`). Deepening was purely additive to NY/CA/FL.

3. **Negative-category added year renders via the P2 clamp** — ✅
   FL FY2021 GENERAL FUND has a negative "Investment earnings (losses)" line (−$398,287K). The clampForRender path renders it at 0 with the `(net loss — shown at 0)` label; the root total $46,989,188,000 preserves the net (ACFR-08, the OH FY2022 precedent). NY/CA added years had no negative categories.

## Requirement traceability

| REQ-ID | Covered by | Status |
|--------|-----------|--------|
| DEEP-01 | 104-01 (NY +12), 104-02 (CA +12), 104-03 (FL +1), 104-04 (live load) | ✅ |
| RECON-05 | 104-04 (idempotent never-overwrite; existing + PA/IL + NASBO untouched, DB-confirmed) | ✅ |
| ACFR-08 | 104-03 / 104-04 (FL FY2021 P2 clamp, confirmed in the live row) | ✅ |

## must_haves spot-check
- Each added FY ties EXACTLY at validate(); non-tying/non-extracting years would be skipped+logged (D-02/D-03) — 0 such cases occurred ✓
- CA stops at the FY2008 clean floor; FY2002–07 variant-naming years deferred (D-01) ✓
- CA soft-404 guard applied (Content-Type/size filter) — 0 soft-404s ✓
- Every displayed added-FY row is GAAP-basis-labelled + carries a per-year source_url/source_date (0 null source URLs across 50 added rows) ✓
- Idempotent never-overwrite proven by 0-row re-runs; PA/IL + un-upgraded NASBO states DB-confirmed unchanged ✓

## Notes for Phase 106 (verification + UAT)
- Independent re-derivation should re-extract a sample of the added FYs straight from the ACFR PDFs (not loader self-report) and compare to the stored totals.
- The NY category-name schema change between FY2012 and FY2013 (older "Local assistance grants / Departmental operations" vs newer "Local assistance / State operations") is documented in `104-DEEPEN-GAPLOG.md` — expected, all verbatim from the ACFRs.
- Money In view + `?dataset=revenue` deep-link auto-surface the deepened revenue history (no frontend work this phase) — confirm in live UAT.
