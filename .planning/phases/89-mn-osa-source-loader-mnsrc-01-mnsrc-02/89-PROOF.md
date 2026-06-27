# Phase 89 — MN OSA Loader De-Risk Proof (prove-before-bulk gate)

**Date:** 2026-06-27
**Loader:** `scripts/loadMNOSA.js` | **Tree-map:** `scripts/mnOsaTreeMap.json` | **Manifest:** `scripts/mnOsaDatasets.json`
**Method:** `--dry-run` (zero DB writes). Pass criterion = the parsed 3-level tree sum **ties to the entity row's own `Total Revenues` / `Total Expenditures`** column (self-consistency), trees well-formed, basis/population/parent/source_url resolve.

## The three proofs

| # | Entity | FY | Type | Basis (GAAPInd) | Parent | Population | Revenue: tree=Total | Expenditure: tree=Total | source_url |
|---|---|---|---|---|---|---|---|---|---|
| 1 (D-06 headline) | **Minneapolis** | 2023 | city | GAAP | Hennepin | 433,633 | **$1,192,133,233 = $1,192,133,233** ✓ | **$1,193,970,288 = $1,193,970,288** ✓ | `cired_23_data.xlsx` |
| 2 (D-07 basis path) | **Ada** | 2023 | city | **Cash** | Norman | 1,725 | $2,281,736 = $2,281,736 ✓ | $2,966,174 = $2,966,174 ✓ | `cired_23_data.xlsx` |
| 3 (D-08 county path) | **Aitkin** | 2021 | county | none (no GAAPInd col) | — (no parent) | 16,002 | $36,720,288 = $36,720,288 ✓ | $38,425,573 = $38,425,573 ✓ | `county_21_-data.xlsx` |

All three tie with **drift = 0** (exact). Cross-checks (Adams city Cash $1,153,656/$1,196,541; Anoka county $369,021,022/$338,553,843) also tie exactly. No D-03 double-count guard tripped on any entity.

## What each proof de-risks
- **Minneapolis (D-06):** the headline RCV anchor + biggest MN city. 3-level revenue (Intergovernmental → Federal/State/County-Local → grant types) and 3-level expenditure (function → sub-function → Current/Capital) both reconcile to the workbook's own totals — the prove-before-bulk gate for the milestone. Pre-stages Phase 93 ACFR reconciliation.
- **Ada (D-07):** Cash-basis (`GAAPInd='Cash'`) city parses through the SAME builders; basis correctly read from the per-row flag — de-risks the Phase 90 bulk's Cash entities.
- **Aitkin (D-08):** county file (divergent layout — no GAAPInd, no ParentEntityName, shifted columns, label typos) parses through the SAME builders and ties to its own row totals — the Ohio county-layout defect is foreclosed. `--entity-type county` resolves the county source URL from the manifest.

## Pinned availability (from `scripts/mnOsaDatasets.json`)
- **City actuals:** XLSX **FY2012–FY2023** (continuous). Floor 2012; pre-2012 = ZIP/CSV (out of scope).
- **County actuals:** XLSX **FY2013–2017 + FY2019–2021** (gaps at 2012/2018; FY2022–2023 reports only; FY2006–2011 legacy `.xls` not exceljs-readable). **County data lags cities — latest county = FY2021.**
- County file naming shifts `cored_<YY>` (≤2017) → `county_<YY>` (≥2019); `county_21` url filename is `county_21_-data.xlsx`.

## County-vs-city layout divergences (D-08, caught here — not mid-bulk)
No `GAAPInd`, no `ParentEntityName`, no `GovEntityID`/`ClassCode`; financial columns shifted (start col 8 vs 12); extra `WheelageTax` / `Current Expend 1` / `Total Capital Outaly1`; label typos (`Conservation ofNatural`, vs city `Ecenomic`). Mitigation: label-normalized matching + one alias; identity reads tolerate absent columns. Full table in `89-01-SUMMARY.md`.

## Guarantees verified
- **Idempotent never-overwrite guard** present (`findConflictingBudget`) before every `treasury_sync_city_budget` call.
- **Offline unit tests:** `node --test scripts/loadMNOSA.test.mjs` → 11/11 pass (no regression after proof).
- **Zero DB writes** this phase (all dry-run). Bulk load is Phase 90 (cities) / Phase 91 (counties).

## Handoff to Phase 90/91
- Phase 90 iterates `loadMNOSA.js` over all ~853 cities across FY2012–2023 (incl. Cash-basis); per-capita from `Population`; basis tracked per-entity (MNCITY-02).
- Phase 91 loads counties FY2013–2021 (`--entity-type county`), adds the MN state node + city→county linking via `ParentEntityName` (note: counties have no GAAPInd → basis recorded as null/unknown).
