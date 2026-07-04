---
phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42
plan: "04"
subsystem: database
tags: [acfr, pdftotext, supabase, treasury_sync_budget_tree, mississippi, state-acfr, p2-clamp]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: opaque/varying per-year MS filename enumeration, bookend ties, NASBO baseline,
      FY2024 negative Investment income P2-clamp flag, near-single-fund layout note
  - phase: 119-01
    provides: extract_gf.py position-anchor generalization, gen_state.py CONFIGS pattern,
      rev_boundary mechanism (SC precedent)
provides:
  - Mississippi state node (ebec9e07-a79e-44b0-b5d5-2551625d4b8e) fully upgraded from
    NASBO-only to State-ACFR GAAP GF revenue-by-source + GAAP spending-by-function,
    FY2003-2024 (22 years, zero honest holes within the window; FY2025 confirmed absent)
affects: [120-acfr-upgrade-batch-3, 121-acfr-upgrade-batch-4, 123-nasbo-retirement, 124-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "gen_state.py's rev_boundary mechanism (SC precedent) generalizes cleanly to a second
      state with a single 'Taxes:' sub-heading ahead of ALL revenue lines -- MS confirms the
      fix is reusable, not a one-off"
    - "clampForRender handles TWO simultaneous negative revenue lines in the same fiscal year
      (FY2024 Investment income + Rentals) with no loader changes -- the P2 clamp mechanism
      is generic per-line, not limited to a single flagged negative per year"

key-files:
  created:
    - scripts/processMSAcfr.js
    - scripts/processMSRevenueAcfr.js
    - _acfr-work/ms/ms_all.json (gitignored)
    - .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-04-MS-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored -- CONFIGS['MS'] entry + rev_boundary reuse, no new
      shared-code fixes needed)

key-decisions:
  - "Loaded the recon's full confirmed window FY2003-2024 (22 years) with ZERO honest holes --
    every single year tied exactly on the first extraction pass on both revenue and
    expenditure sides, the cleanest large-window load in Batch 2 alongside Maine's 119-03"
  - "FY2025 re-checked live at dfa.ms.gov/publications (not assumed from the recon) --
    confirmed still absent; logged as an honest hole, not invented"
  - "Discovered TWO additional negative-line years beyond the recon's single FY2024 flag
    (FY2022 Investment income -267,988K, FY2023 Rentals -957K) by scanning every year for
    negatives before writing, per the plan's own instruction -- all three years clamp
    correctly with zero loader changes"

patterns-established: []

requirements-completed: [ACFR-41]

# Metrics
duration: 50min
completed: 2026-07-04
---

# Phase 119 Plan 04: Mississippi ACFR Upgrade (ACFR-41) Summary

**Mississippi state node upgraded from NASBO-only to full State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function) across FY2003-2024 (22 years, zero honest holes), FY2024's dual-negative-line P2 clamp exercised and confirmed still ties to $22,709,403K, NASBO FY2023/FY2024 replaced in place.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 completed
- **Files modified:** 2 committed (scripts/processMSAcfr.js, scripts/processMSRevenueAcfr.js) + 1 LOADLOG + gitignored _acfr-work tooling (gen_state.py CONFIGS['MS'] + ms/ms_all.json)

## Accomplishments
- Enumerated all 22 opaque/varying per-year ACFR filenames from `dfa.ms.gov/publications`
  (no derivable pattern — `2003-cafr.pdf`, `2014cafr.pdf` [no hyphen], `2015_cafr.pdf`
  [underscore], `2021-annual-comprehensifinancial-report.pdf` [source typo, preserved
  verbatim], `FY24  ACFR Final.pdf` [double space], etc.) and downloaded all 22 real PDFs
  (`%PDF` magic, 1.4MB-11.5MB, zero soft-404s)
- Extracted the General column (near-single-fund, 1st of 2-5 columns) via `pdftotext -table`
  + `extract_gf.py` — **all 22 years FY2003-2024 tied exactly ($0 diff) on the first
  extraction pass**, both revenue and expenditure sides, zero honest holes within the window
- Discovered MS's printed statement puts a single "Taxes:" sub-heading ahead of ALL revenue
  lines (SC precedent, confirmed across all 22 years) — applied `rev_boundary='Licenses, fees
  and permits'` so only the 6 genuine tax lines get the " taxes" suffix
