---
phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47
plan: "03"
subsystem: database
tags: [acfr, nasbo-retirement, state-acfr, gaap, treasury-budgets, supabase, new-hampshire, wayback-machine]

requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: NH source recon (Akamai-block finding, Wayback-mirror-proxy fetch requirement, 3-era filename map, GENERAL column identification, bookend ties)
  - phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47 (120-01, 120-02)
    provides: gen_state.py / extract_gf.py / build_state.py v2.14+ tooling lineage, LOAD-01 ephemeral data_sources pattern, units config option (120-02)
provides:
  - New Hampshire state node upgraded NASBO -> State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function), FY2017-FY2024 (full 8yr recon window), zero honest holes
  - Wayback Machine mirror fetch pattern (CDX API timestamp resolution + web.archive.org/web/{ts}if_/{original} proxy URL) as durable source_url for an Akamai-blocked state host — reusable for any future edge-blocked state
affects: [120-04-nm, 120-05-nd, 123-nasbo-retirement, 124-verification-cohort-audit-uat]

tech-stack:
  added: []
  patterns:
    - "gen_state.py CONFIGS['NH'] explicit per-FY Wayback-mirror SOURCES map (thousands, UNITS=1000 default)"
    - "Wayback CDX API (web.archive.org/cdx/search/cdx?url=...&output=json&filter=statuscode:200) resolves a durable archived-snapshot timestamp per year when the origin host Akamai-blocks automated fetch"
    - "_acfr-work/build_state.py job-manifest driver (download+pdftotext+extract_gf+tie-gate+assemble) reused unmodified with Wayback URLs as the per-year 'urls' values"

key-files:
  created:
    - .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-03-NH-LOADLOG.md
  modified:
    - scripts/processNHAcfr.js
    - scripts/processNHRevenueAcfr.js
    - _acfr-work/gen_state.py

key-decisions:
  - "NH ACFR GF ~3.22x NASBO GF (widest divergence in Batch 3) accepted and relabelled honestly — NH's GAAP General Fund consolidates 'Federal Government' (48% of GF revenue) and 'Special Taxes' (Medicaid Enhancement Tax + business taxes, NH has no broad sales/income tax) directly into the General column, the TX-trap mechanism"
  - "Fetched all 8 ACFR PDFs via the Wayback Machine mirror (web.archive.org/web/{ts}if_/{original}) rather than a browser-download step — das.nh.gov/www.das.nh.gov/www.nh.gov all Akamai-block automated curl/fetch (harder than the tn.gov precedent); the Wayback if_ URL is itself a stable, durable, re-fetchable source_url, so no synthetic host needed to appear in the citation trail"
  - "Loaded the full FY2017-FY2024 target window with zero honest holes — all 8 years tied exactly on the first extraction pass via build_state.py, no interior gaps, no wrapped-label or dual-subsection complications"
  - "No gen_state.py generalization needed for NH beyond the existing sources-dict + units-default mechanisms (120-02's units option, unused here since NH is thousands like most states) — the explicit Wayback URL map slotted directly into the existing 'opaque per-year URL' CONFIGS shape"

requirements-completed: [ACFR-45]

duration: ~45min
completed: 2026-07-04
---

# Phase 120 Plan 03: New Hampshire ACFR Upgrade (ACFR-45) Summary

**New Hampshire state node upgraded NASBO->State-ACFR GAAP: GF revenue-by-source + GAAP spending-by-function live for the full FY2017-2024 window, fetched via the Wayback Machine mirror to defeat an Akamai edge-block, ~3.22x TX-trap divergence recorded.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-04
- **Tasks:** 3/3
- **Files modified:** 3 (2 loader scripts created via gen_state.py, 1 LOADLOG created); gen_state.py itself modified (gitignored, not committed)

## Accomplishments

