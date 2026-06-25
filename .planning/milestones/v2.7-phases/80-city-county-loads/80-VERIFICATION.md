---
phase: 80-city-county-loads
status: passed
verified: 2026-06-22
method: inline goal-backward (no subagent — per feedback_no_research_subagents); executed inline, live prod writes
requirements: [VALOAD-01, VALOAD-02, VALOAD-04]
---

# Phase 80 Verification — City + County Loads

**Goal (ROADMAP):** All 38 independent cities and 95 counties are loaded with general-government revenue + expenditure + per-capita across the available history, idempotently.

## Success criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All 38 cities + 95 counties have operating (expenditure) + revenue for each available FY, every row sourced | ✅ (127/133; 6 documented gaps) | Live `treasury.budgets`: **482 rows / 127 municipalities** — FY2024-amended 124×{op,rev}, FY2023 117×{op,rev}. **0 NULL/empty source_url**; uniform `data_source='Virginia APA Comparative Report'`. The 6 unloaded localities have NO data in any published XLSX (FY2023, FY2024-final, FY2024-amended) — multi-year-overdue audits, not a loader failure (see Gap below). |
| 2 | Per-capita renders from the report's population (Exhibit H) | ✅ | Per-FY Exhibit H population set on each municipality (Alexandria 158,591; Fairfax County 1,139,398; Accomack 33,236). Covington/Alleghany load with null population (absent from Exhibit H per the FY2024 school-consolidation footnote) — graceful, no abort. |
| 3 | Re-running the loader changes nothing (idempotent; never-overwrite guard) | ✅ | FY2024 re-run left row counts + municipality count unchanged (no duplicates). Never-overwrite guard skips any (muni,FY,dataset) owned by a different source; absent localities never written as $0 nor created as phantom municipalities. |
| 4 | A spot-check locality's FY2024 totals match the published report | ✅ | Alexandria FY2024 op **$863,578,347** / rev **$874,230,660** (exact); Fairfax County op $6,674,467,930; Accomack County (recovered from amended) op $141,487,870. Homonyms distinct: Fairfax County ≠ Fairfax city; Richmond city $1.6B ≠ Richmond County. |

## Requirements
- **VALOAD-01** (38 cities, sourced op+rev+per-capita) — ✅ all cities with published data loaded (FY2024-amended + FY2023); residual gap = 4 cities with no data in any XLSX year.
- **VALOAD-02** (95 counties, same granularity) — ✅ all counties with published data loaded; residual gap = 2 counties (Lee, Warren).
- **VALOAD-04** (idempotent never-overwrite) — ✅ re-run produced no duplicates; guard + absent-skip proven.

## Implementation decisions / deviations (executor)
- **Homonym safety (the core technical risk):** section-aware lookup (`findLocalityRowInSection`, segment by "No."-reset) keeps the 4 city/county homonyms (Fairfax, Franklin, Richmond, Roanoke) from colliding. Verified county totals ≠ city totals.
- **County naming:** stored "<name> County" / entity_type=county (CA `loadCountyBudget.js` precedent); XLSX match-name decoupled from DB display-name.
- **Adopted the AMENDED FY2024 report** over final — it fills in 14 late-filer localities (FY2024 110→124) and changes no already-filed figures. All FY2024 rows cite the amended dataset URL.

## 🚩 Residual source gap (documented, accepted by Chris)
**6 of 133 cities+counties have NO data in any published XLSX year** (FY2023, FY2024-final, FY2024-amended): cities **Colonial Heights, Emporia, Hopewell, Norton**; counties **Lee, Warren**. These are multi-year-overdue audits the APA has not yet processed. Recorded in `scripts/vaApaDatasets.json` `_meta.note`. **A future re-run of the batch loader against a newer amended/FY2025 report picks them up idempotently — no code change needed.** Phase 83's source-chain audit should expect this as documented-and-accepted, not a defect.

## Tests / live checks
- `node --test scripts/loadVAComparativeReport.test.mjs` → 12/12 pass (7 Phase 79 + 5 Phase 80: roster counts, homonym divergence, section scoping, absent=0, backward-compat).
- Live prod verification probes: 482 rows / 127 munis, 0 NULL source_url, spot-checks exact, idempotent re-run stable.

## Verdict: PASSED
All four success criteria met. 127/133 localities loaded (95.5%) — the 6 absent are a genuine, documented source-data gap (overdue audits), not a loader or scope failure; Chris accepted loading all published data + recording the gap. Ready for Phase 81 (towns + state node + linking).
