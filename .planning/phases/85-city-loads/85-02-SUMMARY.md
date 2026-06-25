---
phase: 85-city-loads
plan: "02"
subsystem: ohio-loader
tags: [ohio, live-load, GAAP, CASH, MOD, batch-driver, FY2016-2025, idempotency, residual, per-capita, sourcing]
dependency_graph:
  requires:
    - "Phase 85-01: scripts/loadOhioAOSBatch.js (batch driver, GAAP→CASH→MOD precedence, enumerateCities)"
    - "Phase 84: scripts/loadOhioAOS.js (importCity, detectLayout, resolveSourceUrl, getSupabase)"
    - "Phase 84: scripts/ohioAosDatasets.json (FY2016-2025 x GAAP/CASH/MOD manifest, all 30 URLs HTTP-200)"
  provides:
    - "FY2016-2025 Ohio city budget rows in production: operating + revenue, sourced, per-capita (OHCITY-01)"
    - "scripts/ohioCityResidual.json — committed zero-residual record (no phantom municipalities, OHCITY-02)"
    - "GAAP→CASH→MOD backfill proven live (Delphos/Kenton/Van Wert CASH, Ironton MOD confirmed in production)"
  affects:
    - "Phase 86: county loads depend on the city municipality rows being present for county_id linking"
    - "Phase 87: enrichment phase needs the Ohio vocabulary (category names from loaded trees)"
    - "Phase 88: source-chain audit + UAT will cross-check these rows"
tech_stack:
  added: []
  patterns:
    - "Serial per-FY load: node scripts/loadOhioAOSBatch.js --fy <YYYY> for each of FY2016-2025"
    - "Never-overwrite guard (findConflictingBudget) skips any pre-existing richer-source row"
    - "Zero cross-FY residual: all OI_Demographics cities have at least one financial row across all FY×basis"
    - "Idempotency: second FY2024 run = 0 new municipalities, 0 new budget rows"
key_files:
  created:
    - scripts/ohioCityResidual.json
  modified: []
decisions:
  - "[85-02]: FY2025 workbook is preliminary — 196 GAAP cities vs ~235-244 in 2021-2024; loaded as-is (partial-year audit completion timing, noted in manifest)"
  - "[85-02]: Zero cross-FY residual: all OI_Demographics cities have financial rows in every FY they appear; ohioCityResidual.json cities=[] is the durable record"
  - "[85-02]: Ironton (MOD basis) has population=0 in municipalities table — expected, MOD workbooks lack OI_Demographics population entries (documented in 85-01-SUMMARY)"
metrics:
  duration: "~23 minutes"
  completed: "2026-06-25"
  tasks: 4
  files: 1
---

# Phase 85 Plan 02: Ohio AOS Live Load (FY2016-2025) Summary

