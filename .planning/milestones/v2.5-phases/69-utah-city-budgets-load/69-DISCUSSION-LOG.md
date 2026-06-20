# Phase 69 Discussion Log

**Date:** 2026-06-19
**Phase:** 69 — Utah City Budgets Load
**Mode:** discuss (human reference only; not consumed by downstream agents)

Four gray areas selected for discussion (all four). Grounded by a live `fund1` probe on Provo + SLC and an FY-completeness probe.

## Area 1 — Icicle tree shape
| Option | Notes | Chosen |
|--------|-------|--------|
| `fund1 → org1 → cat1` | Fund at top (legible, separates enterprise from General Fund); data-driven, $0, no curation | ✓ |
| `org1` flat (~200) | The 68-03 pilot shape; too wide/utility-dominated | |
| Curated functional rollup | Best UX but needs hand-built mapping (no usable function column) | deferred |
**Decision:** D-69-01 — restructure loader to fund1→org1→cat1.
**Evidence:** Provo FY2024 EX = 34 funds (General Fund $80M, Power $59M, Wastewater $48M, Water $36M, Airport $28M…); SLC = 125 funds.

## Area 2 — Fund basis (enterprise vs governmental)
| Option | Notes | Chosen |
|--------|-------|--------|
| All-funds, fund-separated | Keep all-funds (roadmap + ACFR basis); enterprise visible via fund1 top level | ✓ |
| Split governmental vs enterprise | Diverges from all-funds basis; adds complexity | |
**Decision:** D-69-02 — all-funds, no separate datasets.

## Area 3 — Population source
| Option | Notes | Chosen |
|--------|-------|--------|
| Single recent Census vintage | Mirror loadTXPopulation.js; $0; prior-milestone pattern | ✓ |
| Per-year population series | More sourcing work, marginal value | |
**Decision:** D-69-03 — single vintage, store population_year.

## Area 4 — FY range + canary
| Option | Notes | Chosen |
|--------|-------|--------|
| FY2014–FY2025, canary SLC | Complete years only; SLC = hardest stress test + reconciliation target | ✓ |
| FY2014–FY2025, canary Provo | Already proven; fewer edge cases | |
| Include FY2026 (flagged partial) | Current year visible but partial | deferred |
**Decision:** D-69-04 — FY2014–FY2025; exclude partial FY2026; canary SLC then sweep 9.
**Evidence:** Provo FY2026 = $288M/314k rows vs FY2025 $329M/437k rows → FY2026 partial.
