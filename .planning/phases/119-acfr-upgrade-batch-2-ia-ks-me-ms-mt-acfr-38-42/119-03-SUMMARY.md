---
phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42
plan: "03"
subsystem: database
tags: [acfr, pdftotext, supabase, treasury_sync_budget_tree, maine, state-acfr]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: derivable acfr{YYYY}.pdf URL pattern with FY2020 exception, bookend ties,
      NASBO baseline, June-30 FY-end pre-flag (later resolved)
  - phase: 119-01
    provides: extract_gf.py position-anchor generalization, gen_state.py CONFIGS pattern
provides:
  - Maine state node (53f26018-1d20-4f6a-9c0e-400bfb91199a) fully upgraded from NASBO-only to
    State-ACFR GAAP GF revenue-by-source + GAAP spending-by-function, FY2002-2025 (24 of the
    target 26 years; FY2000/FY2001 honest holes)
affects: [120-acfr-upgrade-batch-3, 121-acfr-upgrade-batch-4, 123-nasbo-retirement, 124-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extract_gf.py's find_statement() correctly reports 'statement not found' rather than
      mis-transcribing when a candidate year's Governmental Funds statement is pre-GASB-34
      COMBINED format instead of the modern distinct-General-column format (ME FY2000/FY2001,
      same SC/AL FY2002-boundary precedent) -- confirms the extractor's honest-hole behavior
      generalizes correctly to a state whose recon window claimed years the extractor itself
      cannot confirm"

key-files:
  created:
    - scripts/processMEAcfr.js
    - scripts/processMERevenueAcfr.js
    - _acfr-work/me/me_all.json (gitignored)
    - .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-03-ME-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored -- CONFIGS['ME'] entry only, no new fixes needed)

key-decisions:
  - "Loaded FY2002-FY2025 (24 years) rather than the recon's aspirational FY2000-FY2025 (26
    years) -- FY2000/FY2001 are pre-GASB-34 COMBINED-statement years with no distinct General
    column extract_gf.py can anchor on; the recon itself never bookend-tied those two years
    directly (only FY2002 and FY2025), so this is not a contradiction of recon evidence, just
    an honest correction of its window framing"
  - "Confirmed June-30 FY-end on all 26 downloaded PDF covers (not just the two recon
    bookends) -- the pre-recon 'non-June to watch' flag on Maine is now fully resolved with
    full-window evidence, not just a sampled pair"

patterns-established: []

requirements-completed: [ACFR-40]

# Metrics
duration: 55min
completed: 2026-07-04
---

# Phase 119 Plan 03: Maine ACFR Upgrade (ACFR-40) Summary

**Maine state node upgraded from NASBO-only to full State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function) across FY2002-2025 (24 years), NASBO FY2023/FY2024 replaced in place, FY2000/FY2001 documented as honest pre-GASB-34 holes.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 completed
- **Files modified:** 2 committed (scripts/processMEAcfr.js, scripts/processMERevenueAcfr.js) + 1 LOADLOG + gitignored _acfr-work tooling (gen_state.py CONFIGS['ME'] + me/me_all.json)

## Accomplishments
- Downloaded all 26 candidate-year ME ACFR PDFs via the fully-derivable `acfr{YYYY}.pdf` URL
  pattern, with the FY2020 exception (`acfr2020v2_0.pdf`) fetched correctly — all 26 confirmed
  real PDFs (`%PDF` magic, 1.08MB–7.35MB), zero soft-404s
- Confirmed "For the Fiscal Year Ended June 30, {YYYY}" on every single one of the 26 covers
  (not just the two recon bookends) — the pre-recon "non-June to watch" flag on Maine is fully
  resolved with complete evidence
- Extracted the General column (1st of 6: General | Highway | Federal | Other Special Revenue |
  Other Governmental Funds | Total) via `pdftotext -table` + `extract_gf.py` — 24 of 26 years
  (FY2002–FY2025) tied exactly ($0 diff) on BOTH revenue and expenditure sides on the first
  extraction pass; FY2000/FY2001 correctly reported "statement not found" (pre-GASB-34 COMBINED
  statement, no distinct General column) and were omitted as honest holes
- Generated `scripts/processMEAcfr.js` (operating) + `scripts/processMERevenueAcfr.js` (revenue)
  via `gen_state.py CONFIGS['ME']`; both bookends dry-run-tied exactly (FY2025 $6,194,288,000 /
  FY2002 $2,302,006,000)
- Live-loaded all 24 fiscal years (48 rows total) — FY2023/FY2024 NASBO operating rows replaced
  in place; confirmed via idempotent re-run (`Loaded 0 rows`, 0 net change) and 0 `data_sources`
  residue; Money In auto-enabled (24 new revenue rows); cohort spot-check (AK/KS/Nebraska)
  unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate both ME loaders + download/extract/transcribe + dry-run tie** - `e6638a9` (feat)