Live load of every filing Ohio city — operating + revenue — across FY2016-2025 using the Phase 85-01 batch driver (`loadOhioAOSBatch`), with GAAP primary and CASH/MOD backfill per (city, FY); all 4,880 rows stamped `data_source='Ohio Auditor of State Summarized Annual Financial Reports'` with per-FY+basis `source_url`, zero NULL sourcing, zero failures, idempotency confirmed (second FY2024 run: 0 new municipalities, 0 new budget rows), Columbus FY2024 exact spot-check passes (rev $2.166B, Income Taxes $1.145B, Police $810M), and `scripts/ohioCityResidual.json` committed documenting zero demographics-only phantom cities.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Acquire all FY2016-2025 x {GAAP,CASH,MOD} workbooks into `_oh-recon/` (30 files, all HTTP-200) | — (data only, gitignored) | `_oh-recon/City_<FY>_<BASIS>_Summarized.XLSX` x30 |
| 2 | Full-range dry-run pre-flight FY2016-2025 (zero writes, zero failures, Columbus FY2024 revenue=$2.166B confirmed) | — (no code changes) | — |
| 3 | Live load FY2016-2025 (serial, idempotent, all 10 FY complete, 0 failures) | — (Supabase writes only) | — |
| 4 | In-phase verification (SC#1-4) + write `scripts/ohioCityResidual.json` | 8510769 | scripts/ohioCityResidual.json |

## Per-FY Load Summary

| FY | Total Cities | GAAP | CASH | MOD | Residual | Failures |
|----|-------------|------|------|-----|----------|----------|
| 2016 | 247 | 239 | 7 | 1 | 0 | 0 |
| 2017 | 247 | 240 | 4 | 3 | 0 | 0 |
| 2018 | 247 | 240 | 5 | 2 | 0 | 0 |
| 2019 | 247 | 240 | 5 | 2 | 0 | 0 |
| 2020 | 247 | 240 | 5 | 2 | 0 | 0 |
| 2021 | 253 | 244 | 8 | 1 | 0 | 0 |
| 2022 | 252 | 244 | 6 | 2 | 0 | 0 |
| 2023 | 251 | 241 | 8 | 2 | 0 | 0 |
| 2024 | 245 | 235 | 7 | 3 | 0 | 0 |
| 2025 | 204 | 196 | 6 | 2 | 0 | 0 |
| **Total** | **2,480** | — | — | — | **0** | **0** |

Note: FY2025 has only 196 GAAP cities vs ~235-244 in prior years — the FY2025 workbook is preliminary (audit completion timing). All 204 available cities were loaded.

## Verification Results

### SC#1 — Coverage

- **253 OH city municipalities** in production after load
- **4,880 total OH budget rows** (operating + revenue across FY2016-2025)
- **FY2024**: 490 rows = 245 cities × 2 datasets (exact)
- **0 rows with NULL source_url** — 100% sourced
- **4,880/4,880 rows** with `data_source='Ohio Auditor of State Summarized Annual Financial Reports'`

### SC#2 — Columbus FY2024 Spot-Check (read back from DB)

| Metric | Expected | Stored | Result |
|--------|----------|--------|--------|
| Revenue total | ≈$2.166B | $2,166,549,000 | PASS |
| Income Taxes | ≈$1.145B | $1,144,941,000 | PASS |
| Police (operating) | ≈$810M | $810,082,000 | PASS |
| data_source | Ohio Auditor... | Ohio Auditor... | PASS |
| source_url | GAAP 2024 URL | https://ohioauditor.gov/.../City_2024_GAAP_Summarized.XLSX | PASS |

### SC#2 / D-06 — Per-Capita Population

- **252/253 OH cities** have `population > 0` (per-capita renders)
- 1 city with `population=0`: **Ironton** (MOD basis — MOD workbooks have no OI_Demographics population; documented in 85-01-SUMMARY as expected behavior)

### SC#3 — CASH/MOD Backfill (OHCITY-02)

CASH-basis cities confirmed in production with CASH source_url (FY2016 sample):
- Delphos, Germantown, Kenton, North College Hill, Port Clinton, Struthers, Van Wert — source_url contains `CASH`

MOD-basis city confirmed in production with MOD source_url (FY2016 sample):
- Ironton — source_url contains `MOD`

Mixed basis across years: Germantown = CASH in FY2016-2020 + 2023-2025, MOD in FY2017 — per-city per-FY precedence holds.

### SC#4 — Idempotency Re-Run (FY2024)

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| OH city municipalities | 253 | 253 | **0** |
| Total treasury.budgets rows | 54,811 | 54,811 | **0** |

**Idempotency: PASS** — never-overwrite guard correctly skipped all pre-existing rows.

### D-03 / OHCITY-02 — Source-Gap Residual

- **Zero demographics-only cities** across all FY2016-2025 × GAAP/CASH/MOD
- `scripts/ohioCityResidual.json` committed with `cities: []`
- No phantom municipalities created

## Deviations from Plan

None — plan executed exactly as written.

- Tasks 1 and 2 have no committable file changes (XLSX workbooks are gitignored; no code was changed during pre-flight). Their "commits" are implicit — the live load (Task 3) is the consequential write, and Task 4's `ohioCityResidual.json` is the only committed artifact.
- The plan's mention of `scripts/loadOhioAOSBatch.js` as a `files` target for Tasks 1-3 is correct but does not mean the file was modified — the driver ran unchanged.

## Known Stubs

None. All 4,880 production budget rows are fully loaded with sourced operating + revenue data, non-null source_url, and per-capita population (except Ironton which has population=0 by source-design for MOD-basis cities).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The live load used the same `treasury_sync_city_budget` RPC write path as Phase 84 (already in the threat model). All workbooks downloaded from `ohioauditor.gov` (the manifest-stamped source, same domain as Phase 84). No new tables, no new migrations.

## Self-Check: PASSED

- `scripts/ohioCityResidual.json` exists: FOUND (created + committed 8510769)
- Commit 8510769 in git log: FOUND
- Columbus FY2024 revenue in production = $2,166,549,000 ≈ $2.166B: CONFIRMED
- Columbus FY2024 Income Taxes = $1,144,941,000 ≈ $1.145B: CONFIRMED
- Columbus FY2024 Police = $810,082,000 ≈ $810M: CONFIRMED
- OH budget rows with NULL source_url = 0: CONFIRMED
- OH budget rows = 4,880 all stamped with Ohio Auditor data_source: CONFIRMED
- Idempotency (FY2024 re-run): 0 new municipalities, 0 new budget rows: CONFIRMED
- CASH/MOD backfill cities in production with correct basis source_url: CONFIRMED
