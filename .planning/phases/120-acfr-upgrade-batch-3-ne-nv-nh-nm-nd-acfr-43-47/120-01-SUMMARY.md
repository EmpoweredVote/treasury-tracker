---
phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47
plan: "01"
subsystem: database
tags: [acfr, nasbo-retirement, state-acfr, gaap, treasury-budgets, supabase, nebraska]

requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: NE source recon (derivable per-FY URL, GENERAL FUND column identification, bookend ties)
  - phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42
    provides: gen_state.py / extract_gf.py v2.14 tooling lineage, LOAD-01 ephemeral data_sources pattern
provides:
  - Nebraska state node fully upgraded NASBO -> State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function), FY2020-FY2025, zero honest holes
  - extract_gf.py generalized to treat U+FFFD (replacement char from errors='replace') as a DASH_TOKEN alongside '-'/'--'/'—', fixing a silent column-shift bug on PDFs with invalid UTF-8 blank-cell glyphs (0xAD soft hyphen)
affects: [121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy, 123-nasbo-retirement, 124-verification-cohort-audit-uat]

tech-stack:
  added: []
  patterns:
    - "gen_state.py CONFIGS['NE'] clean-derivable-URL clone (CO/IN/AR/KS lineage)"
    - "errors='replace' + U+FFFD DASH_TOKEN recognition in extract_gf.py for PDFs with invalid-byte blank-cell placeholders"

key-files:
  created:
    - .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-01-NE-LOADLOG.md
  modified:
    - scripts/processNEAcfr.js
    - scripts/processNERevenueAcfr.js
    - _acfr-work/gen_state.py

key-decisions:
  - "NE ACFR GF ~1.19x NASBO GF (smallest divergence in Batch 3) accepted and relabelled honestly — NE's General Fund is ~91% own-source (Income Tax + Sales/Use Tax); federal flows post to the separate Federal Fund major-fund column, not General"
  - "FY2020 'Other Taxes' -$193K and FY2022 'Investment Income' -$191,405K both routed through the existing P2 clamp (render at 0, signed magnitude preserved in label) rather than treated as extraction errors"
  - "0xAD soft-hyphen blank-cell glyph in the FY2024 PDF fixed generically in extract_gf.py (errors='replace' + U+FFFD DASH_TOKEN) rather than hand-patched only for NE — reusable for any future state whose PDF renders blank GF cells as an invalid UTF-8 byte"

requirements-completed: [ACFR-43]

duration: ~15min (Tasks 2-3, resumed session; Task 1 completed in a prior session)
completed: 2026-07-04
---

# Phase 120 Plan 01: Nebraska ACFR Upgrade (ACFR-43) Summary

**Nebraska state node upgraded NASBO->State-ACFR GAAP: GF revenue-by-source + GAAP spending-by-function live for FY2020-2025 (6 years, zero honest holes), NASBO operating rows replaced in place, ~1.19x near-parity divergence recorded.**

## Performance

- **Duration:** ~15 min for Tasks 2-3 (this session); Task 1 (loader generation + dry-run tie) was completed in a prior session
- **Completed:** 2026-07-04
- **Tasks:** 3/3 (Task 1 pre-completed and verified at resume; Tasks 2-3 executed this session)
- **Files modified:** 1 created (120-01-NE-LOADLOG.md); scripts/processNEAcfr.js + processNERevenueAcfr.js + _acfr-work/gen_state.py were created/modified in Task 1 (prior session, commit 2df24e3)

## Accomplishments

