---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Oregon Expansion
status: executing
last_updated: "2026-06-02T18:31:19.905Z"
last_activity: 2026-06-02 -- Phase 24 execution started
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 20
  completed_plans: 17
  percent: 63
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-23)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Phase 24 — los-angeles-data-refresh

## Current Position

Phase: 24 (los-angeles-data-refresh) — EXECUTING
Plan: 1 of 3
Status: Executing Phase 24
Last activity: 2026-06-02 -- Phase 24 execution started

Progress: [██████████] 100%

## Accumulated Context

### Loaders Available

- `bulkLoadBudget.js` — generic Socrata SODA loader; supports `fiscal_year_type: 'integer'` and `where_extra` WHERE fragment in column_mapping
- `loadSanDiegoCSV.js` — CSV download loader for seshat.datasd.org double-quoted format
- `enrichCategories.js` — AI enrichment pipeline; `--city`, `--state`, `--year` flags; idempotent via name_key upsert
- `bulkLoadXLSX.js` — XLSX check register / payroll loader
- `bulkLoadPDF.js` — Claude Haiku vision PDF pipeline for ACFR budget extraction

### Seeded Cities (active in DB)

- TX (13): Dallas, Plano, McKinney, Frisco, Allen, Prosper, Celina, Richardson, Garland, Wylie, Sachse, Murphy, Princeton
- CA (3): Los Angeles, San Francisco, San Diego
- OR (3): Portland (FY2022–FY2026 operating + revenue, 635,749 population, 41 enrichment rows), Gresham (FY2023–FY2026 operating + revenue, 111,507 population, 33 enrichment rows — 23 operating + 10 revenue), Troutdale (municipality seeded, 15,749 population — budget data loads in Plans 02-03)

### Known Tech Debt

- `data_source_id` FK null on some budget rows (SF/SD/LA Rev FY2026) — pre-existing loader pattern, no UI impact
- SD FY2026 absent from source CSV — update `fiscal_years: [2025]` → `[2025, 2026]` in SD data_source rows when SD publishes FY2026 adopted data
- Portland revenue budget (Vol 2, fund-level) deferred per D-03 — requires a new phase if/when prioritized

### Decisions (Phase 21 Plan 01)

- Revenue section detection uses `s.startswith('Resources ')` fallback — FY2024-2026 PDFs have "Resources Proposed Approved Adopted" on one line, not standalone "Resources"
- OCR split-number fix: `r'^\d{1,3},'` condition (handles FY2023 `N,NNN,NNN` splits like `2 0,175,800`)
- NORMALIZE dict covers 3 FY2023 name variants: Internal Service Charges, Li censes & Permits, In ternal Payments
- SANITY_MAX gated on operating mode — revenue FY2026 ~$512M legitimately exceeds $500M cap

### Decisions (Phase 21 Plan 02)

- Enrichment decision RUN: 4 of 10 revenue categories opaque to non-finance citizens ("Internal Svc Chrg", "Financing Proceeds", "Interfund Transfers", "Utility License Fees") — ~$0.01 cost, well under $5 threshold
- UI auto-discovery confirmed: no frontend changes needed — App.tsx available_datasets pattern auto-shows Money In tab for dataset_type='revenue' rows

### Decisions (Phase 22 Plan 01)

- Troutdale fiscal year parsing uses YYYY-YY (dash) regex — Gresham slash regex returns 0 matches on Troutdale PDFs
- Operating extraction targets General Fund page (ACCOUNT 01.00), not All Funds — All Funds Requirements has expenditure categories not departments
- All 8 Troutdale PDFs downloaded successfully (FY2018-19 through FY2025-26) — no download failures
- Troutdale population confirmed as 15749 (Census sub-est2024_41.csv, SUMLEV=162, 2024) — not 17000 estimate from CONTEXT.md
- Troutdale OR seeded in DB (id=5acc9a64-6d95-4013-94d8-abf2b714928e); OR city count now 3 (Portland, Gresham, Troutdale)

### API Cost Threshold

$5 per run — estimate before running AI enrichment or PDF extraction.

## Session Continuity

Last session: 2026-06-02T01:56:07.593Z
Stopped at: Phase 23 context gathered
Resume file: .planning/phases/23-or-all-funds-consistency-requirements-extraction-portland-gr/23-CONTEXT.md

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 22-troutdale-or-budget-load P01 | 7 | 3 tasks | 2 files |
| Phase Phase 22-troutdale-or-budget-load P02 P7 | 2 tasks | - tasks | - files |
| Phase 22 P03 | 45min | 3 tasks | 3 files |

## Decisions

- [Phase ?]: D-02 resolved: all 8 Troutdale FYs (FY2019-FY2026) included in Plan 03 live load — all parse cleanly with no SANITY FAIL
- [Phase ?]: FY2019/FY2020 show 16 departments (COMMUNITY SERVICES absent) vs 17 for FY2021-FY2026 — structural difference, not parse error; both FYs included in live load
- [Phase ?]: All 8 Troutdale FYs included
- [Phase ?]: Enrichment scoped and run
