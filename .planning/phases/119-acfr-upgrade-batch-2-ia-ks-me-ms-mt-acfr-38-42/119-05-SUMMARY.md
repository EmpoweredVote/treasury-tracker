---
phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42
plan: "05"
subsystem: database
tags: [acfr, pdftotext, supabase, treasury_sync_budget_tree, montana, state-acfr, batch-2-closeout]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: opaque/varying per-year MT filename enumeration, bookend ties, NASBO baseline,
      annual-vs-biennial resolution, ~1.29x accept-relabel note, 1st-of-many wide-layout note
  - phase: 119-01
    provides: extract_gf.py position-anchor generalization, gen_state.py CONFIGS pattern,
      rev_boundary mechanism (SC precedent)
provides:
  - Montana state node (6e085a8b-97e3-479d-8879-9bb7ff4f9fb1) fully upgraded from NASBO-only
    to State-ACFR GAAP GF revenue-by-source + GAAP spending-by-function, FY2015-2025 (11 years,
    zero honest holes)
  - Batch-2 (IA/KS/ME/MS/MT) close-out — all 5 states loaded and DB-verified
affects: [120-acfr-upgrade-batch-3, 121-acfr-upgrade-batch-4, 123-nasbo-retirement, 124-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extract_gf.py section-header match now strips a trailing parenthetical note before
      comparing — MT's 'REVENUES (Note 14)' header would otherwise silently skip the entire
      revenue section (expenditures, plain 'EXPENDITURES', tie fine — the diagnostic tell).
      Generic and reusable for any future state whose statement annotates its section headers"
    - "gen_state.py rev_boundary reused a third time (SC, MS, now MT) — single 'Taxes:'
      sub-heading ahead of ALL revenue lines is a recurring ACFR layout, not a one-off"

key-files:
  created:
    - scripts/processMTAcfr.js
    - scripts/processMTRevenueAcfr.js
    - _acfr-work/mt/mt_all.json (gitignored)
    - .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-05-MT-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored -- CONFIGS['MT'] entry + rev_boundary reuse)
    - _acfr-work/extract_gf.py (gitignored -- trailing-parenthetical header-strip fix)

key-decisions:
  - "Included FY2015 (recon flagged it as a load-time re-attempt candidate, not in the confirmed
    window) because it downloaded cleanly and tied at $0 diff on both sides on the first pass --
    durable window is FY2015-2025 (11 years), one year deeper than the recon's FY2016 floor"
  - "Fixed the 'REVENUES (Note 14)' header miss generically in extract_gf.py (strip trailing
    parenthetical) rather than special-casing MT -- reusable for future annotated-header states"
  - "Annual-vs-biennial risk resolved by confirming each FY has its own single-year ACFR; loaded
    each FY as a distinct actual, no biennium split or doubled"

patterns-established: []

requirements-completed: [ACFR-42]

# Metrics
duration: 45min
completed: 2026-07-04
---

# Phase 119 Plan 05: Montana ACFR Upgrade (ACFR-42) Summary

**Montana state node upgraded from NASBO operating-only to full State-ACFR GAAP (GF
revenue-by-source + GAAP spending-by-function) across FY2015-2025 (11 years, zero honest holes),
NASBO FY2023/FY2024 replaced in place, Money In auto-enabled — and Batch 2 (IA/KS/ME/MS/MT) closed
out.** Done inline (no subagents, per operator request).

## Performance
- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 2 committed loaders + 1 LOADLOG + gitignored `_acfr-work` tooling
  (`gen_state.py` CONFIGS['MT'], `extract_gf.py` header fix, `mt/mt_all.json`)

## Accomplishments
- Enumerated all 11 opaque/varying per-year ACFR filenames off `doa.mt.gov/SFSD/ACFR-PAFR` (no
  derivable pattern — `2015.pdf`, `2016_ACFR.pdf`, `FY17_ACFR.pdf`,
  `Montana-CAFR-2018-web-version-protected.pdf`, `2019-ACFR-Web-protected-002.pdf`,
  `2020-Montana-ACFR.pdf`, `Final-Montana-ACFR---2021-wo-signature.pdf` [triple hyphen],
  `Montana-ACFR-2025-sig-on-file1.pdf` [note "1" suffix]; pre-2021 under a `/Documents/` subpath,
  FY2023-2025 not) and downloaded all 11 real PDFs (`%PDF` magic, 3.5-23.5 MB, zero soft-404s)
