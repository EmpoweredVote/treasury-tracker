---
phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53
plan: "121-05"
subsystem: database
tags: [acfr, gaap, state-finances, pdftotext, supabase, treasury_sync_budget_tree]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: WV Detail Block (opaque Drupal media-ID URL map, bookend ties)
  - phase: 121-04
    provides: gen_state.py / extract_gf.py tooling (VT's split_row generalization, cohort-wide)
provides:
  - West Virginia state node upgraded from NASBO operating-only to full State-ACFR GAAP (FY2020-2025, revenue+operating)
affects: [124-verification-cohort-audit-uat, 123-nasbo-retirement]

# Tech tracking
tech-stack:
  added: []
  patterns: [gen_state.py CONFIGS-driven loader generation, rev_boundary single-Taxes-header disambiguation, ephemeral data_sources lifecycle (LOAD-01)]

key-files:
  created:
    - scripts/processWVAcfr.js
    - scripts/processWVRevenueAcfr.js
    - .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-05-WV-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (CONFIGS['WV'], gitignored scratch)

key-decisions:
  - "WV UNITS=1000 (thousands) hard-set; both bookends ($14,639,897K FY2025 / $10,760,376K FY2020) verified with no unit-scale mismatch"
  - "rev_boundary='Intergovernmental' clears WV's single 'Taxes:' header (SC/MS/MT precedent) so only true tax lines get the ' taxes' suffix"
  - "Zero hand-patches required -- all 6 years tied exactly $0 diff on the first extraction pass, no extract_gf.py changes needed"
  - "FY2023/FY2024 NASBO operating rows replaced in place at the same row IDs, not duplicated"
  - "~3.52x accept-and-relabel scope divergence vs NASBO (2nd-largest in Batch 4) documented prominently in loader head comments and LOADLOG"

requirements-completed: [ACFR-52]

# Metrics
duration: 25min
completed: 2026-07-05
---

# Phase 121 Plan 5: West Virginia ACFR Upgrade Summary

**West Virginia state node upgraded from NASBO-only to full State-ACFR GAAP (FY2020-2025, 6 years, zero honest holes), thousands UNITS=1000, ~3.52x accept-and-relabel divergence vs NASBO (2nd-largest in Batch 4).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-05
- **Tasks:** 3 completed
- **Files modified:** 3 (2 generated loader scripts + 1 loadlog; gen_state.py CONFIGS addition is gitignored scratch)

## Accomplishments
- Re-checked the finance.wv.gov landing page live at load time -- confirmed exactly the 6 known opaque Drupal media IDs, no newly-added older years
- Downloaded + extracted all 6 target WV ACFR PDFs (FY2020-2025); zero soft-404s, all real PDFs (%PDF magic, 5.3MB-12.2MB)
- Zero hand-patches: extract_gf.py's existing position-anchor + `rev_boundary` config (no new code changes) tied all 6 years exactly $0 diff on both revenues and expenditures on the first pass
- Live-loaded both operating (GF spending-by-function) and revenue (GF revenue-by-source) datasets across all 6 years; FY2023/FY2024 NASBO rows replaced in place at the same row IDs
- Verified idempotency (0 net change on FY2025 re-run) and 0 `data_sources` residue (LOAD-01)
- Confirmed cohort untouched (OK + VT existing ACFR nodes, WY un-upgraded NASBO state)

## Task Commits

1. **Task 1: Generate both WV loaders (UNITS=1000) via gen_state.py + download/extract FY2020-2025 + dry-run tie** - `9c42a71` (feat)
2. **Task 2: Live-load WV (operating + revenue) across the tied window, NASBO replaced in place** - live DB writes only, no new tracked files (loader scripts already committed in Task 1)
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification (DB query) + LOADLOG** - included in plan metadata commit (following this SUMMARY)

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `scripts/processWVAcfr.js` - WV GF spending-by-function loader (dataset_type='operating'), UNITS=1000, FY2020-2025
- `scripts/processWVRevenueAcfr.js` - WV GF revenue-by-source loader (dataset_type='revenue'), UNITS=1000, FY2020-2025
- `.planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-05-WV-LOADLOG.md` - per-FY load disposition, ~3.52x divergence note, idempotency result
- `_acfr-work/gen_state.py` (gitignored) - added `CONFIGS['WV']`

## Decisions Made
- UNITS=1000 thousands hard-set for WV (printed statement is in thousands) — verified against both plan-pinned bookends exactly.
- `rev_boundary='Intergovernmental'` clears the single "Taxes:" subsection header ahead of ALL revenue items (SC/MS/MT precedent) — only the true tax lines get the " taxes" suffix; "Intergovernmental" and the trailing catch-all "Other" pass through unaffected.
- No extractor code changes were required — WV's PDFs extracted cleanly through the existing shared `extract_gf.py`/`gen_state.py` tooling inherited from the OK/RI/SD/VT precedent in this same batch.

## Deviations from Plan

None - plan executed exactly as written. All 6 target years (FY2020-2025) tied exactly on the first extraction pass with zero hand-patches, zero honest holes, and zero new extractor bugs discovered.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- West Virginia (ACFR-52) is fully loaded and verified: all 6 FY2020-2025 years on GAAP ACFR basis, thousands-scaled, NASBO replaced in place, Money In auto-enabled, 0 data_sources residue, cohort untouched.
- Hands WV to Phase 124 (Verification + Cohort Audit + UAT).
- No blockers for the next plan in this batch (121-06, Wyoming).

---
*Phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: scripts/processWVAcfr.js
- FOUND: scripts/processWVRevenueAcfr.js
- FOUND: .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-05-WV-LOADLOG.md
- FOUND: .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-05-SUMMARY.md
- FOUND commit: 9c42a71
