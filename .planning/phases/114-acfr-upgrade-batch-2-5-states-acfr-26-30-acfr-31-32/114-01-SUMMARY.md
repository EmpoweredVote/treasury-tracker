---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
plan: 01
subsystem: database
tags: [acfr, state-budget, supabase, pdftotext, south-carolina, nasbo-supersede]

# Dependency graph
requires:
  - phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
    provides: SC source location + bookend ties (112-BATCH2-SOURCES.md) + roster lock
  - phase: 113-acfr-upgrade-batch-1-in-az-or-mo-co
    provides: extract_gf.py + gen_state.py tooling, IL loader template, ephemeral data_sources lifecycle
provides:
  - South Carolina state node (f0024b19) live on full State-ACFR GAAP, FY2002-FY2025
  - scripts/processSCAcfr.js + scripts/processSCRevenueAcfr.js (reusable SC loaders)
  - gen_state.py rev_boundary config option (reusable fix for future states with the
    same single-"Taxes:"-header-covers-all-revenue-lines printed-statement quirk)
affects: [116-verification-source-chain-audit-uat]

# Tech tracking
tech-stack:
  added: []
  patterns: [gen_state.py rev_boundary option for mislabeled sub-heading boundaries, norm() dot-leader/$ stripping]

key-files:
  created:
    - scripts/processSCAcfr.js
    - scripts/processSCRevenueAcfr.js
    - .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-01-SC-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored — rev_boundary option + norm() hardening; not committed to git)

key-decisions:
  - "SC's printed statement puts a single 'Taxes:' header ahead of ALL revenue lines (confirmed all 24 years) -- fixed via a new gen_state.py rev_boundary config option rather than hand-authoring category names"
  - "FY2025 sourced from the BasicFinancialStatements part-PDF per the confirmed 9-part split-file structure, not a combined file"
  - "Loaded the full FY2002-FY2025 window (24 years) with zero honest holes -- every year tied exactly on first extraction pass"

patterns-established:
  - "rev_boundary config option in gen_state.py: clears a mis-propagated sub-heading label at a named non-tax boundary line, reusable for future states with the same printed-statement quirk"

requirements-completed: [ACFR-26, ACFR-31, ACFR-32]

# Metrics
duration: 17min
completed: 2026-07-03
---

# Phase 114 Plan 01: South Carolina ACFR Upgrade Summary

**South Carolina state node upgraded NASBO-only to full State-ACFR GAAP (GF revenue-by-source + spend-by-function), FY2002-FY2025, 24 years with zero honest holes, all tying to $0 diff.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-03T01:12:15Z
- **Completed:** 2026-07-03T01:29:00Z
- **Tasks:** 3 completed
- **Files modified:** 3 (2 new loaders + 1 loadlog); STATE.md/ROADMAP.md/REQUIREMENTS.md updated separately

## Accomplishments

- Built `scripts/processSCAcfr.js` (GF spend-by-function, `operating`) and `scripts/processSCRevenueAcfr.js` (GF revenue-by-source, `revenue`) on the IL/Phase-113 loader template, generated via `_acfr-work/gen_state.py`
- Downloaded, extracted, and tie-verified all 24 fiscal years FY2002-FY2025 from cg.sc.gov ACFR/CAFR PDFs — every year ties exactly ($0 diff) to the printed General Fund column "Total revenues" / "Total expenditures" on the Statement of Revenues, Expenditures, and Changes in Fund Balances (Exhibit B-2)
- Bookends confirmed: FY2025 GF Total revenues = $20,731,521,000; FY2002 = $5,763,261,000
- Live-loaded both operating and revenue for all 24 years; NASBO FY2023/FY2024 operating rows replaced in place (zero duplicates, zero remaining NASBO labels)
- Discovered and fixed a real revenue-labeling defect: SC's printed statement groups ALL revenue lines (including non-tax lines like "Federal" and "Departmental services") under one "Taxes:" header with no closing marker — `extract_gf.py` had no way to detect the true boundary from `-table` output. Added a `rev_boundary` option to `gen_state.py` that clears the mis-propagated sub-heading at the first confirmed non-tax line ("Licenses, fees, and permits") — verified present in the same list position across all 24 years
- Proved idempotency (FY2024 re-run = 0 net change, byte-for-byte) and 0 `data_sources` residue (`sc-acfr-%` count = 0 both before and after)
- Confirmed the cohort is untouched: spot-checked IN/CA/PA (existing ACFR nodes, unchanged) and KY (un-upgraded Batch-2 roster state, still clean NASBO-only)
- Documented the ~1.46x SC-vs-NASBO scope divergence with its correct driver: a GAAP-vs-budgetary basis consolidation, NOT federal passthrough (federal inside the GF column is only ~$46M) — the outlier driver among this tranche's states

## Task Commits

