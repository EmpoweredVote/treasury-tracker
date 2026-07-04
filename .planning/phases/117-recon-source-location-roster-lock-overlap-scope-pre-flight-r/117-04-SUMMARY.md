---
phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
plan: "117-04"
subsystem: data
tags: [acfr, pdftotext, state-general-fund, recon, oklahoma, rhode-island, south-dakota, vermont, west-virginia, wyoming]

# Dependency graph
requires:
  - phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
    provides: "Oklahoma's preserved v2.14 ACFR recon (URL pattern, bookend ties, risk facts, scope-vs-NASBO) reused and re-verified"
provides:
  - "Per-state ACFR source location for all 6 Batch-4 states (OK/RI/SD/VT/WV/WY) — the last 6, completing all 50"
  - "D-03 triage confirming zero stay-NASBO-exception candidates in Batch 4 (including a corrected WY assumption)"
  - "Bookend-tie-confirmed GF Total revenues (oldest + latest FY) for all 6 states at $0 diff"
  - "Four risk facts (units/negative-lines/statement+column/FY-end) pinned per state, including a WY investment-income P2-clamp-monitoring flag"
  - "Scope-vs-NASBO magnitude + accept-relabel recommendation per state"
  - "Loader-template mapping (extract_gf.py + gen_state.py, with UNITS=1 overrides flagged for VT/WY)"
  - "Consolidated gap log + empty Phase-123 NASBO-served contribution from this batch"
