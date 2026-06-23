---
phase: 80-city-county-loads
plan: 01
subsystem: data-loaders
tags: [exceljs, virginia, apa, budget-tree, supabase, idempotent]

requires:
  - phase: 79-va-apa-source-loader
    provides: loadVAComparativeReport.js (exceljs parser + RPC write path + never-overwrite guard)
provides:
  - Section-aware locality lookup (homonym-safe city/county/town resolution)
  - importLocality shared write helper (display-name vs match-name decoupling)
  - loadVAComparativeReportBatch.js — roster enumeration + city/county load loop
  - Absent-locality handling (chronic late-filers ship zero data → skipped, not $0)
affects: [80-02, 81-towns-linking, 82-enrichment, 83-verification]

tech-stack:
  added: []
  patterns:
    - "Section-scoped exhibit lookup by No.-column reset (uniform across all exhibits)"
    - "Batch driver loops the proven single-locality builders; tooling stays one write path"

key-files:
  created:
    - scripts/loadVAComparativeReportBatch.js
  modified:
    - scripts/loadVAComparativeReport.js
    - scripts/loadVAComparativeReport.test.mjs

key-decisions:
  - "Segment the roster by the 'No.' column resetting to 1, not by 'Total' rows (Exhibit H has none)"
  - "Counties stored '<name> County' / entity_type=county; cities bare / entity_type=city (CA precedent)"
  - "Localities with zero data in a FY report (chronic late-filers) are skipped as 'absent', never written as $0"

patterns-established:
  - "findLocalityRowInSection(ws, hdr, name, sectionIndex) — homonym safety for any exhibit"
  - "importLocality(supabase, wb, opts) — the unit the batch driver loops; dryRun returns a summary"

requirements-completed: [VALOAD-04]

duration: ~45min
completed: 2026-06-22
---

# Phase 80 Plan 01: Batch-Load Tooling Summary

**Section-aware VA loader + batch driver that iterates all 38 cities and 95 counties over the report roster, homonym-safe and idempotent — dry-run proven, no live writes.**

## Performance
- **Duration:** ~45 min (inline, no subagents — per feedback_no_research_subagents, $0 Anthropic)
- **Completed:** 2026-06-22
- **Tasks:** 4 (section-aware lookup, importLocality, batch driver, tests)
- **Files modified:** 3 (1 created)

## Accomplishments
- **Homonym safety (the core risk):** `findLocalityRowInSection` scopes lookups to a report section (Cities §0 / Counties §1 / Towns §2) by detecting the "No." column reset to 1. Fairfax/Franklin/Richmond/Roanoke now resolve to the correct city *or* county. Verified: Fairfax city $187M (pop 23,750) ≠ Fairfax County $6.67B (pop 1,139,398).
- **Batch driver** (`loadVAComparativeReportBatch.js`): `enumerateRoster` segments Exhibit C into 38 cities / 95 counties / 37 towns; the load loop builds the work list (counties → "<name> County" / entity_type=county) and calls `importLocality`. CLI: `--file --fy --entity-type --limit --dry-run`; source_url auto-resolves from `vaApaDatasets.json`.
- **Phase 79 loader unchanged for existing callers:** `sectionIndex` is optional (null = global first-match). Single-locality CLI still reproduces Alexandria FY2024 $863,578,347 / $874,230,660 / pop 158,591.
- **Robustness for real-world data:** uncached "Total" formula → falls back to summing function nodes (empty locality = 0, not NaN); `localityPopulation` returns null when a locality is absent from Exhibit H.
- **12/12 offline tests pass** (7 Phase 79 + 5 new: roster counts, homonym divergence, section scoping, absent=0, backward-compat).

## Task Commits
1. **Tasks 1-4 (section-aware lookup + importLocality + batch driver + tests)** — `ddc1eac` (feat)

(Inline execution — the four tightly-coupled tasks committed as one cohesive unit; tests gate the whole.)

## Files Created/Modified
- `scripts/loadVAComparativeReportBatch.js` — roster enumeration + city/county batch loop (NEW)
- `scripts/loadVAComparativeReport.js` — section-aware builders, `importLocality`, total/pop robustness, new exports
- `scripts/loadVAComparativeReport.test.mjs` — +5 Phase 80 tests

## Decisions Made
- **Segment by No.-reset, not "Total" rows** — Exhibit H has no Total delimiters; No.-reset is uniform across all exhibits. "Total"/"Grand Total" summary rows carry a numeric col-1 (the section count) so they're excluded by name.
- **County display name = "<name> County"** (CA `loadCountyBudget.js` precedent) — required to disambiguate the 4 city/county homonyms.
- **Absent late-filers skipped, not written as $0** — see Issues below.

## Deviations from Plan
None to the plan's structure — but execution surfaced a **major source-data reality** (below) that shapes Plan 80-02.

## Issues Encountered
- **~Localities ship with zero data in the published XLSX (chronic late-filers).** Verified at the raw-XML level (`<v>0</v>` on disk, not an exceljs bug): the FY report lists every locality but a subset have blank/zero figures because their audited financials hadn't reached the APA at publication. Coverage of the 133 cities+counties:
  - **FY2024:** 110 with data, 23 absent
  - **FY2023:** 117 with data, 16 absent
  - **Data in BOTH years:** 105 · **only FY2024:** 5 · **only FY2023:** 12
  - **Absent in BOTH years (11):** cities Colonial Heights, Emporia, Hopewell, Norton; counties Accomack, Buckingham, Lee, Pulaski, Scott, Warren, Westmoreland.
  - Handled by skipping absent localities cleanly (status `absent`, no $0 row, no phantom municipality). **This means VALOAD-01/02 will load 122 of 133 localities (each for the year(s) it reported); the 11 perennial late-filers are a documented source gap.** Surfaced to Chris before the live load (Plan 80-02).
- **Covington / Alleghany** present in the expenditure exhibits but missing from Exhibit H (FY2024 school-consolidation footnote) — `localityPopulation` now returns null instead of aborting the load.

## Next Phase Readiness
- Tooling is proven by dry-run on both FY2024 and FY2023. Plan 80-02 acquires both XLSX (done — in `_va-recon/`), runs the live load, and verifies.
- **Decision needed from Chris before 80-02 live writes:** accept the 122/133 coverage + document the 11 absent late-filers as a known gap (recommended), vs. chase amended-report files for the late-filers (scope creep).

---
*Phase: 80-city-county-loads*
*Completed: 2026-06-22*
