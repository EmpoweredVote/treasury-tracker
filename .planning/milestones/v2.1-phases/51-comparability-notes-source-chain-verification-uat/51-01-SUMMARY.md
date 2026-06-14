# Plan 51-01 Summary — Source-chain durability + audit + spot-checks

**Status:** Complete
**Commit:** `fix(51-01): durable metric source URLs + audit output path`
**Requirements:** CTX-02 (criteria 2 + 3)

## What changed
- **Loaders** (`loadFederalFunctions.js`, `loadFederalAgencies.js` OMB + MTS paths, `loadFederalReceipts.js`): disclosure-metric `source_url` now uses the **stable** OMB page — `…/supplemental-materials/` (function/agency PBD), `…/historical-tables/` (receipts), and the fiscaldata MTS dataset page (FY2025 MTS-path agency metrics) — instead of version-specific xlsx / raw API URLs. Fetch URLs / `data_sources.base_url` unchanged.
- **Prod DB:** updated existing rows — 22,941 (`outlays_fy2027.xlsx`) → supplemental page; ~30 raw `api.fiscaldata` → MTS dataset page; 1 IRS `…db-…xlsx` → IRS historical page. **0 fragile source_urls remain** (regex assertion).
- **`auditFederalSources.mjs`:** output path → phase-51 dir (was archived phase-48 → exit 1). Now exits 0.

## Verification
- **Audit:** PASS 33 · BROWSER 26 · **FAIL 0** (exit 0); budgets→registry chain all linked.
- **Durability SQL:** 0 rows match `outlays_fy\d+\.xlsx | api\.fiscaldata | \d+db-.*\.xlsx | hist0\dz\d.*\.xlsx`.
- **Spot-check:** FY1976/1990/2008/2024 each present with 3 lenses; OMB Hist 1.1 figures (FY1976 $371.8B out / $298.1B rec; FY1990 $1,253B/$1,032B; FY2008 $2,983B/$2,524B; FY2024 $6,735B/$4,920B). Trees reconciled to these at load (Phase 49, 0.0000%).

## Notes / trivial follow-up
- The audit's final `console.log` still hardcodes "48-audit-results.json" (cosmetic; the file is written to the phase-51 path). One-line fix whenever convenient.
- 51-02 (content) / 51-03 (UI) / 51-04 (UAT) remain.