2. **Task 2: Live-load ME (operating + revenue), NASBO replaced in place** - DB-only, no repository file changes of its own; verified in Task 3's commit
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification + LOADLOG** - `571bf17` (feat)

## Files Created/Modified
- `scripts/processMEAcfr.js` - Maine GF operating (spending-by-function) loader, GAAP basis, UNITS=1000
- `scripts/processMERevenueAcfr.js` - Maine GF revenue (by-source) loader, GAAP basis, UNITS=1000
- `_acfr-work/gen_state.py` (gitignored) - added `CONFIGS['ME']`; no shared-code generalizations needed
- `_acfr-work/me/me_all.json` (gitignored) - assembled per-FY revenue+expenditure trees, FY2002-2025
- `.planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-03-ME-LOADLOG.md` - full per-FY load disposition

## Decisions Made
- Loaded FY2002–FY2025 (24 years) as the durable clean window, rather than the recon's
  aspirational FY2000–FY2025 (26 years) — FY2000/FY2001 are pre-GASB-34 COMBINED-statement
  years with a genuinely different statement shape (no distinct General column of the modern
  Governmental Funds statement); `extract_gf.py` correctly identified this rather than
  mis-transcribing a wrong column. The recon itself never bookend-tied FY2000/FY2001 directly
  (only FY2002 and FY2025), so this is an honest correction of window framing, not a
  contradiction of recon evidence.
- No new `extract_gf.py`/`gen_state.py` generalizations were required — the 6-column wide
  layout and the position-anchor mechanism (proven on KS's 8-column layout) handled ME's
  statement without any state-specific post-processor. One real GAAP quirk was confirmed (not
  fixed, because it required no fix): Maine's printed statement lists "Capital Outlay" under the
  "Debt service:" subsection heading on the expenditure side — `default_exp_name()`'s existing
  Debt-service disambiguation only renames Principal/Interest lines, so Capital Outlay passes
  through unchanged with no name collision.
- FY2011's single negative revenue line ("Investment Income (Loss)" = −$54K, immaterial) renders
  correctly via the existing P2 clamp mechanism with no loader changes.

## Deviations from Plan

**1. [Rule 1 — honest scope correction, not a bug] Window narrowed from the plan's stated FY2000–FY2025 to the confirmed-tying FY2002–FY2025**
- **Found during:** Task 1 (extraction pass across all 26 candidate years)
- **Issue:** The plan's `must_haves` stated a target window of FY2000–FY2025 ("the deepest in Batch 2"). FY2000 and FY2001 downloaded cleanly and confirmed June-30 FY-end on their covers, but their Governmental Funds statement uses the pre-GASB-34 "COMBINED STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES" title/layout, not the modern statement with a distinct General column that `extract_gf.py` anchors on.
- **Fix:** Rather than force a mis-transcription, `extract_gf.py` was allowed to correctly report "statement not found" for both years; they were omitted as honest holes per the plan's own instruction ("If a year 404s / soft-404s / won't tie, OMIT it as an honest hole and record it — never force-write"). This matches the plan's own recon-sourced bookends (FY2002 and FY2025), which never tied FY2000/FY2001 directly in the first place.
- **Files modified:** none beyond the planned loader files — this is a data-scope finding, not a code change.
- **Verification:** All 24 remaining years FY2002–FY2025 tie exactly ($0 diff) on both revenue and expenditure; both plan-specified bookends (FY2025 $6,194,288K, FY2002 $2,302,006K) confirmed exactly.
- **Committed in:** `e6638a9` (Task 1 commit, documented in the loader's head_note and this SUMMARY)

---

**Total deviations:** 1 (honest scope correction, not an auto-fix in the Rule 1-3 code sense)
**Impact on plan:** None on correctness or the phase's success criteria — the plan explicitly requires honest-hole treatment for non-tying years, and the "deepest in Batch 2" framing was aspirational recon language, not a hard requirement; FY2002-2025 (24 years) remains the deepest confirmed window in Batch 2 (KS is 7yr, MS/IA ~22-24yr per recon).

## Issues Encountered

None beyond the FY2000/FY2001 pre-GASB-34 scope finding documented above. This was otherwise the cleanest large-window load in the tranche — every one of the 24 in-window years tied on the first extraction pass, no wrapped labels, no OCR/encryption issues, no dual-subsection collisions, no rev_boundary complications.

## User Setup Required
None — no external service configuration required. Live writes used the existing gitignored `.env` service-role credentials already present in the main working tree.

## Next Phase Readiness
- Maine (ACFR-40) is fully loaded and verified idempotent with 0 residue; ready for Phase 124's independent re-derivation + cohort audit + Chris UAT.
- No blockers for 119-04/119-05 (Mississippi/Montana), which proceed independently in this phase's remaining plans.

---
*Phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: scripts/processMEAcfr.js
- FOUND: scripts/processMERevenueAcfr.js
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-03-ME-LOADLOG.md
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-03-SUMMARY.md
- FOUND commit: e6638a9
- FOUND commit: 571bf17
