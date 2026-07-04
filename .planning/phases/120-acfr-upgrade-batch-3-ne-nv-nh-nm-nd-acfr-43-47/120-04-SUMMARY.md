---
phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47
plan: "04"
subsystem: database
tags: [acfr, nasbo-retirement, state-acfr, gaap, treasury-budgets, supabase, new-mexico, wayback-cdx, embedded-data, p2-clamp]

requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: NM source recon (opaque WordPress-slug URLs for FY2019/2022/2024, FY2022 image-only finding + hand-verified figures, FY2023 gap-log, bookend ties)
  - phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47 (120-01, 120-02, 120-03)
    provides: gen_state.py / extract_gf.py v2.14+ tooling lineage, LOAD-01 ephemeral data_sources pattern
provides:
  - New Mexico state node upgraded NASBO -> State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function), FY2019/FY2022/FY2023/FY2024 (4yr; FY2020/FY2021 honest-gapped)
  - FY2023 URL discovered live via Wayback CDX directory-listing crawl (nmdfa.state.nm.us/wp-content/uploads/2024/*) — reusable pattern for any future opaque-slug state where the landing page itself doesn't link the current ACFR
  - FY2022 embedded-data precedent extended: hand-transcribed directly from a Phase-117-rendered PNG of the raster-image statement page (not re-run through automated pdftotext), independently re-summed to confirm the recon's hand-verification
affects: [120-05-nd, 123-nasbo-retirement, 124-verification-cohort-audit-uat]

tech-stack:
  added: []
  patterns:
    - "gen_state.py CONFIGS['NM'] explicit per-FY opaque-WordPress-slug SOURCES map (thousands, UNITS=1000 default)"
    - "Wayback CDX directory-listing crawl (cdx?url=host/path/YYYY*&output=json&filter=urlkey:...) used to discover an unlinked current-year PDF filename when the state's own landing page doesn't link it — distinct from NH's CDX-timestamp-of-a-known-URL usage; here CDX enumerates unknown filenames under a known upload-date folder"
    - "FY2022 embedded-data image-only precedent (NJ Phase 115 lineage) extended to a case where the source images were already rendered by an earlier recon phase — re-transcription served as an independent second check against the recon's own hand-verification, both landing on identical figures"

key-files:
  created:
    - .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-04-NM-LOADLOG.md
  modified:
    - scripts/processNMAcfr.js
    - scripts/processNMRevenueAcfr.js
    - _acfr-work/gen_state.py

key-decisions:
  - "NM ACFR GF ~3.06x NASBO GF accepted and relabelled honestly — two consolidation drivers land in the same GENERAL FUND column: 'Federal Revenue' (38% of GF revenue, the standard TX-trap federal-passthrough mechanism) PLUS 'Rentals and Royalties' (oil & gas, $5,353,926K FY2024) — a substantial OWN-SOURCE severance/royalty stream, NM's own distinguishing driver vs NV/NH's purely-federal divergence in this same batch"
  - "FY2020/FY2021 left as an honest gap rather than force-loading a wrong document — a bounded Wayback CDX search of the 2020/2021/2022 uploads directories found only DFA's own single-agency 'Financial Statements FY20/FY21' filings (agency code 341, no '-A' statewide-component-unit suffix), a narrower and different document than the statewide '341-A'/'SoNM' ACFR used for every loaded year. Matches the recon's original 3-year enumeration; not pursued further (NE/KS effort-bound precedent in this same tranche)"
  - "FY2022's raster-image statement page hand-transcribed directly from the already-rendered PNGs left over from Phase 117 recon, rather than re-rendering or attempting any new OCR pass — independently re-summed both the 9-item revenue tree and 12-item expenditure tree to $0 diff against the printed totals, serving as an unplanned second verification of the recon's own hand-transcription (both landed on identical figures)"
  - "FY2023's opaque filename discovered via a live Wayback CDX directory-listing crawl of nmdfa.state.nm.us/wp-content/uploads/2024/* rather than guessing a slug variant — found FINAL-341-A-State-of-New-Mexico-FY-2023-FS-5-15-2024.pdf on the first crawl, confirmed live and extracted cleanly with zero embedded-data fallback needed"

requirements-completed: [ACFR-46]

duration: ~40min
completed: 2026-07-04
---

# Phase 120 Plan 04: New Mexico ACFR Upgrade (ACFR-46) Summary

**New Mexico state node upgraded NASBO->State-ACFR GAAP: GF revenue-by-source + GAAP spending-by-function live for FY2019/2022/2023/2024, FY2022 hand-transcribed from a raster-image statement page, FY2023 discovered live via a Wayback CDX crawl, ~3.06x federal+royalty accept-relabel divergence recorded.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-04
- **Tasks:** 3/3
- **Files modified:** 3 (2 loader scripts created via gen_state.py, 1 LOADLOG created); gen_state.py itself modified (gitignored, not committed)

## Accomplishments

- Confirmed the 3 opaque WordPress-slug URLs from Phase 117 recon (FY2019/2022/2024) as real, live PDFs (%PDF magic, well over the soft-404 threshold) and re-extracted FY2019/FY2024 via `pdftotext -table` + `extract_gf.py` — both bookends tied exactly on the first pass ($30,530,269K FY2024 / $15,358,087K FY2019, $0 diff on both revenues and expenditures).
- Confirmed FY2022's Statement of Revenues, Expenditures, and Changes in Fund Balances renders as a raster image (`extract_gf.py` correctly reported "statement not found" rather than mis-transcribing a blank row). Hand-transcribed the GENERAL FUND column directly from Phase 117's already-rendered page PNGs (`_acfr-work/nm/nm_2022_hires-048.png`/`-049.png`) and independently re-summed both trees to $0 diff — landing on the identical figures the recon had already hand-verified ($26,161,736K revenues / $20,159,689K expenditures), an unplanned second-check confirmation.
- Discovered the FY2023 URL live via a Wayback CDX directory-listing crawl of `nmdfa.state.nm.us/wp-content/uploads/2024/*` (the landing/reports pages themselves don't link the ACFR, matching the recon's finding) — found `FINAL-341-A-State-of-New-Mexico-FY-2023-FS-5-15-2024.pdf`, confirmed live, and extracted cleanly on the first pass ($30,260,179K revenues / $22,181,074K expenditures, $0 diff both sides).
- Searched for FY2020/FY2021 under the same CDX approach and found only narrower single-agency DFA-341 filings (not the statewide "341-A" ACFR) — honestly gapped both years rather than substitute the wrong document.
- Added `gen_state.py CONFIGS['NM']` (opaque per-FY SOURCES map, UNITS=1000, FY2022 embedded-data note, FY2023 discovery note, ~3.06x two-driver scope note) and generated `scripts/processNMAcfr.js` + `scripts/processNMRevenueAcfr.js`; both loaders dry-run-tied all 4 years with no "sum ≠ total" errors, and the FY2022 dry-run confirmed the P2 clamp renders "Investment Income (Loss)" (-$91,222K) at 0 while the parent total stays exact.
- Live-loaded New Mexico General Fund operating (GAAP spending-by-function) and revenue (GAAP revenue-by-source) for all 4 fiscal years, 8 rows total, every year tying exactly to the printed GENERAL FUND column totals, stored ×1,000 (UNITS=1000).
- Replaced both the FY2023 NASBO operating row ($8,682,000,000) and the FY2024 NASBO operating row ($9,975,000,000) in place with ACFR GAAP totals ($22,181,074,000 / $23,955,264,000) — same row `id`s before/after, confirming UPDATE not insert+delete. Zero "NASBO" labels remain anywhere on the NM node.
- Proved idempotent never-overwrite: a second live run of NM `--fy 2024` (both loaders) reported "Loaded 0 rows" with identical row ids/totals afterward, and 0 `data_sources` residue.
- Confirmed cohort isolation: California and Alaska (existing ACFR nodes) unchanged; North Dakota (the Batch-3 sibling covered by a separate plan, 120-05, not yet loaded) still carries exactly its 2 pre-existing NASBO rows, untouched.
- Money In auto-enabled on the NM node (4 revenue rows now live, data-driven, no frontend change).
- Recorded the ~3.06x accept-relabel scope divergence, the FY2022 embedded-data note, and the FY2023 discovery result in `120-04-NM-LOADLOG.md`.

## Task Commits

1. **Task 1: Generate both NM loaders (UNITS=1000, opaque SOURCES map, FY2022 embedded) via gen_state.py + download/extract + FY2023 live-discovery + dry-run tie** - `99a1b25` (feat)
2. **Tasks 2+3: Live-load NM (operating + revenue) + idempotency/0-residue/Money-In/cohort-untouched verification + LOADLOG** - `0933b7d` (docs) — combined into one commit since Task 2 alone produces no file diff (matches 120-01/120-02/120-03 precedent where the live-load commit carries the LOADLOG.md)

**Plan metadata:** (this commit, following) — docs: complete plan

## Files Created/Modified

- `.planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-04-NM-LOADLOG.md` - Full per-FY load disposition, FY2022 embedded-data note, FY2023 discovery result, FY2020/2021 honest-gap note, NASBO-replacement confirmation, accept-relabel divergence, idempotency + 0-residue result
- `scripts/processNMAcfr.js` - NM GF operating loader (UNITS=1000, GAAP-labelled, ephemeral data_sources lifecycle) — created in Task 1
- `scripts/processNMRevenueAcfr.js` - NM GF revenue loader (UNITS=1000, clampForRender, ephemeral data_sources lifecycle) — created in Task 1
- `_acfr-work/gen_state.py` - `CONFIGS['NM']` entry added (opaque per-FY SOURCES map, FY2022/FY2023/gap documentation in head_note) — Task 1 (gitignored, not committed to git; loader outputs are the committed artifacts)

## Decisions Made

- NM ACFR GF ~3.06x NASBO GF accepted and relabelled honestly with a two-driver note (federal passthrough 38% of GF + own-source oil/gas royalties $5.35B FY2024) rather than treated as a scope anomaly — distinguishes NM's mechanism from NV/NH's purely-federal divergence in the same batch.
- FY2022's raster-image page hand-transcribed from the already-rendered PNGs left by Phase 117 recon, embedded as static data (NJ Phase 115 precedent) rather than any new OCR/re-render attempt — independently re-verified against the recon's own hand-transcription (identical result, both trees sum-tie to $0 diff).
- FY2023's opaque filename resolved via a live Wayback CDX crawl of the known upload-date folder rather than guessing a slug variant off the FY2022/FY2024 naming pattern (which turned out non-derivable — FY2023's filename shares no naming convention with its neighbors).
- FY2020/FY2021 left as an honest gap after a bounded search surfaced only a different, narrower single-agency document under those years — not force-loaded, matching the tranche's effort-bound precedent (NE/KS).

## Deviations from Plan

None — plan executed exactly as written. The FY2023 live-discovery requirement and the FY2022 embedded-data requirement were the plan's own explicitly anticipated deviations from the standard direct-fetch loader pattern, not unplanned discoveries; no additional Rule 1/2/3/4 fixes were required. The FY2020/FY2021 gap search was an extra bounded-effort check beyond what the plan strictly required (which only called out FY2023 for discovery) — performed opportunistically since the CDX approach was already in hand, and it returned a clean honest-gap finding rather than uncovering loadable years.

## Issues Encountered

The "Loaded 0 rows" console output on both the initial live load and the idempotency re-run is a known, previously-documented RPC reporting artifact (see 119-04-MS-LOADLOG.md / 120-01/02/03-LOADLOG.md) — not a load-vs-no-op discriminator. Verified the actual discriminator (row totals, row `id` continuity, `data_source` labels) via direct DB query instead. `mcp__supabase-local` tools were not present in this environment's toolset; DB verification was performed via small ad-hoc `@supabase/supabase-js` scripts run inline (`node -e`), with no scratch files left on disk — working tree confirmed clean before the final commit (per the plan's efficiency note, matching the 120-01/120-02/120-03 precedent).

## Known Stubs

None — no stub patterns introduced. All 8 loaded rows carry real transcribed figures, non-null sources, and GAAP-basis labels.

## Threat Flags

None — all threat-model dispositions (T-120-04-A through T-120-04-I, T-120-04-SC) were mitigated as planned; no new surface introduced beyond what the threat model anticipated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- New Mexico (ACFR-46) is complete: fully ACFR-sourced for FY2019/2022/2023/2024, GAAP-labelled, idempotent, 0 residue, cohort-isolated. FY2020/FY2021 honestly documented as unavailable under the statewide-ACFR naming pattern. Ready to hand to Phase 124 for independent re-derivation + cohort audit + Chris UAT.
- Batch 3 (Phase 120) continues with ND (ACFR-47) in 120-05. The Wayback CDX directory-listing-crawl pattern established here (enumerating unknown filenames under a known upload-date folder, distinct from NH's known-URL-timestamp CDX usage) is directly reusable for any future opaque-slug state whose landing page doesn't link its current ACFR.
- No blockers for the remaining Batch 3 state (ND).

---
*Phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47*
*Plan: 04*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: scripts/processNMAcfr.js
- FOUND: scripts/processNMRevenueAcfr.js
- FOUND: .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-04-NM-LOADLOG.md
- FOUND: .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-04-SUMMARY.md
- FOUND commit: 99a1b25 (Task 1)
- FOUND commit: 0933b7d (Tasks 2+3)