- Resolved a Wayback Machine archived-snapshot timestamp for each of NH's 8 target fiscal years via the CDX API (`web.archive.org/cdx/search/cdx?url=...&output=json&filter=statuscode:200`), covering all 3 filename eras (pre-rename "comprehensive annual" word order FY2017-2020, standard FY2021/2022/2024, `_acfr`-suffix exception FY2023) — never guessed, each resolved individually.
- Downloaded all 8 NH ACFR PDFs via the Wayback mirror (`web.archive.org/web/{timestamp}if_/{original-das.nh.gov-url}`) using the existing `_acfr-work/build_state.py` driver unmodified — every file verified as a real PDF (%PDF magic, 4.9MB-12.6MB, well over the 500KB soft-404 threshold). Direct `das.nh.gov`/`www.das.nh.gov`/`www.nh.gov` fetch was never attempted for the load itself, per the recon's Akamai-block finding.
- `pdftotext -table` + `extract_gf.py` extraction tied all 8 years exactly on the first pass — zero honest holes, assembled into `_acfr-work/nh/nh_all.json`. Bookends confirmed exact: FY2024 revenue $6,377,159K, FY2017 revenue $4,207,160K ($0 diff on both revenues and expenditures, all 8 years).
- Added `gen_state.py CONFIGS['NH']` (explicit per-FY Wayback-URL SOURCES map, UNITS=1000 default, no `rev_boundary` needed) and generated `scripts/processNHAcfr.js` + `scripts/processNHRevenueAcfr.js`; both loaders dry-run-tied all 8 years with no "sum ≠ total" errors.
- Live-loaded New Hampshire General Fund operating (GAAP spending-by-function) and revenue (GAAP revenue-by-source) for all 8 target fiscal years FY2017-FY2024, 16 rows total, every year tying exactly to the printed GENERAL FUND column totals, stored ×1,000 (UNITS=1000).
- Replaced both the FY2023 NASBO operating row ($2,136,000,000) and the FY2024 NASBO operating row ($1,981,000,000) in place with ACFR GAAP totals ($6,414,896,000 / $6,492,697,000) — same row `id`s before/after, confirming UPDATE not insert+delete. Zero "NASBO" labels remain anywhere on the NH node.
- Proved idempotent never-overwrite: a second live run of NH `--fy 2024` (both loaders) reported "Loaded 0 rows" with identical row ids/totals afterward, and 0 `data_sources` residue.
- Confirmed cohort isolation: California and Alaska (existing ACFR nodes) unchanged; West Virginia (un-upgraded NASBO state) still carries exactly its 2 pre-existing NASBO rows, untouched.
- Money In auto-enabled on the NH node (8 revenue rows now live, data-driven, no frontend change).
- Recorded the ~3.22x accept-relabel scope divergence and the Wayback-fetch mechanism note in `120-03-NH-LOADLOG.md`.

## Task Commits

1. **Task 1: Generate both NH loaders (UNITS=1000, 3-era Wayback SOURCES map) via gen_state.py + Wayback-fetch/extract FY2017-2024 + dry-run tie** - `f13670f` (feat)
2. **Tasks 2+3: Live-load NH (operating + revenue) + idempotency/0-residue/Money-In/cohort-untouched verification + LOADLOG** - `3ae6ea6` (feat) — combined into one commit since Task 2 alone produces no file diff (matches 120-01/120-02 precedent where the live-load commit carries the LOADLOG.md)

**Plan metadata:** (this commit, following) — docs: complete plan

## Files Created/Modified

- `.planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-03-NH-LOADLOG.md` - Full per-FY load disposition, Akamai-block/Wayback-proxy fetch note, NASBO-replacement confirmation, accept-relabel divergence, idempotency + 0-residue result
- `scripts/processNHAcfr.js` - NH GF operating loader (UNITS=1000, GAAP-labelled, ephemeral data_sources lifecycle, Wayback source_urls) — created in Task 1
- `scripts/processNHRevenueAcfr.js` - NH GF revenue loader (UNITS=1000, clampForRender, ephemeral data_sources lifecycle, Wayback source_urls) — created in Task 1
- `_acfr-work/gen_state.py` - `CONFIGS['NH']` entry added (explicit per-FY Wayback-mirror SOURCES map, 3-era filename documentation in head_note) — Task 1 (gitignored, not committed to git; loader outputs are the committed artifacts)

## Decisions Made