- Extracted the GENERAL column (1st of a wide multi-fund layout) via `pdftotext -table` +
  `extract_gf.py` — **all 11 years FY2015-2025 tied exactly ($0 diff)** on the first pass, both
  sides, zero honest holes
- **Discovered + fixed a shared extractor bug:** MT titles its revenue section "REVENUES (Note
  14)" — the trailing note defeated the exact-match header test and silently skipped the whole
  revenue section. Fixed generically (strip trailing parenthetical before matching); reusable
- Applied `rev_boundary='Charges for services'` (SC/MS precedent, third reuse) so only the 6 real
  tax lines get the " taxes" suffix and "Federal" is never mislabeled "Federal taxes"
- Confirmed both recon bookends exactly: FY2025 revenue $3,453,804,000 / FY2016 $2,039,879,000
- Resolved the annual-vs-biennial risk: each FY has its own single-year ACFR (June-30 cover),
  loaded as distinct actuals — no biennium split/doubled
- Live-loaded all 11 fiscal years (22 rows) — FY2023/FY2024 NASBO operating replaced in place
  (~1.03× operating ratio; ~1.29× revenue-vs-NASBO, federal-in-separate-fund, accept-relabelled);
  idempotent re-run of FY2025 (0 net change), 0 `data_sources` residue, Money In auto-enabled,
  cohort spot-check (AK 20/20, MS 22/22) unchanged
- **Closed out Batch 2** — all 5 states (IA/KS/ME/MS/MT) loaded and DB-verified, handed to Phase 124

## Task Commits
1. **Task 1: Generate both MT loaders + download/extract/transcribe + dry-run tie** — see commit below (feat)
2. **Task 2: Live-load MT (operating + revenue), NASBO replaced in place** — DB-only; verified in Task 3
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched + LOADLOG + batch close-out** — see commit below

## Files Created/Modified
- `scripts/processMTAcfr.js` — MT GF operating (spending-by-function) loader, GAAP basis, UNITS=1000
- `scripts/processMTRevenueAcfr.js` — MT GF revenue (by-source) loader, GAAP basis, UNITS=1000
- `_acfr-work/gen_state.py` (gitignored) — added `CONFIGS['MT']` (rev_boundary reuse)
- `_acfr-work/extract_gf.py` (gitignored) — trailing-parenthetical section-header-strip fix (shared)
- `_acfr-work/mt/mt_all.json` (gitignored) — assembled per-FY revenue+expenditure trees, FY2015-2025
- `.planning/.../119-05-MT-LOADLOG.md` — full per-FY load disposition, annual-vs-biennial resolution,
  NASBO-replacement + ~1.29× accept-relabel, idempotency result, Batch-2 close-out

## Deviations from Plan
Two positive deviations, both improvements over the plan's floor:
- **FY2015 included** — the plan set the window at FY2016-2025 with FY2015 as a re-attempt
  candidate; FY2015 tied cleanly, so the delivered window is one year deeper (FY2015-2025).
- **One shared extractor fix required** — the plan anticipated a clean generation, but MT's
  "REVENUES (Note 14)" header needed the generic parenthetical-strip fix in `extract_gf.py` before
  the revenue side would extract. Fixed generically, re-verified no regression (dry-run: 11/11
  PASS, both bookends exact).

## Issues Encountered
The `curl` download loop hit the Bash tool's 2-minute timeout after 9 of 11 large PDFs (up to
23.5 MB each); the last two (FY2024/FY2025) were fetched in a follow-up call. No correctness impact.

## User Setup Required
None — live writes used the existing gitignored `.env` service-role credentials in the main tree.

## Next Phase Readiness
- Montana (ACFR-42) is fully loaded and verified idempotent with 0 residue; ready for Phase 124.
- **Batch 2 complete.** Next: Phase 120 (Batch 3, NE/NV/NH/NM/ND).

---
*Phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42*
*Completed: 2026-07-04*
