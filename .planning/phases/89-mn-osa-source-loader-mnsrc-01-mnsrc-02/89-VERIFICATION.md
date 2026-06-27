---
phase: 89-mn-osa-source-loader-mnsrc-01-mnsrc-02
verified: 2026-06-27
status: passed
requirements: [MNSRC-01, MNSRC-02]
method: goal-backward (inline; de-risk dry-run gate is the phase verification)
---

# Phase 89 Verification — MN OSA Source + Loader

**Phase goal:** A reusable loader turns the MN OSA `Governmental Funds` sheet into sourced operating
(expenditure-by-function) + revenue (revenue-by-source) trees, for both cities and counties, with
per-entity basis, per-FY manifests, and idempotency.

## Success criteria (ROADMAP) — all PASS

1. **Loader builds revenue-by-source + expenditure-by-function trees with correct subtotal nodes,
   proven on a sample RCV city FY2023 (ties to `Total Revenues`/`Total Expenditures`).**
   ✅ PASS — **exceeds** (3-level-where-natural, not just 2-level). Minneapolis FY2023 dry-run:
   revenue tree sum = `$1,192,133,233` = row Total Revenues; expenditure tree sum = `$1,193,970,288`
   = row Total Expenditures (drift 0). Subtotal columns are parent nodes (D-03), validated by the
   double-count guard. `scripts/loadMNOSA.js` + `scripts/mnOsaTreeMap.json`.

2. **County file URL pinned; county layout independently verified; county FY sample ties to its row
   totals.**
   ✅ PASS — county URLs pinned in `scripts/mnOsaDatasets.json` (FY2013–2021). County layout verified
   independently (89-01): no `GAAPInd`/`ParentEntityName`, shifted columns, label typos, junk columns
   — all documented (D-08). Aitkin FY2021 + Anoka FY2021 dry-runs tie exactly to their row totals.

3. **GAAP/Cash basis per-entity from `GAAPInd`; XLSX-era per-FY manifest enumerates the available range.**
   ✅ PASS — `entityBasis` reads the per-row `GAAPInd` (Minneapolis=GAAP, Ada/Adams=Cash); returns
   null for counties (no GAAPInd column, documented). Manifest enumerates city **FY2012–FY2023** and
   county **FY2013–2021** (floor + gaps + pre-XLSX out-of-scope documented). All 20 URLs verified 200.

4. **Idempotent never-overwrite guard in place; offline unit tests pass.**
   ✅ PASS — `findConflictingBudget` pre-skip guard before every `treasury_sync_city_budget` write
   (treasury_sync_city_budget is not source-safe). `node --test scripts/loadMNOSA.test.mjs` → 11/11 pass.

## Requirements
- **MNSRC-01** ✅ — reusable loader → sourced operating + revenue trees with subtotal nodes, proven on Minneapolis FY2023.
- **MNSRC-02** ✅ — county URL pinned + county-layout-aware parse confirmed independently; basis from GAAPInd; per-FY manifest; idempotent never-overwrite guard; offline tests pass.

## Scope discipline
- **No bulk load** (correct — cities = Phase 90, counties = Phase 91). **Zero DB writes** this phase (all dry-run). $0 spend (no AI/API).
- Artifacts: `scripts/loadMNOSA.js`, `scripts/loadMNOSA.test.mjs`, `scripts/mnOsaTreeMap.json`, `scripts/mnOsaDatasets.json`, `89-PROOF.md`.

## Notable findings carried forward
- County data **lags cities** (latest county = FY2021 vs city FY2023) — Phase 91 county bulk caps at FY2021.
- Counties have **no basis flag** (no GAAPInd) — Phase 91 records county basis as null/unknown.
- City XLSX floor is **FY2012** (earlier than the recon's ~2015 estimate) — Phase 90 can load FY2012–2023.

**Verdict: PASSED.** Phase 89 delivers a proven, tested, idempotent loader + pinned manifest + verified county layout. Ready for Phase 90.
