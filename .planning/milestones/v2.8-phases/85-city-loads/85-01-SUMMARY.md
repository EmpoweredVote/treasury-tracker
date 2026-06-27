---
phase: 85-city-loads
plan: "01"
subsystem: ohio-loader
tags: [ohio, batch-loader, dry-run, enumerateCities, GAAP, CASH, MOD, basis-assignment]
dependency_graph:
  requires:
    - "Phase 84: scripts/loadOhioAOS.js (detectLayout, importCity, resolveSourceUrl, getSupabase)"
    - "Phase 84: scripts/ohioAosDatasets.json (FY2016-2025 x GAAP/CASH/MOD manifest)"
  provides:
    - "enumerateCities(workbook) export on loadOhioAOS.js (layout-aware)"
    - "scripts/loadOhioAOSBatch.js — GAAP→CASH→MOD per-city basis-assignment + roster loop + dry-run"
  affects:
    - "Phase 85-02: live FY2016-2025 sweep uses loadOhioAOSBatch as its primary driver"
tech_stack:
  added: []
  patterns:
    - "enumerateCities: detectLayout()-driven row walk (revTotalCol/expTotalCol guard skips blank/footer rows)"
    - "GAAP→CASH→MOD Map-based assignment: first basis whose workbook contains the city wins"
    - "demographics-only residual: union(OI_Demographics rosters) minus financial-tab union"
    - "never-abort per-city try/catch: failures collected without stopping the roster loop"
    - "dry-run: dryRun:true into importCity, getSupabase() never called"
key_files:
  created:
    - scripts/loadOhioAOSBatch.js
  modified:
    - scripts/loadOhioAOS.js
    - scripts/loadOhioAOS.test.mjs
decisions:
  - "enumerateCities uses revTotalCol OR expTotalCol (either finite) to skip blank/footer rows — handles rows where one total column may be zero or absent"
  - "Residual computed from OI_Demographics rosters (enumerateDemographics helper) minus financial-tab set — no phantom municipalities ever created"
  - "Batch driver downloads missing workbooks from manifest via curl execSync with 120s timeout; acquisition errors skip basis without aborting"
  - "MOD workbook downloaded on first dry-run (not pre-cached); _oh-recon/ gitignored"
metrics:
  duration: "~40 minutes"
  completed: "2026-06-25"
  tasks: 3
  files: 3
---

# Phase 85 Plan 01: Ohio AOS Batch Tooling (enumerateCities + Batch Driver) Summary

Batch loader tooling built and proven via dry-run: layout-aware city-enumeration helper added to the Phase 84 single-city loader; batch driver opens GAAP + CASH + MOD all-cities workbooks for one FY, assigns each city its best-available basis (GAAP→CASH→MOD), and iterates the Phase 84 `importCity` write path over the whole roster. FY2024 dry-run processes 245 cities (235 GAAP + 7 CASH + 3 MOD), zero writes, zero failures. No DB writes occur in this plan.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add `enumerateCities(workbook)` to `loadOhioAOS.js` + offline tests | a20daf8 | loadOhioAOS.js, loadOhioAOS.test.mjs |
| 2 | Build batch driver `scripts/loadOhioAOSBatch.js` (assignment + loop + acquisition + residual + flags) | 655a296 | loadOhioAOSBatch.js |
| 3 | FY2024 dry-run proof + basis-fallback assertion test | 13ad53a | loadOhioAOS.test.mjs |

## Verification

All verification criteria met:

- `node --test scripts/loadOhioAOS.test.mjs` — 19/19 pass (16 Phase 84 cases + 2 enumerateCities cases + 1 batch dry-run/fallback case)
- `node scripts/loadOhioAOSBatch.js --fy 2024 --file-gaap ... --file-cash ... --dry-run` — 245 cities processed, Columbus=GAAP, 7 CASH assignments (fallback proven), 3 MOD assignments (downloaded from manifest), residual=0, failures=0, zero writes
- `enumerateCities` export confirmed via `node -e "import('./scripts/loadOhioAOS.js').then(m=>console.log(typeof m.enumerateCities))"` → `function`
- `loadOhioAOSBatch` export confirmed → `function`
- All Phase 84 exports unchanged (no regression)

### FY2024 Dry-Run Counts

| Basis | Cities |
|-------|--------|
| GAAP  | 235    |
| CASH  | 7      |
| MOD   | 3      |
| **Total** | **245** |

Residual (demographics-only, no financial tab): 0 for FY2024.

## Deviations from Plan

### Auto-downloaded MOD workbook during dry-run

The MOD workbook (`City_2024_MOD_Summarized.XLSX`) was not pre-cached in `_oh-recon/` (only GAAP + CASH were from Phase 84). The batch driver's acquisition logic downloaded it automatically from the manifest URL during the Task 3 dry-run. This is the intended D-04 behavior (not a deviation) — it correctly exercises the download path. The file stays gitignored in `_oh-recon/`.

### MOD cities have negative operating totals

Three MOD cities (Germantown, Huber Heights, Ironton) return negative operating totals from the SORDACIFB workbook (e.g., Huber Heights: −$35,461,443). These are valid source figures from the modified-basis workbook — the batch driver passes them through `importCity` without modification, as the plan requires reusing the Phase 84 write path verbatim. This is not a data error; MOD-basis accounting can produce negative fund totals when expenditures exceed revenues. MOD cities also have no OI_Demographics population (pop=—) in FY2024, which is expected (the CASH/MOD workbooks have fewer demographics entries).

No other deviations — plan executed as written.

## Known Stubs

None. This plan is dry-run only (no DB writes). The live FY2016–2025 sweep and committed residual file (`scripts/ohioCityResidual.json`) are plan 85-02.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The batch driver uses the same `getSupabase()` + `treasury_sync_city_budget` RPC write path as Phase 84 (already in the threat model). The acquisition step downloads from `ohioauditor.gov` (the manifest-stamped source) via `curl` — same domain as Phase 84.

## Self-Check: PASSED

- `scripts/loadOhioAOSBatch.js` exists: FOUND
- `scripts/loadOhioAOS.js` has `enumerateCities` export: FOUND (confirmed function)
- `scripts/loadOhioAOS.test.mjs` has 19 passing tests: CONFIRMED
- Commits a20daf8, 655a296, 13ad53a all exist in git log: FOUND