- Confirmed BOTH recon bookends exactly: FY2024 $22,709,403,000 / FY2003 $9,707,864,000
- **FY2024 P2 clamp exercised on TWO simultaneous negative lines** — Investment income
  (-$434,060K, material) AND Rentals (-$338K, immaterial) — both render at 0 with signed
  magnitude in the label; parent total still ties exactly to $22,709,403,000. Also found and
  clamped two additional negative years not flagged in the recon's two-bookend sample:
  FY2022 Investment income (-$267,988K) and FY2023 Rentals (-$957K)
- Re-checked `dfa.ms.gov/publications` for a published FY2025 ACFR — confirmed absent (both
  a targeted href grep and a broad FY25/2025 text search returned nothing); logged as an
  honest hole matching the 117 recon exactly, not invented
- Live-loaded all 22 fiscal years (44 rows total) — FY2023/FY2024 NASBO operating rows
  replaced in place (same RPC key, same underlying row id updated); confirmed via idempotent
  re-run of the FY2024 clamp year (0 net change, 0 `data_sources` residue); Money In
  auto-enabled (22 new revenue rows); cohort spot-check (AK/ME/NE) unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate both MS loaders + download/extract/transcribe + dry-run tie** - `74c3d02` (feat)
2. **Task 2: Live-load MS (operating + revenue), NASBO replaced in place** - DB-only, no repository file changes of its own; verified in Task 3's commit
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification + LOADLOG** - `bb7eb29` (feat)

## Files Created/Modified
- `scripts/processMSAcfr.js` - Mississippi GF operating (spending-by-function) loader, GAAP basis, UNITS=1000
- `scripts/processMSRevenueAcfr.js` - Mississippi GF revenue (by-source) loader, GAAP basis, UNITS=1000
- `_acfr-work/gen_state.py` (gitignored) - added `CONFIGS['MS']` (rev_boundary reuse, no new shared-code fixes needed)
- `_acfr-work/ms/ms_all.json` (gitignored) - assembled per-FY revenue+expenditure trees, FY2003-2024
- `.planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-04-MS-LOADLOG.md` - full per-FY load disposition, P2-clamp exercise record, NASBO-replacement + ~3.42x accept-relabel note, idempotency result

## Decisions Made
- Loaded the recon's full confirmed window FY2003-2024 (22 years) — unlike Maine's 119-03
  (which had to narrow from the recon's aspirational window due to a pre-GASB-34 boundary),
  MS's window matched the recon exactly with zero honest holes.
- FY2025 was re-verified live rather than trusted from the recon alone — the recon was dated
  2026-07-03 and this load ran 2026-07-04, so a fresh check against the live publications
  page was the honest approach; result matches the recon (still absent).
- The two additional negative years (FY2022, FY2023) beyond the recon's single FY2024 flag
  were found by scanning every year's items for negative values before writing, per the
  plan's explicit instruction ("check all other years at load") — no loader change was
  needed since `clampForRender` is already generic per negative category, not hardcoded to
  FY2024.

## Deviations from Plan

None — plan executed exactly as written. All success criteria (bookend ties, P2 clamp
exercise, NASBO replacement, idempotency, 0 residue, Money In, cohort-untouched) were met on
the first pass with no auto-fixes required.

## Issues Encountered

None. This was the cleanest large-window ACFR load in the tranche (alongside Maine's 119-03)
— all 22 years tied on the first extraction pass, no wrapped labels, no OCR/encryption
issues, no dual-subsection collisions, no rev_boundary complications beyond the expected
single "Taxes:" header (already generalized from SC). One operational note: the live-load
loop was run in FY-by-FY batches rather than the loader's own multi-year batch mode, purely
because the Bash tool's 2-minute default command timeout was shorter than the cumulative
runtime of 22 sequential live `node` invocations in one call — this did not affect
correctness (each FY's write is independent and idempotent).

## User Setup Required
None — no external service configuration required. Live writes used the existing gitignored `.env` service-role credentials already present in the main working tree.

## Next Phase Readiness
- Mississippi (ACFR-41) is fully loaded and verified idempotent with 0 residue; ready for
  Phase 124's independent re-derivation + cohort audit + Chris UAT.
- No blockers for 119-05 (Montana), which proceeds independently in this phase's remaining plan.

---
*Phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: scripts/processMSAcfr.js
- FOUND: scripts/processMSRevenueAcfr.js
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-04-MS-LOADLOG.md
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-04-SUMMARY.md
- FOUND commit: 74c3d02
- FOUND commit: bb7eb29