- NH ACFR GF ~3.22x NASBO GF (widest divergence in Batch 3, TX-trap mechanism) accepted and relabelled honestly rather than treated as a scope anomaly — New Hampshire's GAAP General Fund consolidates "Federal Government" ($3,065,572K = 48% of FY2024 GF revenue) and "Special Taxes" ($1,792,670K, Medicaid Enhancement Tax + business taxes — NH has no broad sales or income tax) directly into the General column.
- Fetched all 8 PDFs via the Wayback Machine mirror rather than implementing a browser-download step — `das.nh.gov`/`www.das.nh.gov`/`www.nh.gov` all return HTTP 403 (Akamai `errors.edgesuite.net`) to every automated fetch variant, a harder block than the `tn.gov` precedent where header-spoofing sufficed. The Wayback `if_` URL format is itself a stable, durable, re-fetchable proxy — chosen as the lower-effort path per the plan's own guidance, and it doubles as an honest `source_url` (points at the real archived original, not a synthetic host).
- Loaded the full FY2017-FY2024 target window with zero honest holes — all 8 years tied exactly to their printed GENERAL FUND totals on the first extraction pass via the unmodified `build_state.py` driver, no interior gaps, no wrapped-label or dual-subsection complications (NH's revenue lines carry no sub-heading at all; expenditures carry a single uniform "Current" subsection).
- No `gen_state.py` generalization was needed beyond what already existed (the `sources` dict shape and the `units` default introduced in 120-02) — NH's explicit Wayback-URL map slotted directly into the existing "opaque per-year URL" CONFIGS pattern with UNITS defaulting to 1000 (thousands), matching most of the cohort.

## Deviations from Plan

None — plan executed exactly as written. The Wayback-fetch mechanism (CDX API timestamp resolution + `if_`-modifier mirror URLs) was the plan's own explicitly anticipated deviation from the standard direct-fetch loader pattern, not an unplanned discovery; no additional Rule 1/2/3/4 fixes were required.

## Issues Encountered

One JS block-comment syntax bug was caught and fixed during Task 1 before any commit: the first-draft `head_note` docstring in `gen_state.py CONFIGS['NH']` contained the literal token sequence `*/` inside a prose description of HTTP header names (`sec-fetch-*/Referer`), which prematurely closed the generated loader's opening JSDoc block comment and produced a Node.js `SyntaxError` on `node scripts/processNHAcfr.js --dry-run`. Fixed by rewording the sentence to avoid the `*/` sequence, regenerated both loaders, and re-verified all 8 years dry-run-tie cleanly — caught before any live write, no impact on the shipped loaders or the plan's scope (Rule 1 — bug in in-progress authoring, not a plan deviation).

The "Loaded 0 rows" console output on both the initial live load and the idempotency re-run is a known, previously-documented RPC reporting artifact (see 119-04-MS-LOADLOG.md / 120-01-NE-LOADLOG.md / 120-02-NV-LOADLOG.md) — not a load-vs-no-op discriminator. Verified the actual discriminator (row totals, row `id` continuity, `data_source` labels) via direct DB query instead. `mcp__supabase-local` tools were not present in this environment's toolset; DB verification was performed via small ad-hoc `@supabase/supabase-js` scripts, deleted before the final commit, leaving the working tree clean (per the plan's efficiency note, matching the 120-01/120-02 precedent).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- New Hampshire (ACFR-45) is complete: fully ACFR-sourced for the full FY2017-2024 window, GAAP-labelled, idempotent, 0 residue, cohort-isolated. Ready to hand to Phase 124 for independent re-derivation + cohort audit + Chris UAT.
- Batch 3 (Phase 120) continues with NM/ND (ACFR-46/47) in subsequent plans (120-04/120-05). The Wayback-mirror-proxy fetch pattern established here (CDX timestamp resolution + `if_`-modifier URLs, reusing `build_state.py` unmodified) is directly reusable for any future Akamai/CDN-edge-blocked state host.
- No blockers for the remaining Batch 3 states.

---
*Phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47*
*Plan: 03*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: scripts/processNHAcfr.js
- FOUND: scripts/processNHRevenueAcfr.js
- FOUND: .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-03-NH-LOADLOG.md
- FOUND: .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-03-SUMMARY.md
- FOUND commit: f13670f (Task 1)
- FOUND commit: 3ae6ea6 (Tasks 2+3)