- Live-loaded Nebraska General Fund operating (GAAP spending-by-function) and revenue (GAAP revenue-by-source) for all 6 target fiscal years FY2020-FY2025, 12 rows total, every year tying exactly to the printed GENERAL FUND column totals
- Replaced FY2023 ($5,154,000,000) and FY2024 ($5,314,000,000) NASBO operating rows in place with ACFR GAAP totals ($5,588,274,000 / $6,327,646,000) — same row `id`s before/after, confirming UPDATE not insert+delete; 0 NASBO labels remain on the NE node
- Confirmed both bookend ties live in the DB: FY2025 revenue $6,308,910,000, FY2020 revenue $4,993,719,000
- Proved idempotent never-overwrite: a second live run of NE --fy 2025 (both loaders) reported "Loaded 0 rows" with identical row ids/totals afterward, and 0 `data_sources` residue
- Confirmed cohort isolation: California (36 rows) and Alaska (40 rows) existing ACFR nodes unchanged; Wyoming (un-upgraded NASBO state) still carries exactly its 2 pre-existing NASBO rows, untouched
- Money In auto-enabled on the NE node (6 revenue rows now live, data-driven, no frontend change)
- Recorded the ~1.19x accept-relabel scope divergence (NE's GF is ~91% own-source; federal flows post to a separate Federal Fund column) and the FY2020/FY2022 P2 clamp notes in 120-01-NE-LOADLOG.md

## Task Commits

1. **Task 1: Generate both NE loaders (UNITS=1000) via gen_state.py + download/extract FY2020-2025 + dry-run tie** - `2df24e3` (feat) — completed in prior session
2. **Tasks 2+3: Live-load NE (operating + revenue) + idempotency/0-residue/Money-In/cohort-untouched verification + LOADLOG** - `d74274b` (feat) — combined into one commit since Task 2 alone produces no file diff (matches 119-01/119-02 IA/KS precedent where the live-load commit carries the LOADLOG.md)

**Plan metadata:** (this commit, following) — docs: complete plan

## Files Created/Modified

- `.planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-01-NE-LOADLOG.md` - Full per-FY load disposition, NASBO-replacement confirmation, accept-relabel divergence, clamp notes, idempotency + 0-residue result
- `scripts/processNEAcfr.js` - NE GF operating loader (UNITS=1000, GAAP-labelled, ephemeral data_sources lifecycle) — created in Task 1
- `scripts/processNERevenueAcfr.js` - NE GF revenue loader (UNITS=1000, clampForRender, ephemeral data_sources lifecycle) — created in Task 1
- `_acfr-work/gen_state.py` - `CONFIGS['NE']` entry added — Task 1 (gitignored, not committed to git; loader outputs are the committed artifacts)

## Decisions Made

- NE ACFR GF ~1.19x NASBO GF (smallest divergence in Batch 3) accepted and relabelled honestly rather than treated as a scope anomaly — Nebraska's GF is ~91% own-source revenue (Income Tax + Sales/Use Tax), with federal flows booked to a separate Federal Fund major-fund column not consolidated into General.
- FY2020 "Other Taxes" (-$193K) and FY2022 "Investment Income" (-$191,405K) both routed through the existing P2 clamp mechanism (render at 0, signed value preserved in the category label) as real GAAP-basis adjustments, not extraction artifacts.
- The FY2024 PDF's invalid-UTF-8-byte blank-cell glyph (0xAD soft hyphen) was fixed generically in `extract_gf.py` (`errors='replace'` + recognizing U+FFFD as a dash token) rather than hand-patched only for NE, since this is a reusable fix for any future state whose PDF renders blank GF cells the same way. This was completed in Task 1 (prior session) but is recorded here for completeness since it directly enabled the FY2024 tie confirmed in this session's live load.

## Deviations from Plan

None - plan executed exactly as written. Tasks 2 and 3 were combined into a single commit (rather than two separate atomic commits) because Task 2 alone produces no file diff (it is a pure live-DB-write task); this matches established precedent from Phase 119 (IA/KS: `4ad1dd7`, `1b9343c` — both commits carry the LOADLOG.md that Task 3 produces).

## Issues Encountered

None during Tasks 2-3. The "Loaded 0 rows" console output on both the initial live load and the idempotency re-run is a known, previously-documented RPC reporting artifact (see 119-04-MS-LOADLOG.md) — not a load-vs-no-op discriminator. Verified the actual discriminator (row totals, row `id` continuity, `data_source` labels) via direct DB query instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Nebraska (ACFR-43) is complete: fully ACFR-sourced, GAAP-labelled, idempotent, 0 residue, cohort-isolated. Ready to hand to Phase 124 for independent re-derivation + cohort audit + Chris UAT.
- Batch 3 (Phase 120) continues with NV/NH/NM/ND (ACFR-44..47) in subsequent plans (120-02..120-05).
- No blockers for the remaining Batch 3 states.

---
*Phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47*
*Plan: 01*
*Completed: 2026-07-04*

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: 120-01-NE-LOADLOG.md
- FOUND: 120-01-SUMMARY.md
- FOUND: scripts/processNEAcfr.js
- FOUND: scripts/processNERevenueAcfr.js
- FOUND: commit 2df24e3 (Task 1)
- FOUND: commit d74274b (Tasks 2-3)