affects: [121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy, 123-nasbo-retirement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opaque per-year filename enumeration (RI/WV) mirrors the NC/GA precedent — no derivable URL pattern, explicit SOURCES map required"
    - "Browser-User-Agent requirement for finance.vermont.gov (bare curl gets HTTP 403) — same class of quirk as tn.gov"
    - "Dollars-not-thousands units (VT, WY) require a UNITS=1 override to gen_state.py's default UNITS=1_000 scaling, same as the NJ precedent"
    - "Poor-OCR-scan extraction-quality gap (WY FY2002) distinct from a D-06 durable-URL gap — the URL resolves fine, but pdftotext -table output is unreliable; substituted FY2005 as the clean-text bookend"

key-files:
  created:
    - .planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-BATCH4-SOURCES.md
  modified: []

key-decisions:
  - "WY D-03 corrected: the state's biennial LEGISLATIVE budget/appropriation cycle does not preclude an annual AUDITED ACFR — sao.wyo.gov hosts a continuous FY1980-FY2025 archive, so WY passes triage as a normal RECON candidate, not a stay-NASBO/accept-relabel leading case as the plan anticipated"
  - "WY FY2002 rejected as a bookend due to poor-OCR-scan text quality (garbled digits/words); FY2005 substituted as the oldest clean-text tie-confirmed bookend within the D-04 effort budget"
  - "OK's v2.14-preserved recon re-verified rather than trusted blind (T-117-04 mitigation): re-fetched FY2024 + FY2002 PDFs live, re-derived both bookend ties from fresh pdftotext -table output — every figure byte-identical, zero rot, FY2025 still unpublished"
  - "All 6 Batch-4 states pass D-03 triage — zero stay-NASBO-exception candidates from this batch feed into the Phase 123 NASBO-served list"

requirements-completed: [RECON-11]

# Metrics
duration: 130min
completed: 2026-07-04
---

# Phase 117 Plan 04: Batch-4 ACFR Recon (OK/RI/SD/VT/WV/WY) Summary

**Located, bookend-tied, and risk-fact-pinned ACFR General Fund sources for the last 6 NASBO states (OK reused/re-verified from v2.14; RI/SD/VT/WV/WY reconned fresh), with zero stay-NASBO exceptions and a corrected WY biennial-budget assumption.**

## Performance

- **Duration:** ~130 min
- **Tasks:** 3 (Task 0: workspace + D-03 triage; Task 1: OK re-verify + RI + SD; Task 2: VT + WV + WY)
- **Files modified:** 1 (`117-BATCH4-SOURCES.md`, built incrementally across 3 commits)

## Accomplishments

- **D-03 triage for all 6 Batch-4 states:** every state publishes a clean annual GAAP ACFR with a splittable General Fund column. Zero stay-NASBO-exception candidates — this batch's contribution to the Phase 123 "nodes remaining NASBO-served" list is empty.
- **Corrected the plan's WY risk assumption:** Wyoming's biennial *legislative budget* cycle does not mean it lacks an annual *audited* ACFR. `sao.wyo.gov/publications` hosts a continuous FY1980–FY2025 archive (52 years) — the deepest of any Batch-4 state.
- **OK re-verified, not trusted blind:** re-fetched the FY2024 and FY2002 PDFs live today, confirmed `Content-Type: application/pdf`, and re-derived both bookend ties from fresh `pdftotext -table` output — every figure byte-identical to the v2.14-preserved recon (T-117-04 threat mitigated). FY2025 confirmed still unpublished.
- **RI, SD, VT, WV, WY reconned fresh:** each state's Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances → General Fund column located, its durable per-year URL pattern (or explicit-enumeration requirement) determined, and both bookend years (oldest reachable + latest) tie-confirmed to the printed total at exact $0 diff.
- **Four risk facts pinned per state** (units, negative-category years, exact statement+column, FY-end month) — all 6 states are June 30 FY-end (no non-June exception in this batch); VT and WY report in whole dollars (not thousands), requiring a `UNITS=1` loader override; WY's GF carries an unusually large investment-income exposure (Permanent Mineral Trust Fund earnings) flagged for ongoing P2-clamp monitoring, not just a one-time bookend check.
- **Scope-vs-NASBO computed for all 6:** SD (~1.03×) and VT (~1.01×) are near-parity with NASBO — the smallest divergences recorded across the whole v2.15 milestone to date; OK (~3.35×) and WV (~3.52×) show the largest divergences (federal-passthrough driven); WY's ~2.43× divergence is uniquely investment-income-driven rather than federal-passthrough-driven.
- **Loader-template mapping + gap log completed** for Phase 121 (`extract_gf.py` + `gen_state.py` for all 6, with explicit naming-exception and UNITS-override notes).

## Task Commits

Each task was committed atomically:

1. **Task 0: Workspace + doc skeleton + OK preserved-recon retrieval + D-03 triage** — `c9c51b7` (docs)
2. **Task 1: Re-verify OK (reuse) + recon RI + SD** — `0e44d29` (docs)
3. **Task 2: Recon VT + WV + WY — complete the Batch-4 SOURCES doc** — `4c62586` (docs)

_Note: this is a documentation-only recon plan — no test/feat/refactor commit types apply; all three commits are `docs(117-04): ...`._

## Files Created/Modified

- `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-BATCH4-SOURCES.md` — the complete 8-section Batch-4 recon deliverable (D-03 triage, per-state source table, bookend tie-confirmations, four risk facts, scope-vs-NASBO, recency-floor verdicts, consolidated gap log, loader-template mapping) plus per-state Detail Blocks for OK, RI, SD, VT, WV, WY.
- `_acfr-work/{ok,ri,sd,vt,wv,wy}/` — gitignored working directories containing downloaded ACFR PDFs and their `pdftotext -table` extractions (not committed, per `.gitignore` lines 108/133).

## Decisions Made

- **WY D-03 correction:** Wyoming's biennial legislative budget cycle governs appropriations only; the audited ACFR is produced annually regardless. Recon confirms WY as a normal RECON candidate, not the leading stay-NASBO/accept-relabel case the plan anticipated.
- **WY bookend substitution:** FY2002 rejected (poor-OCR-scan text — garbled digits/words make a reliable `pdftotext -table` tie infeasible within the D-04 budget); FY2005 substituted as the oldest clean-text bookend. Logged as an extraction-quality gap (not a D-06 durable-URL gap — the FY2002 URL itself resolves fine) for Phase-121 load-time OCR handling consideration.
- **OK re-verification (T-117-04 mitigation):** rather than transcribing the v2.14-preserved recon forward without a re-check, both bookend PDFs were re-fetched and re-extracted live. Result: zero rot, every figure byte-identical.

## Deviations from Plan

None — plan executed exactly as written. The WY D-03 "correction" documented above is the *intended outcome* of the plan's own D-03 triage step (the plan explicitly anticipated WY might fail triage and instructed recon to verify before assuming); finding that WY actually passes is a recon finding, not a deviation from the plan's instructions.

## Issues Encountered

- **Rhode Island / West Virginia:** both states publish ACFRs under opaque, non-derivable per-year filenames (Drupal-hosted). Resolved by enumerating each year's explicit URL directly from the respective financial-reports landing page (NC/GA precedent from prior batches).
- **Vermont:** `finance.vermont.gov` returns HTTP 403 to a bare `curl` User-Agent. Resolved by adding a browser User-Agent string (`Mozilla/5.0 ... Chrome/122.0.0.0 Safari/537.36`) to all VT fetches — same class of quirk as the previously-documented `tn.gov` browser-UA requirement.
- **Wyoming:** the FY2002 CAFR PDF is a poor-quality OCR scan with garbled text, making a reliable revenue-line extraction infeasible within the D-04 effort budget. Resolved by using FY2005 (confirmed clean, non-OCR text) as the oldest tie-confirmed bookend instead, and logging FY1980–FY2004 as an extraction-quality gap for the load phase to consider (OCR-recovery tooling precedent: KY FY2002 / CT FY2006 via `pre34Extract.mjs`-adjacent free-OCR handling).

## User Setup Required

None — no external service configuration required. Documentation-only recon, $0 spend (`pdftotext` + `curl` only, no AI).

## Next Phase Readiness

- **Phase 121 (ACFR Upgrade — Batch 4, OK/RI/SD/VT/WV/WY)** has its full input contract: every state's GF statement location, durable URL pattern (or explicit per-year enumeration), bookend-tie-confirmed GF Total revenues, four risk facts, scope-vs-NASBO recommendation, and loader-template mapping.
- **Phase 123 (NASBO Retirement)** receives an empty contribution from this batch — no Batch-4 state needs to remain NASBO-served.
- No blockers. The only load-time considerations flagged: RI/WV per-year URL enumeration (no shortcuts), VT's browser-UA requirement, VT/WY's `UNITS=1` (dollars) loader override, and WY's recommended per-year P2-clamp monitoring given its unusual investment-income exposure.

## Known Stubs

None — this is a documentation-only recon plan with no UI/data-loading code; no stub patterns apply.

## Threat Flags

None — this plan's threat model (T-117-01, T-117-02, T-117-04) was fully mitigated in-line: every downloaded PDF was confirmed `Content-Type: application/pdf` before extraction, every extracted statement's title + column header was confirmed against the GAAP Governmental Funds statement (never a budgetary/activities statement), and OK's preserved recon was re-verified live rather than trusted blind. No new network endpoints, auth paths, or schema changes were introduced.

---
*Phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r*
*Completed: 2026-07-04*