1. **Task 1: Build both SC loaders + download/extract/transcribe FY2002-FY2025 + dry-run tie** - `78331ee` (feat)
2. **Task 2 + 3: Live-load SC (operating + revenue) + idempotency/0-residue/cohort verification + LOADLOG** - `b70848e` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/processSCAcfr.js` - SC GF spending-by-function loader, `dataset_type='operating'`, UNITS=1000, tie-verified FY2002-FY2025
- `scripts/processSCRevenueAcfr.js` - SC GF revenue-by-source loader, `dataset_type='revenue'`, UNITS=1000, tie-verified FY2002-FY2025
- `.planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-01-SC-LOADLOG.md` - Per-FY load disposition, NASBO-replacement confirmation, scope-divergence record, idempotency + 0-residue result
- `_acfr-work/gen_state.py` (gitignored, not committed) - added `rev_boundary` config option + `norm()` dot-leader/`$` stripping hardening; added the `SC` CONFIGS entry

## Decisions Made

- **rev_boundary as a reusable config option, not a one-off hack:** rather than hand-writing SC's category names outside the shared tooling, extended `gen_state.py` with a generically-named `rev_boundary` option so any future state with the same "one header covers everything" printed-statement quirk can reuse it.
- **Loaded the full FY2002-FY2025 window, no honest holes:** recon flagged SC as having the deepest live archive of the Batch-2 states (back to FY1993), but the locked tranche boundary is FY2002 (pre-GASB-34). Within that window every single year extracted cleanly on the first pass — no year needed to be skipped or manually patched.
- **FY2025 sourced from the confirmed part-file**, not the combined `001-316-ACFR-FY2025.pdf` file that was later discovered to also exist (8.6MB, 316 pages) — used the smaller, already-recon-confirmed `039-191-...-BasicFinancialStatements.pdf` part per the plan's explicit interface guidance, since it's already verified to contain and tie the target statement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a revenue-category mislabeling defect in the shared gen_state.py tool**
- **Found during:** Task 1 (generating the SC loaders and inspecting the output)
- **Issue:** SC's printed Governmental Funds statement groups every revenue line item — including non-tax lines like "Federal", "Departmental services", "Fines and penalties" — under a single "Taxes:" subsection header with no second header before the non-tax lines begin. `extract_gf.py`'s sub-heading propagation (inherited unchanged from the IN/AZ/MO/OR/CO template, where this never came up) would cause `gen_state.py`'s `default_rev_name` to append " taxes" to every one of these items, producing factually wrong labels like "Federal taxes" and "Departmental services taxes" on a public-facing financial transparency page.
- **Fix:** Added a `rev_boundary` config option to `gen_state.py`'s `block()` function. When set (SC: `'Licenses, fees, and permits'`), the first item whose normalized label starts with that string ends the "Taxes:" grouping for the rest of that year's revenue list — verified this boundary line is present in the identical list position across all 24 loaded years (2002-2025), confirming it's a stable structural signal, not a one-year coincidence. Also hardened `norm()` to strip `pdftotext` dot-leader artifacts and stray `$` tokens that had leaked into several pre-2013 raw labels.
- **Files modified:** `_acfr-work/gen_state.py` (gitignored working tool, not committed to git; regenerated `scripts/processSCRevenueAcfr.js` from the fixed generator)
- **Verification:** Re-generated both loaders after the fix and confirmed the dry-run output shows correct labels ("Federal", "Departmental services", "Fines and penalties" unprefixed) while true tax lines ("Individual income", "Retail sales and use", "Corporate income", etc.) correctly carry the " taxes" suffix; all 24 years still tie to $0 diff (the fix only touches display names, never the extracted numeric values used for the tie-out).
- **Committed in:** `78331ee` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for data-labeling accuracy/honesty (ACFR-31's "honest relabel" spirit extends to category names, not just the top-level scope note). No scope creep — the fix stayed inside the shared generator tool and only affected SC's revenue category names.

## Issues Encountered

None beyond the deviation documented above. All 24 fiscal years downloaded with valid `%PDF` magic bytes and sizes well above the 500KB soft-404 threshold on the first attempt; no retry loop was needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- South Carolina is fully ACFR-sourced (24 years, operating + revenue, GAAP-labelled, NASBO replaced, Money In enabled) and ready to hand off to Phase 116 for independent re-derivation + cohort audit + UAT alongside the rest of the Batch-2 states (KY/UT/AL/LA).
- No blockers. `gen_state.py`'s new `rev_boundary` option is available for reuse by any remaining Batch-2/Batch-3 or deepening-pass state that turns out to have the same single-header revenue-grouping quirk.

## Self-Check: PASSED

- FOUND: scripts/processSCAcfr.js
- FOUND: scripts/processSCRevenueAcfr.js
- FOUND: .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-01-SC-LOADLOG.md
- FOUND: commit 78331ee (Task 1)
- FOUND: commit b70848e (Task 2+3)

---
*Phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32*
*Completed: 2026-07-03*
